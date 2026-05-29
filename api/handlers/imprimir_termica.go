package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// POST /facturas/:id/imprimir-termica
func ImprimirTermicaFactura(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		printerName := os.Getenv("PRINTER_TERMICA")
		if printerName == "" {
			responderError(w, http.StatusServiceUnavailable,
				"impresora térmica no configurada — define la variable de entorno PRINTER_TERMICA")
			return
		}

		id := chi.URLParam(r, "id")

		// Cabecera de la factura
		type row struct {
			Numero            string
			PacienteDocumento string
			PacienteNombre    string
			Fecha             time.Time
			Total             float64
			Estado            string
			CreadoPor         string
			Notas             *string
		}
		var f row
		err := db.QueryRow(r.Context(), `
			SELECT f.numero, f.paciente_documento,
			       COALESCE(CONCAT_WS(' ', p.nombre_primero, p.nombre_segundo,
			                          p.apellido_primero, p.apellido_segundo),
			                f.paciente_documento),
			       f.fecha, f.total, f.estado, f.creado_por, f.notas
			FROM farmacia.factura f
			LEFT JOIN paciente p ON p.numero_documento = f.paciente_documento
			  AND p.es_ultima_version = TRUE AND p.esta_activo = TRUE
			WHERE f.id = $1`, id,
		).Scan(&f.Numero, &f.PacienteDocumento, &f.PacienteNombre,
			&f.Fecha, &f.Total, &f.Estado, &f.CreadoPor, &f.Notas)
		if err != nil {
			responderError(w, http.StatusNotFound, "factura no encontrada")
			return
		}

		// Ítems
		rows, err := db.Query(r.Context(), `
			SELECT nombre_medicamento, concentracion, forma_farmaceutica,
			       cantidad, precio_unitario, subtotal
			FROM farmacia.factura_item
			WHERE factura_id = $1
			ORDER BY nombre_medicamento`, id)
		if err != nil {
			responderError(w, http.StatusInternalServerError, "error al leer ítems")
			return
		}
		defer rows.Close()
		var items []termicaItem
		for rows.Next() {
			var it termicaItem
			if err := rows.Scan(&it.Nombre, &it.Concentracion, &it.FormaFarmaceutica,
				&it.Cantidad, &it.PrecioUnitario, &it.Subtotal); err != nil {
				continue
			}
			items = append(items, it)
		}

		// Configuración del consultorio
		var medicoJSON []byte
		db.QueryRow(r.Context(), `SELECT medico FROM configuracion_sistema WHERE id = 1`).Scan(&medicoJSON)
		var cfg struct {
			NombreConsultorio string `json:"nombreConsultorio"`
			Nombre            string `json:"nombre"`
			NIT               string `json:"nit"`
			Telefono          string `json:"telefono"`
			Impresion         struct {
				TermicaFactura string `json:"termicaFactura"`
			} `json:"impresion"`
		}
		json.Unmarshal(medicoJSON, &cfg)

		width := 32 // 58 mm
		if cfg.Impresion.TermicaFactura == "Termica80" {
			width = 48
		}

		// Generar ESC/POS
		data := escposFacturaFarmacia(f.Numero, f.PacienteDocumento, f.PacienteNombre,
			f.Fecha, f.Total, f.Estado, f.CreadoPor, f.Notas,
			items, cfg.NombreConsultorio, cfg.Nombre, cfg.NIT, cfg.Telefono, width)

		tmp, err := os.CreateTemp("", "farm-print-*.bin")
		if err != nil {
			responderError(w, http.StatusInternalServerError, "error al preparar impresión")
			return
		}
		defer os.Remove(tmp.Name())
		tmp.Write(data)
		tmp.Close()

		if err := enviarImpresoraFarm(printerName, tmp.Name()); err != nil {
			responderError(w, http.StatusInternalServerError,
				fmt.Sprintf("error al enviar a impresora: %s", err.Error()))
			return
		}

		responderJSON(w, http.StatusOK, map[string]string{"estado": "imprimiendo"})
	}
}

// ── Envío a impresora (multiplataforma) ───────────────────────────────────────

func enviarImpresoraFarm(printerName, filePath string) error {
	// PRINTER_MODE=http → relay HTTP para Docker en Windows
	if os.Getenv("PRINTER_MODE") == "http" {
		return enviarHTTPFarm(printerName, filePath)
	}
	// Binario nativo en Windows (sin Docker)
	if runtime.GOOS == "windows" {
		return enviarWindowsFarm(printerName, filePath)
	}
	out, err := exec.Command("lp", "-d", printerName, "-o", "raw", filePath).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s", strings.TrimSpace(string(out)))
	}
	return nil
}

// enviarHTTPFarm reenvía los bytes ESC/POS al relay de impresión que corre en
// el host Windows (accesible desde el container vía host.docker.internal).
func enviarHTTPFarm(printerName, filePath string) error {
	relayURL := os.Getenv("PRINTER_HTTP_URL")
	if relayURL == "" {
		relayURL = "http://host.docker.internal:8765"
	}
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("error al leer archivo de impresión: %w", err)
	}
	target := relayURL + "/print?printer=" + url.QueryEscape(printerName)
	resp, err := http.Post(target, "application/octet-stream", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("error al contactar relay de impresión: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("relay respondió %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return nil
}

func enviarWindowsFarm(printerName, filePath string) error {
	psPath := strings.ReplaceAll(filePath, `\`, `\\`)
	psPrinter := strings.ReplaceAll(printerName, `'`, `''`)
	script := fmt.Sprintf(`
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public class WinPrint {
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Auto)]
  public class DOCINFO{public string pDocName;public string pOutputFile;public string pDataType;}
  [DllImport("winspool.drv",CharSet=CharSet.Auto,SetLastError=true)]
  public static extern bool OpenPrinter(string n,out IntPtr h,IntPtr d);
  [DllImport("winspool.drv",SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv",CharSet=CharSet.Auto,SetLastError=true)]
  public static extern int StartDocPrinter(IntPtr h,int lv,[In,MarshalAs(UnmanagedType.LPStruct)]DOCINFO di);
  [DllImport("winspool.drv",SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv",SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv",SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv",SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h,IntPtr p,int n,out int w);
}
'@
$hp=[IntPtr]::Zero
[WinPrint]::OpenPrinter('%s',[ref]$hp,[IntPtr]::Zero)|Out-Null
$di=New-Object WinPrint+DOCINFO;$di.pDocName='FARM';$di.pDataType='RAW'
[WinPrint]::StartDocPrinter($hp,1,$di)|Out-Null
[WinPrint]::StartPagePrinter($hp)|Out-Null
$bytes=[IO.File]::ReadAllBytes('%s')
$ptr=[Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[Runtime.InteropServices.Marshal]::Copy($bytes,0,$ptr,$bytes.Length)
$w=0;[WinPrint]::WritePrinter($hp,$ptr,$bytes.Length,[ref]$w)|Out-Null
[Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
[WinPrint]::EndPagePrinter($hp)|Out-Null
[WinPrint]::EndDocPrinter($hp)|Out-Null
[WinPrint]::ClosePrinter($hp)|Out-Null
`, psPrinter, psPath)
	out, err := exec.Command("powershell",
		"-NoProfile", "-NonInteractive", "-Command", script).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s", strings.TrimSpace(string(out)))
	}
	return nil
}

// ── ESC/POS ───────────────────────────────────────────────────────────────────

const (
	tReset   = "\x1b@"
	tCP850   = "\x1b\x74\x02"
	tCenter  = "\x1b\x61\x01"
	tLeft    = "\x1b\x61\x00"
	tBoldOn  = "\x1b\x45\x01"
	tBoldOff = "\x1b\x45\x00"
	tCut     = "\x1d\x56\x41\x03"
)

type termicaItem struct {
	Nombre            string
	Concentracion     string
	FormaFarmaceutica string
	Cantidad          float64
	PrecioUnitario    float64
	Subtotal          float64
}

func escposFacturaFarmacia(
	numero, docPaciente, nombrePaciente string,
	fecha time.Time, total float64, estado, creadoPor string, notas *string,
	items []termicaItem,
	consultorio, nombre, nit, telefono string, width int,
) []byte {
	var b bytes.Buffer
	w := func(s string) { b.WriteString(s) }

	zona := time.FixedZone("COT", -5*3600)
	f := fecha.In(zona)

	w(tReset)
	w(tCP850)

	// Encabezado
	w(tCenter)
	if consultorio != "" {
		w(tBoldOn + tWrap(tAscii(consultorio), width) + tBoldOff)
	}
	if nombre != "" {
		w(tWrap(tAscii(nombre), width))
	}
	if nit != "" {
		w("NIT " + nit + "\n")
	}
	if telefono != "" {
		w("Tel: " + telefono + "\n")
	}
	w("\n")

	// Título
	w(tBoldOn + "FACTURA DE VENTA\n" + tBoldOff)
	w(tLeft)
	w(tColumnas("No. "+numero,
		fmt.Sprintf("%02d/%02d/%04d %02d:%02d", f.Day(), f.Month(), f.Year(), f.Hour(), f.Minute()),
		width) + "\n")

	if estado == "anulada" {
		w(tCenter + tBoldOn + "*** ANULADA ***\n" + tBoldOff + tLeft)
	}
	w("\n")

	// Paciente
	w(tWrap("Paciente: "+tAscii(nombrePaciente), width))
	w("Doc:      " + docPaciente + "\n\n")

	// Ítems
	for _, it := range items {
		w(tWrap(tAscii(it.Nombre), width))
		detalle := tAscii(strings.Join([]string{it.Concentracion, it.FormaFarmaceutica}, " "))
		detalle = strings.TrimSpace(detalle)
		precio := ""
		if it.Cantidad != 1 {
			precio = fmt.Sprintf("%.0f x %s", it.Cantidad, tCopStr(it.PrecioUnitario))
		} else {
			precio = tCopStr(it.PrecioUnitario)
		}
		if detalle != "" {
			w(tWrap("  "+detalle, width))
		}
		w(tColumnas("  "+precio, tCopStr(it.Subtotal), width) + "\n")
	}
	w("\n")

	// Totales
	w(tColumnas("IVA (excluido):", "$0", width) + "\n")
	w(tBoldOn + tColumnas("TOTAL:", tCopStr(total), width) + "\n" + tBoldOff)

	// Notas
	if notas != nil && strings.TrimSpace(*notas) != "" {
		w("\n" + tWrap("Nota: "+tAscii(*notas), width))
	}

	// Pie
	w(tCenter)
	w("\nDespachado por: " + tAscii(creadoPor) + "\n")
	w("Excluido de IVA Art. 476\n")
	w("Gracias por su confianza\n")
	w("\n\n\n")
	w(tCut)

	return b.Bytes()
}

// ── helpers ───────────────────────────────────────────────────────────────────

func tColumnas(izq, der string, width int) string {
	lw := utf8.RuneCountInString(izq)
	rw := utf8.RuneCountInString(der)
	sp := width - lw - rw
	if sp < 1 {
		sp = 1
	}
	return izq + strings.Repeat(" ", sp) + der
}

func tWrap(s string, width int) string {
	runes := []rune(s)
	if len(runes) <= width {
		return s + "\n"
	}
	var sb strings.Builder
	for len(runes) > 0 {
		if len(runes) <= width {
			sb.WriteString(string(runes))
			sb.WriteByte('\n')
			break
		}
		cut := width
		for cut > width/2 && runes[cut] != ' ' {
			cut--
		}
		if runes[cut] == ' ' {
			sb.WriteString(string(runes[:cut]))
			sb.WriteByte('\n')
			runes = runes[cut+1:]
		} else {
			sb.WriteString(string(runes[:width]))
			sb.WriteByte('\n')
			runes = runes[width:]
		}
	}
	return sb.String()
}

func tAscii(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch r {
		case 'á', 'à', 'ä', 'â': b.WriteByte('a')
		case 'é', 'è', 'ë', 'ê': b.WriteByte('e')
		case 'í', 'ì', 'ï', 'î': b.WriteByte('i')
		case 'ó', 'ò', 'ö', 'ô': b.WriteByte('o')
		case 'ú', 'ù', 'ü', 'û': b.WriteByte('u')
		case 'Á', 'À', 'Ä', 'Â': b.WriteByte('A')
		case 'É', 'È', 'Ë', 'Ê': b.WriteByte('E')
		case 'Í', 'Ì', 'Ï', 'Î': b.WriteByte('I')
		case 'Ó', 'Ò', 'Ö', 'Ô': b.WriteByte('O')
		case 'Ú', 'Ù', 'Ü', 'Û': b.WriteByte('U')
		case 'ñ': b.WriteByte('n')
		case 'Ñ': b.WriteByte('N')
		case '·', '•': b.WriteByte('-')
		default:
			if r < 128 {
				b.WriteRune(r)
			} else {
				b.WriteByte('?')
			}
		}
	}
	return b.String()
}

func tCopStr(v float64) string {
	s := fmt.Sprintf("%.0f", v)
	n := len(s)
	var out []byte
	for i := 0; i < n; i++ {
		if i > 0 && (n-i)%3 == 0 {
			out = append(out, '.')
		}
		out = append(out, s[i])
	}
	return "$" + string(out)
}
