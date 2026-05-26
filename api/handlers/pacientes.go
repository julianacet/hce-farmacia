package handlers

import (
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type pacientesHandler struct{ db *pgxpool.Pool }

func PacientesRouter(db *pgxpool.Pool) http.Handler {
	h := &pacientesHandler{db: db}
	r := chi.NewRouter()
	r.Get("/", h.buscar)
	r.Get("/{documento}", h.obtener)
	return r
}

// GET /pacientes?q=texto  — busca pacientes activos en hce-core (solo lectura)
func (h *pacientesHandler) buscar(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		responderJSON(w, http.StatusOK, []any{})
		return
	}

	param := "%" + strings.ToLower(q) + "%"
	rows, err := h.db.Query(r.Context(), `
		SELECT numero_documento, tipo_documento,
		       CONCAT_WS(' ', nombre_primero, nombre_segundo, apellido_primero, apellido_segundo),
		       COALESCE(telefono_responsable, ''),
		       COALESCE(correo_electronico, '')
		FROM paciente
		WHERE es_ultima_version = TRUE AND esta_activo = TRUE
		  AND (
		       LOWER(numero_documento) LIKE $1
		    OR LOWER(nombre_primero)   LIKE $1
		    OR LOWER(apellido_primero) LIKE $1
		    OR LOWER(CONCAT_WS(' ', nombre_primero, apellido_primero)) LIKE $1
		  )
		ORDER BY apellido_primero, nombre_primero
		LIMIT 20`, param)
	if err != nil {
		log.Printf("buscar pacientes: %v", err)
		responderError(w, http.StatusInternalServerError, "error al buscar pacientes")
		return
	}
	defer rows.Close()

	type Item struct {
		Documento      string `json:"documento"`
		TipoDocumento  string `json:"tipo_documento"`
		NombreCompleto string `json:"nombre_completo"`
		Telefono       string `json:"telefono"`
		Email          string `json:"email"`
	}

	items := []Item{}
	for rows.Next() {
		var p Item
		if err := rows.Scan(&p.Documento, &p.TipoDocumento, &p.NombreCompleto, &p.Telefono, &p.Email); err != nil {
			log.Printf("escanear paciente: %v", err)
			continue
		}
		items = append(items, p)
	}

	responderJSON(w, http.StatusOK, items)
}

// GET /pacientes/:documento
func (h *pacientesHandler) obtener(w http.ResponseWriter, r *http.Request) {
	doc := chi.URLParam(r, "documento")

	type Item struct {
		Documento      string `json:"documento"`
		TipoDocumento  string `json:"tipo_documento"`
		NombreCompleto string `json:"nombre_completo"`
		Telefono       string `json:"telefono"`
		Email          string `json:"email"`
	}

	var p Item
	err := h.db.QueryRow(r.Context(), `
		SELECT numero_documento, tipo_documento,
		       CONCAT_WS(' ', nombre_primero, nombre_segundo, apellido_primero, apellido_segundo),
		       COALESCE(telefono_responsable, ''),
		       COALESCE(correo_electronico, '')
		FROM paciente
		WHERE numero_documento = $1 AND es_ultima_version = TRUE AND esta_activo = TRUE`,
		doc,
	).Scan(&p.Documento, &p.TipoDocumento, &p.NombreCompleto, &p.Telefono, &p.Email)
	if err != nil {
		responderError(w, http.StatusNotFound, "paciente no encontrado")
		return
	}

	responderJSON(w, http.StatusOK, p)
}
