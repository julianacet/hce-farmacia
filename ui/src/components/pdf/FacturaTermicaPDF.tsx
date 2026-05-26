import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'

// Palabras sin espacios (URLs, cadenas largas) hacen wrap en lugar de salirse del borde
Font.registerHyphenationCallback(word =>
  word.length > 14 ? Array.from(word) : [word]
)
import type { DatosClinica } from '../../context/ClinicaContext'
import type { Factura } from '../../api/facturas'
import type { TamanoTermica } from '../../utils/impresion'
import { TAMANO_TERMICA } from '../../utils/impresion'

function formatCOP(valor: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(valor)
}

type Props = {
  clinica: DatosClinica
  factura: Factura
  logoBase64?: string | null
  tamanoTermica?: TamanoTermica
}

export default function FacturaTermicaPDF({
  clinica, factura,
  logoBase64 = null,
  tamanoTermica = 'Termica80',
}: Props) {
  const [anchoPage] = TAMANO_TERMICA[tamanoTermica]
  const pad = 10
  const ancho = anchoPage - pad * 2
  const anulada = factura.estado === 'anulada'

  const fechaObj = new Date(factura.fecha_creacion)
  const fecha = fechaObj.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  const hora  = fechaObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })

  const s = StyleSheet.create({
    page: {
      paddingHorizontal: pad, paddingTop: 14, paddingBottom: 20,
      fontFamily: 'Courier', fontSize: 7, color: '#000000', backgroundColor: '#ffffff',
    },
    sep: { borderBottomWidth: 0.5, borderBottomColor: '#000', borderStyle: 'dashed', marginVertical: 5 },
    c: { textAlign: 'center', marginBottom: 1 },
    bold: { fontFamily: 'Courier-Bold' },
    logoWrap: { alignItems: 'center', marginBottom: 4 },
    logoImg: { width: 28, height: 28, objectFit: 'contain' },
    tituloDoc: { textAlign: 'center', fontFamily: 'Courier-Bold', fontSize: 8, letterSpacing: 0.5, marginBottom: 1 },
    fechaDoc: { textAlign: 'center', fontSize: 6.5, marginBottom: 1 },
    anuladaBox: { borderWidth: 1, borderColor: '#000', borderStyle: 'dashed', marginVertical: 4, paddingVertical: 2 },
    anuladaText: { textAlign: 'center', fontFamily: 'Courier-Bold', fontSize: 12, letterSpacing: 6 },
    label: { fontFamily: 'Courier-Bold', fontSize: 6, letterSpacing: 0.5, marginBottom: 2 },
    itemRow: { flexDirection: 'row', marginBottom: 4 },
    itemDesc: { flex: 1, fontSize: 6.5, lineHeight: 1.3 },
    itemVal: { width: 46, textAlign: 'right', fontSize: 6.5 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    totalGranLabel: { fontFamily: 'Courier-Bold', fontSize: 9 },
    totalGranValor: { fontFamily: 'Courier-Bold', fontSize: 9 },
    pieTexto: { textAlign: 'center', fontSize: 6, color: '#444', marginBottom: 1 },
    corteWrap: { marginTop: 10, alignItems: 'center' },
    corteLine: { borderBottomWidth: 0.5, borderBottomColor: '#000', borderStyle: 'dashed', width: '100%' },
    corteText: { fontSize: 6, color: '#888', marginTop: 2, letterSpacing: 0.5 },
    watermark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
    watermarkText: { fontSize: 38, fontFamily: 'Courier-Bold', color: '#f0a0a0', letterSpacing: 4, transform: 'rotate(-35deg)' },
  })

  // suppress unused warning
  void ancho

  return (
    <Document>
      <Page size={TAMANO_TERMICA[tamanoTermica]} style={s.page}>

        {/* Logo */}
        {logoBase64 && (
          <View style={s.logoWrap}>
            <Image src={logoBase64} style={s.logoImg} />
          </View>
        )}

        {/* Encabezado */}
        <Text style={[s.c, s.bold, { fontSize: 6.5 }]}>{clinica.nombreConsultorio || 'Consultorio'}</Text>
        {clinica.especialidad ? <Text style={[s.c, { fontSize: 6 }]}>{clinica.especialidad}</Text> : null}
        {clinica.nit ? <Text style={[s.c, { fontSize: 6 }]}>NIT {clinica.nit}</Text> : null}
        {(clinica.direccion || clinica.ciudad) ? (
          <Text style={[s.c, { fontSize: 6 }]}>{[clinica.direccion, clinica.ciudad].filter(Boolean).join(' · ')}</Text>
        ) : null}
        {clinica.telefono ? <Text style={[s.c, { fontSize: 6 }]}>{clinica.telefono}</Text> : null}


        <View style={s.sep} />

        {/* Título */}
        <Text style={s.tituloDoc}>FACTURA DE VENTA</Text>
        <Text style={[s.c, { fontSize: 6 }]}>{factura.numero}</Text>
        <Text style={s.fechaDoc}>{fecha} · {hora}</Text>

        {/* Anulada */}
        {anulada && (
          <View style={s.anuladaBox}>
            <Text style={s.anuladaText}>ANULADA</Text>
          </View>
        )}

        <View style={s.sep} />

        {/* Paciente */}
        <Text style={s.label}>PACIENTE</Text>
        <Text style={{ marginBottom: 1 }}>{factura.paciente_nombre}</Text>
        <Text style={{ fontSize: 6, marginBottom: 1 }}>{factura.paciente_documento}</Text>

        <View style={s.sep} />

        {/* Items */}
        {factura.items.map((item) => (
          <View key={item.id} style={s.itemRow}>
            <Text style={s.itemDesc}>
              {item.nombre_medicamento}
              {(item.concentracion || item.forma_farmaceutica) ? (
                '\n' + [item.concentracion, item.forma_farmaceutica].filter(Boolean).join(' · ')
              ) : ''}
              {'\n'}
              <Text style={{ fontSize: 6, color: '#555' }}>
                {item.cantidad > 1 ? `${item.cantidad} × ${formatCOP(item.precio_unitario)}` : formatCOP(item.precio_unitario)}
              </Text>
            </Text>
            <Text style={s.itemVal}>{formatCOP(item.subtotal)}</Text>
          </View>
        ))}

        <View style={s.sep} />

        {/* Totales */}
        <View style={s.totalRow}>
          <Text style={{ fontSize: 6 }}>IVA</Text>
          <Text style={{ fontSize: 6 }}>$ 0</Text>
        </View>
        <View style={s.sep} />
        <View style={s.totalRow}>
          <Text style={s.totalGranLabel}>TOTAL</Text>
          <Text style={s.totalGranValor}>{formatCOP(factura.total)}</Text>
        </View>

        {/* Notas */}
        {factura.notas ? (
          <>
            <View style={s.sep} />
            <Text style={{ fontSize: 6, color: '#555' }}>Nota: {factura.notas}</Text>
          </>
        ) : null}

        {/* Despachado por */}
        <View style={[s.sep, { marginTop: 10 }]} />
        <Text style={[s.c, { fontSize: 6 }]}>Despachado por: {factura.creado_por}</Text>

        <View style={s.sep} />

        {/* Pie */}
        <Text style={[s.pieTexto, s.bold]}>Gracias por su confianza.</Text>
        <Text style={s.pieTexto}>Conserve este recibo · no enmendaduras</Text>
        <Text style={s.pieTexto}>Excluido de IVA · Art. 476 num. 1 E.T.</Text>

{/* Marca de agua anulada */}
        {anulada && (
          <View style={s.watermark}>
            <Text style={s.watermarkText}>ANULADA</Text>
          </View>
        )}

      </Page>
    </Document>
  )
}
