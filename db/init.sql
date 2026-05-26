-- ============================================================
-- HCE Farmacia — Esquema de base de datos
-- Se ejecuta sobre la misma BD de hce-core (hce_provider).
-- Crea el schema 'farmacia' con tablas propias del módulo.
-- Las tablas de hce-core (paciente, medicamento_predefinido,
-- usuario) se referencian pero NO se modifican.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS farmacia;

-- ============================================================
-- 1. Facturas de farmacia
--    Vinculada a paciente de hce-core (por numero_documento)
-- ============================================================

CREATE TABLE IF NOT EXISTS farmacia.factura (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    numero             TEXT          UNIQUE NOT NULL,
    paciente_documento TEXT          NOT NULL,
    fecha              TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total              NUMERIC(12,2) NOT NULL DEFAULT 0,
    estado             TEXT          NOT NULL DEFAULT 'pagada'
                                     CHECK (estado IN ('pagada', 'pendiente', 'anulada')),
    notas              TEXT,
    creado_por         TEXT          NOT NULL DEFAULT 'sistema',
    fecha_creacion     TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_farm_factura_paciente ON farmacia.factura(paciente_documento);
CREATE INDEX IF NOT EXISTS idx_farm_factura_fecha    ON farmacia.factura(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_farm_factura_numero   ON farmacia.factura(numero);

-- ============================================================
-- 2. Ítems de las facturas
--    Referencia al catálogo medicamento_predefinido de hce-core.
--    Los datos del medicamento se capturan al momento de facturar
--    para que el historial no cambie si el catálogo se edita.
-- ============================================================

CREATE TABLE IF NOT EXISTS farmacia.factura_item (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    factura_id          UUID          NOT NULL REFERENCES farmacia.factura(id) ON DELETE CASCADE,
    medicamento_id      INTEGER       REFERENCES medicamento_predefinido(id) ON DELETE SET NULL,
    nombre_medicamento  TEXT          NOT NULL,
    concentracion       TEXT          NOT NULL DEFAULT '',
    forma_farmaceutica  TEXT          NOT NULL DEFAULT '',
    cantidad            NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
    precio_unitario     NUMERIC(12,2) NOT NULL,
    subtotal            NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_farm_item_factura ON farmacia.factura_item(factura_id);

-- ============================================================
-- 3. Contador de facturas por año (FAR-2026-00001, FAR-2027-00001, …)
--    Una fila por año; el contador se incrementa atómicamente
--    dentro de la transacción de creación de factura.
-- ============================================================

CREATE TABLE IF NOT EXISTS farmacia.contador_factura (
    year   INT PRIMARY KEY,
    ultimo INT NOT NULL DEFAULT 0
);
