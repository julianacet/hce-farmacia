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
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"syscall"
	"time"
	"unsafe"

	webview "github.com/webview/webview_go"
)

const proxyPort = "8080"

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

func spaHandler(root string) http.Handler {
	fs := http.FileServer(http.Dir(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(root, filepath.Clean("/"+r.URL.Path))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}
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
