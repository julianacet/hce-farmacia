package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"farmacia/api/models"
)

type medicamentosHandler struct{ db *pgxpool.Pool }

func MedicamentosRouter(db *pgxpool.Pool) http.Handler {
	h := &medicamentosHandler{db: db}
	r := chi.NewRouter()
	r.Get("/", h.listar)
	return r
}

// GET /medicamentos?q=texto&tipo=pos|no_pos
func (h *medicamentosHandler) listar(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	tipo := r.URL.Query().Get("tipo")

	query := `
		SELECT id, COALESCE(codigo,''), nombre,
		       COALESCE(concentracion,''), COALESCE(forma_farmaceutica,''), tipo
		FROM medicamento_predefinido
		WHERE esta_activo = TRUE`
	args := []any{}

	if q != "" {
		args = append(args, "%"+strings.ToLower(q)+"%")
		query += fmt.Sprintf(` AND LOWER(nombre) LIKE $%d`, len(args))
	}
	if tipo == "pos" || tipo == "no_pos" {
		args = append(args, tipo)
		query += fmt.Sprintf(` AND tipo = $%d`, len(args))
	}

	query += ` ORDER BY nombre LIMIT 50`

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		log.Printf("listar medicamentos: %v", err)
		responderError(w, http.StatusInternalServerError, "error al consultar medicamentos")
		return
	}
	defer rows.Close()

	lista := []models.MedicamentoPredefinido{}
	for rows.Next() {
		var m models.MedicamentoPredefinido
		if err := rows.Scan(&m.ID, &m.Codigo, &m.Nombre, &m.Concentracion, &m.FormaFarmaceutica, &m.Tipo); err != nil {
			log.Printf("escanear medicamento: %v", err)
			continue
		}
		lista = append(lista, m)
	}

	responderJSON(w, http.StatusOK, lista)
}

