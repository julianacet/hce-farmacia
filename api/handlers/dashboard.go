package handlers

import (
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type dashboardHandler struct{ db *pgxpool.Pool }

func DashboardRouter(db *pgxpool.Pool) http.Handler {
	h := &dashboardHandler{db: db}
	r := chi.NewRouter()
	r.Get("/", h.resumen)
	return r
}

func (h *dashboardHandler) resumen(w http.ResponseWriter, r *http.Request) {
	type Resumen struct {
		FacturasHoy  int     `json:"facturas_hoy"`
		TotalHoy     float64 `json:"total_hoy"`
		FacturasMes  int     `json:"facturas_mes"`
		TotalMes     float64 `json:"total_mes"`
	}

	var res Resumen
	err := h.db.QueryRow(r.Context(), `
		SELECT
			COUNT(*) FILTER (WHERE DATE(fecha) = CURRENT_DATE AND estado != 'anulada'),
			COALESCE(SUM(total) FILTER (WHERE DATE(fecha) = CURRENT_DATE AND estado != 'anulada'), 0),
			COUNT(*) FILTER (WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE) AND estado != 'anulada'),
			COALESCE(SUM(total) FILTER (WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE) AND estado != 'anulada'), 0)
		FROM farmacia.factura`,
	).Scan(&res.FacturasHoy, &res.TotalHoy, &res.FacturasMes, &res.TotalMes)
	if err != nil {
		log.Printf("dashboard facturas: %v", err)
	}

	responderJSON(w, http.StatusOK, res)
}
