package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	appmiddleware "farmacia/api/middleware"
	"farmacia/api/models"
	"farmacia/api/repository"
)

type facturasHandler struct{ db *pgxpool.Pool }

func FacturasRouter(db *pgxpool.Pool) http.Handler {
	h := &facturasHandler{db: db}
	r := chi.NewRouter()
	r.Get("/", h.listar)
	r.Post("/", h.crear)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", h.obtener)
		r.Patch("/anular", h.anular)
		r.Post("/imprimir-termica", ImprimirTermicaFactura(db))
		r.With(appmiddleware.RequiereRol("admin")).Delete("/", h.eliminar)
	})
	return r
}

// GET /facturas?q=&estado=&desde=&hasta=
func (h *facturasHandler) listar(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	estado := r.URL.Query().Get("estado")
	desde := r.URL.Query().Get("desde")
	hasta := r.URL.Query().Get("hasta")

	where := []string{}
	args := []any{}
	argN := 1

	if q != "" {
		args = append(args, "%"+strings.ToLower(q)+"%")
		where = append(where, fmt.Sprintf(`(
			LOWER(f.numero) LIKE $%d
			OR LOWER(f.paciente_documento) LIKE $%d
			OR LOWER(CONCAT_WS(' ', p.nombre_primero, p.apellido_primero)) LIKE $%d
		)`, argN, argN, argN))
		argN++
	}
	if estado != "" {
		args = append(args, estado)
		where = append(where, fmt.Sprintf("f.estado = $%d", argN))
		argN++
	}
	if desde != "" {
		args = append(args, desde)
		where = append(where, fmt.Sprintf("f.fecha >= $%d", argN))
		argN++
	}
	if hasta != "" {
		args = append(args, hasta)
		where = append(where, fmt.Sprintf("f.fecha <= $%d::date + interval '1 day'", argN))
		argN++
	}

	whereClause := ""
	if len(where) > 0 {
		whereClause = "WHERE " + strings.Join(where, " AND ")
	}

	type Resumen struct {
		ID                string    `json:"id"`
		Numero            string    `json:"numero"`
		PacienteDocumento string    `json:"paciente_documento"`
		PacienteNombre    string    `json:"paciente_nombre"`
		Fecha             time.Time `json:"fecha"`
		Total             float64   `json:"total"`
		Estado            string    `json:"estado"`
		CreadoPor         string    `json:"creado_por"`
	}

	rows, err := h.db.Query(r.Context(), fmt.Sprintf(`
		SELECT f.id, f.numero, f.paciente_documento,
		       COALESCE(CONCAT_WS(' ', p.nombre_primero, p.nombre_segundo, p.apellido_primero, p.apellido_segundo), f.paciente_documento),
		       f.fecha, f.total, f.estado, f.creado_por
		FROM farmacia.factura f
		LEFT JOIN paciente p ON p.numero_documento = f.paciente_documento
		  AND p.es_ultima_version = TRUE AND p.esta_activo = TRUE
		%s
		ORDER BY f.fecha DESC
		LIMIT 200`, whereClause), args...)
	if err != nil {
		log.Printf("listar facturas: %v", err)
		responderError(w, http.StatusInternalServerError, "error al consultar facturas")
		return
	}
	defer rows.Close()

	lista := []Resumen{}
	for rows.Next() {
		var f Resumen
		if err := rows.Scan(&f.ID, &f.Numero, &f.PacienteDocumento, &f.PacienteNombre,
			&f.Fecha, &f.Total, &f.Estado, &f.CreadoPor); err != nil {
			log.Printf("escanear factura: %v", err)
			responderError(w, http.StatusInternalServerError, "error al leer factura")
			return
		}
		lista = append(lista, f)
	}

	responderJSON(w, http.StatusOK, lista)
}

// GET /facturas/:id
func (h *facturasHandler) obtener(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	f, err := h.cargarFactura(r, id)
	if err != nil {
		responderError(w, http.StatusNotFound, "factura no encontrada")
		return
	}
	responderJSON(w, http.StatusOK, f)
}

// POST /facturas
func (h *facturasHandler) crear(w http.ResponseWriter, r *http.Request) {
	u := appmiddleware.UsuarioDesdeContexto(r.Context())
	var input models.FacturaInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		responderError(w, http.StatusBadRequest, "cuerpo inválido")
		return
	}
	if strings.TrimSpace(input.PacienteDocumento) == "" {
		responderError(w, http.StatusBadRequest, "paciente_documento es obligatorio")
		return
	}
	if len(input.Items) == 0 {
		responderError(w, http.StatusBadRequest, "la factura debe tener al menos un medicamento")
		return
	}
	var facturaID, numero string

	if err := repository.ExecTx(r.Context(), h.db, func(tx pgx.Tx) error {
		var year, seq int64
		if err := tx.QueryRow(r.Context(), `
			INSERT INTO farmacia.contador_factura (year, ultimo)
			VALUES (EXTRACT(YEAR FROM NOW())::INT, 1)
			ON CONFLICT (year) DO UPDATE
				SET ultimo = contador_factura.ultimo + 1
			RETURNING year, ultimo`,
		).Scan(&year, &seq); err != nil {
			return err
		}
		numero = fmt.Sprintf("%d%05d", year, seq)

		var total float64
		for _, item := range input.Items {
			total += item.Cantidad * item.PrecioUnitario
		}

		if err := tx.QueryRow(r.Context(), `
			INSERT INTO farmacia.factura
				(numero, paciente_documento, total, notas, creado_por, estado)
			VALUES ($1,$2,$3,$4,$5,'pagada')
			RETURNING id`,
			numero, input.PacienteDocumento, total,
			input.Notas, u.Nombre,
		).Scan(&facturaID); err != nil {
			return err
		}

		for _, item := range input.Items {
			subtotal := item.Cantidad * item.PrecioUnitario
			if _, err := tx.Exec(r.Context(), `
				INSERT INTO farmacia.factura_item
					(factura_id, medicamento_id, nombre_medicamento, concentracion, forma_farmaceutica,
					 cantidad, precio_unitario, subtotal)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
				facturaID, item.MedicamentoID, item.NombreMedicamento,
				item.Concentracion, item.FormaFarmaceutica,
				item.Cantidad, item.PrecioUnitario, subtotal,
			); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		log.Printf("crear factura: %v", err)
		responderError(w, http.StatusInternalServerError, "error al crear factura")
		return
	}

	f, err := h.cargarFactura(r, facturaID)
	if err != nil {
		responderError(w, http.StatusInternalServerError, "factura creada pero no se pudo recuperar")
		return
	}
	responderJSON(w, http.StatusCreated, f)
}

// PATCH /facturas/:id/anular
func (h *facturasHandler) anular(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if err := repository.ExecTx(r.Context(), h.db, func(tx pgx.Tx) error {
		var estado string
		if err := tx.QueryRow(r.Context(),
			`SELECT estado FROM farmacia.factura WHERE id=$1`, id,
		).Scan(&estado); err != nil {
			return errors.New("factura no encontrada")
		}
		if estado == "anulada" {
			return errors.New("la factura ya está anulada")
		}
		_, err := tx.Exec(r.Context(),
			`UPDATE farmacia.factura SET estado='anulada' WHERE id=$1`, id)
		return err
	}); err != nil {
		responderError(w, http.StatusBadRequest, err.Error())
		return
	}

	responderJSON(w, http.StatusOK, map[string]string{"estado": "anulada"})
}

// DELETE /facturas/:id — solo admin
func (h *facturasHandler) eliminar(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tag, err := h.db.Exec(r.Context(),
		`DELETE FROM farmacia.factura WHERE id = $1`, id)
	if err != nil {
		log.Printf("eliminar factura: %v", err)
		responderError(w, http.StatusInternalServerError, "error al eliminar factura")
		return
	}
	if tag.RowsAffected() == 0 {
		responderError(w, http.StatusNotFound, "factura no encontrada")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *facturasHandler) cargarFactura(r *http.Request, id string) (models.Factura, error) {
	var f models.Factura
	err := h.db.QueryRow(r.Context(), `
		SELECT f.id, f.numero, f.paciente_documento,
		       COALESCE(CONCAT_WS(' ', p.nombre_primero, p.nombre_segundo, p.apellido_primero, p.apellido_segundo), f.paciente_documento),
		       f.fecha, f.total,
		       f.estado, f.notas, f.creado_por, f.fecha_creacion
		FROM farmacia.factura f
		LEFT JOIN paciente p ON p.numero_documento = f.paciente_documento
		  AND p.es_ultima_version = TRUE AND p.esta_activo = TRUE
		WHERE f.id = $1`, id,
	).Scan(&f.ID, &f.Numero, &f.PacienteDocumento, &f.PacienteNombre,
		&f.Fecha, &f.Total,
		&f.Estado, &f.Notas, &f.CreadoPor, &f.FechaCreacion)
	if err != nil {
		return f, err
	}

	rows, err := h.db.Query(r.Context(), `
		SELECT id, factura_id, medicamento_id, nombre_medicamento,
		       concentracion, forma_farmaceutica,
		       cantidad, precio_unitario, subtotal
		FROM farmacia.factura_item
		WHERE factura_id = $1
		ORDER BY nombre_medicamento`, id)
	if err != nil {
		return f, err
	}
	defer rows.Close()

	f.Items = []models.FacturaItem{}
	for rows.Next() {
		var item models.FacturaItem
		if err := rows.Scan(&item.ID, &item.FacturaID, &item.MedicamentoID,
			&item.NombreMedicamento, &item.Concentracion, &item.FormaFarmaceutica,
			&item.Cantidad, &item.PrecioUnitario, &item.Subtotal); err != nil {
			return f, err
		}
		f.Items = append(f.Items, item)
	}
	return f, nil
}
