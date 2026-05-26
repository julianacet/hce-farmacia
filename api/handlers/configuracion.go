package handlers

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func ConfiguracionRouter(db *pgxpool.Pool) http.Handler {
	r := chi.NewRouter()
	r.Get("/", getConfiguracion(db))
	return r
}

// GET /api/configuracion — público.
// Lee tema y medico de la tabla configuracion_sistema de hce-core.
func getConfiguracion(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var temaBytes, medicoBytes []byte
		err := db.QueryRow(r.Context(),
			`SELECT tema, medico FROM configuracion_sistema WHERE id = 1`,
		).Scan(&temaBytes, &medicoBytes)

		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			w.Write([]byte(`{"tema":{},"medico":{}}`))
			return
		}
		if len(temaBytes) == 0 {
			temaBytes = []byte("{}")
		}
		if len(medicoBytes) == 0 {
			medicoBytes = []byte("{}")
		}
		fmt.Fprintf(w, `{"tema":%s,"medico":%s}`, temaBytes, medicoBytes)
	}
}
