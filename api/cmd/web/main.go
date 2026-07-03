//go:build windows

// farm-web — cliente Windows de HCE Farmacia.
//
// Descubre el servidor HCE Consultorio en la red local vía UDP, levanta un
// proxy HTTP local que sirve el frontend de farmacia y reenvía las llamadas
// /api/* al servidor descubierto, y abre una ventana WebView2.
//
// No requiere farm-api ni ningún servidor propio: toda la lógica de negocio
// vive en hce-core.

package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	webview "github.com/webview/webview_go"
)

const (
	proxyPort  = "8080"
	githubRepo = "julianacet/hce-farmacia"
)

func main() {
	exe, _ := os.Executable()
	exeDir := filepath.Dir(exe)

	logDir := filepath.Join(exeDir, "logs")
	os.MkdirAll(logDir, 0755)
	if lf, err := os.OpenFile(filepath.Join(logDir, "farmacia.log"),
		os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644); err == nil {
		log.SetOutput(lf)
	}

	// 1. Descubrir el servidor HCE Consultorio vía UDP
	serverURL, err := descubrirServidor(20 * time.Second)
	if err != nil {
		mostrarError("No se encontró HCE Consultorio en la red.\n\n" +
			"Asegúrate de que HCE Consultorio esté abierto en el\n" +
			"equipo del médico y ambos estén en la misma red.")
		return
	}
	log.Printf("Servidor encontrado: %s", serverURL)

	// 2. Levantar proxy local
	if err := iniciarProxy(exeDir, serverURL); err != nil {
		mostrarError("No se pudo iniciar el módulo de farmacia:\n" + err.Error())
		return
	}

	// 3. Abrir ventana WebView2
	w := webview.New(false)
	defer w.Destroy()
	w.SetTitle("HCE Farmacia")
	w.SetSize(1280, 800, webview.HintNone)
	w.Navigate("http://localhost:" + proxyPort)
	w.Run()
}

// descubrirServidor escucha el broadcast UDP de hce-core hasta encontrarlo.
func descubrirServidor(timeout time.Duration) (string, error) {
	conn, err := net.ListenPacket("udp4", ":45678")
	if err != nil {
		return "", fmt.Errorf("no se pudo escuchar UDP 45678: %w", err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(timeout))

	buf := make([]byte, 512)
	for {
		n, addr, err := conn.ReadFrom(buf)
		if err != nil {
			return "", fmt.Errorf("tiempo de espera agotado — ¿está corriendo HCE Consultorio?")
		}
		var msg struct {
			App  string `json:"app"`
			Port string `json:"port"`
		}
		if json.Unmarshal(buf[:n], &msg) != nil || msg.App != "hce" {
			continue
		}
		serverIP := addr.(*net.UDPAddr).IP.String()
		return fmt.Sprintf("http://%s:%s", serverIP, msg.Port), nil
	}
}

// iniciarProxy levanta un servidor HTTP en localhost:8080 que:
//   - sirve los archivos estáticos de farmacia desde dist-farmacia/
//   - responde /local/* con handlers locales (versión, actualización)
//   - reenvía /api/* al servidor hce-core descubierto
func iniciarProxy(exeDir, serverURL string) error {
	target, err := url.Parse(serverURL)
	if err != nil {
		return err
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	distDir := filepath.Join(exeDir, "dist-farmacia")
	if _, err := os.Stat(distDir); os.IsNotExist(err) {
		return fmt.Errorf("no se encontró la carpeta dist-farmacia junto al ejecutable")
	}

	mux := http.NewServeMux()

	// Endpoints locales: versión y actualización (NO se proxean a hce-core)
	mux.Handle("/local/", localHandler(exeDir))

	// Llamadas a la API → proxy al servidor hce-core
	mux.Handle("/api/", proxy)

	// Frontend SPA → servir archivos estáticos, caer en index.html para React Router
	mux.Handle("/", spaHandler(distDir))

	go func() {
		if err := http.ListenAndServe(":"+proxyPort, mux); err != nil {
			log.Fatalf("proxy local: %v", err)
		}
	}()

	// Esperar hasta que el proxy esté listo
	for i := 0; i < 10; i++ {
		resp, err := http.Get("http://localhost:" + proxyPort)
		if err == nil {
			resp.Body.Close()
			return nil
		}
		time.Sleep(200 * time.Millisecond)
	}
	return nil
}

// localHandler maneja /local/version y /local/actualizar.
func localHandler(exeDir string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/local/version", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		actual := leerVersionLocal(exeDir)
		info := versionInfo{Actual: actual}

		gh, err := consultarGitHub()
		if err != nil {
			info.Error = "sin conexión a GitHub"
			responderJSON(w, info)
			return
		}
		info.Disponible = gh.version
		info.UrlDescarga = gh.urlDescarga
		info.HayActualizacion = gh.version != "" && gh.version != actual
		responderJSON(w, info)
	})

	mux.HandleFunc("/local/actualizar", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			URL string `json:"url"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.URL == "" {
			http.Error(w, `{"error":"url requerida"}`, http.StatusBadRequest)
			return
		}

		tmp, err := os.CreateTemp("", "farm-setup-*.exe")
		if err != nil {
			http.Error(w, `{"error":"error al crear archivo temporal"}`, http.StatusInternalServerError)
			return
		}
		tmpPath := tmp.Name()
		tmp.Close()

		client := &http.Client{Timeout: 10 * time.Minute}
		resp, err := client.Get(body.URL)
		if err != nil {
			os.Remove(tmpPath)
			http.Error(w, `{"error":"error al descargar actualización"}`, http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()

		f, err := os.OpenFile(tmpPath, os.O_WRONLY, 0755)
		if err != nil {
			os.Remove(tmpPath)
			http.Error(w, `{"error":"error al guardar instalador"}`, http.StatusInternalServerError)
			return
		}
		if _, err = io.Copy(f, resp.Body); err != nil {
			f.Close()
			os.Remove(tmpPath)
			http.Error(w, `{"error":"error al guardar instalador"}`, http.StatusInternalServerError)
			return
		}
		f.Close()

		// Lanzar el instalador detached: espera 3s para que el proxy pueda responder,
		// luego corre el instalador (cerrará farm-web.exe) y borra el temporal.
		script := fmt.Sprintf(
			`Start-Sleep -Seconds 3; Start-Process '%s' -ArgumentList '/VERYSILENT','/NORESTART','/CLOSEAPPLICATIONS' -Wait; Remove-Item '%s' -ErrorAction SilentlyContinue`,
			tmpPath, tmpPath,
		)
		cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", script)
		cmd.Start()

		responderJSON(w, map[string]string{"estado": "instalando"})
	})

	return mux
}

func leerVersionLocal(exeDir string) string {
	data, err := os.ReadFile(filepath.Join(exeDir, "version.txt"))
	if err != nil {
		return "dev"
	}
	return strings.TrimSpace(string(data))
}

type versionInfo struct {
	Actual           string `json:"actual"`
	Disponible       string `json:"disponible,omitempty"`
	HayActualizacion bool   `json:"hay_actualizacion"`
	UrlDescarga      string `json:"url_descarga,omitempty"`
	Error            string `json:"error,omitempty"`
}

type ghRelease struct {
	version     string
	urlDescarga string
}

func consultarGitHub() (ghRelease, error) {
	apiURL := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", githubRepo)
	client := &http.Client{Timeout: 5 * time.Second}

	req, _ := http.NewRequest("GET", apiURL, nil)
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := client.Do(req)
	if err != nil {
		return ghRelease{}, err
	}
	defer resp.Body.Close()

	var payload struct {
		TagName string `json:"tag_name"`
		Assets  []struct {
			Name               string `json:"name"`
			BrowserDownloadURL string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return ghRelease{}, err
	}

	version := strings.TrimPrefix(payload.TagName, "v")
	urlDescarga := ""
	for _, a := range payload.Assets {
		if strings.HasSuffix(a.Name, ".exe") {
			urlDescarga = a.BrowserDownloadURL
			break
		}
	}
	return ghRelease{version: version, urlDescarga: urlDescarga}, nil
}

func responderJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func spaHandler(root string) http.Handler {
	fs := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(root, filepath.Clean("/"+r.URL.Path))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			// Los assets de Vite (dist/assets/*) llevan un hash de contenido en el
			// nombre, así que son inmutables y se pueden cachear indefinidamente.
			// Todo lo demás (sobre todo index.html) debe revalidarse siempre: si no,
			// WebView2 puede seguir sirviendo el bundle viejo después de actualizar,
			// desincronizado con el backend.
			if strings.HasPrefix(r.URL.Path, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			}
			fs.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		http.ServeFile(w, r, filepath.Join(root, "index.html"))
	})
}

func mostrarError(msg string) {
	m, _ := syscall.UTF16PtrFromString(msg)
	t, _ := syscall.UTF16PtrFromString("HCE Farmacia")
	syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(
		0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10,
	)
}
