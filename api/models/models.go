package models

import "time"

// ── Paciente (lectura de hce-core) ───────────────────────────────────────────

type PacienteResumen struct {
	Documento      string `json:"documento"`
	TipoDocumento  string `json:"tipo_documento"`
	NombreCompleto string `json:"nombre_completo"`
	Telefono       string `json:"telefono"`
	Email          string `json:"email"`
}

// ── Medicamento predefinido (catálogo de hce-core) ───────────────────────────

type MedicamentoPredefinido struct {
	ID                int    `json:"id"`
	Codigo            string `json:"codigo"`
	Nombre            string `json:"nombre"`
	Concentracion     string `json:"concentracion"`
	FormaFarmaceutica string `json:"forma_farmaceutica"`
	Tipo              string `json:"tipo"`
}

// ── Factura de farmacia ───────────────────────────────────────────────────────

type FacturaItem struct {
	ID                string  `json:"id"`
	FacturaID         string  `json:"factura_id"`
	MedicamentoID     *int    `json:"medicamento_id"`
	NombreMedicamento string  `json:"nombre_medicamento"`
	Concentracion     string  `json:"concentracion"`
	FormaFarmaceutica string  `json:"forma_farmaceutica"`
	Cantidad          float64 `json:"cantidad"`
	PrecioUnitario    float64 `json:"precio_unitario"`
	Subtotal          float64 `json:"subtotal"`
}

type Factura struct {
	ID                string        `json:"id"`
	Numero            string        `json:"numero"`
	PacienteDocumento string        `json:"paciente_documento"`
	PacienteNombre    string        `json:"paciente_nombre"`
	Fecha             time.Time     `json:"fecha"`
	Total             float64       `json:"total"`
	Estado            string        `json:"estado"`
	Notas             *string       `json:"notas"`
	CreadoPor         string        `json:"creado_por"`
	FechaCreacion     time.Time     `json:"fecha_creacion"`
	Items             []FacturaItem `json:"items"`
}

type FacturaItemInput struct {
	MedicamentoID     *int    `json:"medicamento_id"`
	NombreMedicamento string  `json:"nombre_medicamento"`
	Concentracion     string  `json:"concentracion"`
	FormaFarmaceutica string  `json:"forma_farmaceutica"`
	Cantidad          float64 `json:"cantidad"`
	PrecioUnitario    float64 `json:"precio_unitario"`
}

type FacturaInput struct {
	PacienteDocumento string             `json:"paciente_documento"`
	Notas             *string            `json:"notas"`
	Items             []FacturaItemInput `json:"items"`
}
