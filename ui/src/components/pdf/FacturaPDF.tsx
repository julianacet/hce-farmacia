import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'

// Palabras sin espacios (URLs, cadenas largas) hacen wrap en lugar de salirse del borde
Font.registerHyphenationCallback(word =>
  word.length > 14 ? Array.from(word) : [word]
)
import type { DatosClinica } from '../../context/ClinicaContext'
import type { Factura } from '../../api/facturas'

function formatCOP(valor: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(valor)
}

type Props = {
  clinica: DatosClinica
  factura: Factura
  colorPrimario?: string
  logoBase64?: string | null
}

export default function FacturaPDF({
  clinica, factura,
  colorPrimario = '#0f766e',
  logoBase64 = null,
}: Props) {
  const fecha = new Date(factura.fecha_creacion).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const anulada = factura.estado === 'anulada'
  const LOGO_W = 60

  const s = StyleSheet.create({
    page: {
      paddingHorizontal: 48,
      paddingVertical: 36,
      fontFamily: 'Helvetica',
      fontSize: 9,
      color: '#0f172a',
      backgroundColor: '#ffffff',
    },

    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    logoBox: { width: LOGO_W, marginRight: 12 },
    logoImg: { width: LOGO_W, height: LOGO_W, objectFit: 'contain' },
    logoPlaceholder: {
      width: LOGO_W, height: LOGO_W,
      borderWidth: 1, borderColor: '#e2e8f0',
      borderStyle: 'dashed', borderRadius: 4,
    },
    headerInfo: { flex: 1 },
    headerConsultorio: {
      fontSize: 12, fontFamily: 'Helvetica-Bold',
      color: colorPrimario, marginBottom: 2,
    },
    headerNombre: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    headerSub: { fontSize: 8, color: '#64748b', marginBottom: 1 },
    estadoBadge: {
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
      backgroundColor: anulada ? '#fee2e2' : '#dcfce7',
    },
    estadoTexto: {
      fontSize: 8, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5,
      color: anulada ? '#991b1b' : '#166534',
    },

    dividerAccent: { borderBottomWidth: 2, borderBottomColor: colorPrimario, marginBottom: 12 },
    divider: { borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', marginVertical: 10 },

    watermark: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: 'center', alignItems: 'center',
    },
    watermarkText: {
      fontSize: 64, fontFamily: 'Helvetica-Bold',
      color: '#fca5a5', letterSpacing: 8,
      transform: 'rotate(-35deg)',
    },

    titleRow: {
      flexDirection: 'row', alignItems: 'flex-end',
      justifyContent: 'space-between', marginBottom: 2,
    },
    titulo: { fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1, color: '#0f172a' },
    subtituloDoc: { fontSize: 8, color: '#64748b', marginBottom: 10 },
    refLabel: { fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' },
    refValor: { fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right' },

    metaRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
    metaCelda: { flex: 1 },
    metaLabel: { fontSize: 7, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    metaValor: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

    dualCol: { flexDirection: 'row', gap: 16, marginBottom: 12 },
    col: { flex: 1 },
    colLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    colNombre: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
    colSub: { fontSize: 8, color: '#64748b', marginBottom: 1 },

    seccionTitulo: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    tablaHeader: {
      flexDirection: 'row', backgroundColor: '#f8fafc',
      paddingVertical: 5, paddingHorizontal: 6,
      borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#e2e8f0',
    },
    tablaFila: {
      flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6,
      borderBottomWidth: 0.5, borderColor: '#f1f5f9',
    },
    colMed: { flex: 1, fontSize: 8 },
    colCant: { width: 36, fontSize: 8, textAlign: 'right' },
    colNum: { width: 72, fontSize: 8, textAlign: 'right' },
    thMed: { flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8' },
    thCant: { width: 36, fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textAlign: 'right' },
    thNum: { width: 72, fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#94a3b8', textAlign: 'right' },

    totalesBloque: { alignItems: 'flex-end', marginTop: 10, marginBottom: 16 },
    totalDivider: { width: 264, borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', marginBottom: 6 },
    totalFila: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginBottom: 3 },
    totalLabel: { fontSize: 8, color: '#64748b', width: 160, textAlign: 'right' },
    totalValor: { fontSize: 8, color: '#64748b', width: 80, textAlign: 'right' },
    totalPrincipalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', width: 160, textAlign: 'right' },
    totalPrincipalValor: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0f172a', width: 80, textAlign: 'right' },

    footerLegal: { marginTop: 16, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#e2e8f0' },
    footerTexto: { fontSize: 7, color: '#94a3b8', marginBottom: 1 },

    notasBloque: {
      marginTop: 10, padding: 8,
      backgroundColor: '#f8fafc', borderRadius: 4,
      fontSize: 8, color: '#475569',
    },

    despachadoPor: { marginTop: 8, fontSize: 8, color: '#64748b' },
  })

  return (
    <Document>
      <Page size={[396, 612]} style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoBox}>
            {logoBase64
              ? <Image src={logoBase64} style={s.logoImg} />
              : <View style={s.logoPlaceholder} />}
          </View>
          <View style={s.headerInfo}>
            <Text style={s.headerConsultorio}>{clinica.nombreConsultorio || 'Consultorio'}</Text>
            {clinica.nombre ? <Text style={s.headerNombre}>{clinica.nombre}</Text> : null}
            {clinica.especialidad ? <Text style={s.headerSub}>{clinica.especialidad}</Text> : null}
            {clinica.nit ? <Text style={s.headerSub}>NIT {clinica.nit}</Text> : null}
            {(clinica.ciudad || clinica.direccion) ? (
              <Text style={s.headerSub}>{[clinica.ciudad, clinica.direccion].filter(Boolean).join(' · ')}</Text>
            ) : null}
            {clinica.telefono ? <Text style={s.headerSub}>{clinica.telefono}</Text> : null}
          </View>
        </View>

        <View style={s.dividerAccent} />

        {/* Título */}
        <View style={s.titleRow}>
          <Text style={s.titulo}>FACTURA DE VENTA</Text>
          <View>
            <Text style={s.refLabel}>Número</Text>
            <Text style={s.refValor}>{factura.numero}</Text>
          </View>
        </View>
        {/* Meta */}
        <View style={s.metaRow}>
          <View style={s.metaCelda}>
            <Text style={s.metaLabel}>Fecha de emisión</Text>
            <Text style={s.metaValor}>{fecha}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Adquiriente */}
        <View style={s.dualCol}>
          <View style={s.col}>
            <Text style={s.colLabel}>Paciente / Adquiriente</Text>
            <Text style={s.colNombre}>{factura.paciente_nombre}</Text>
            <Text style={s.colSub}>{factura.paciente_documento}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.colLabel}>Despachado por</Text>
            <Text style={s.colNombre}>{factura.creado_por}</Text>
          </View>
        </View>

        {/* Tabla medicamentos */}
        <Text style={s.seccionTitulo}>Medicamentos</Text>
        <View style={s.tablaHeader}>
          <Text style={s.thMed}>Medicamento</Text>
          <Text style={s.thCant}>Cant.</Text>
          <Text style={s.thNum}>V. Unit.</Text>
          <Text style={s.thNum}>Subtotal</Text>
        </View>
        {factura.items.map((item) => (
          <View key={item.id} style={s.tablaFila}>
            <View style={s.colMed}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{item.nombre_medicamento}</Text>
              {(item.concentracion || item.forma_farmaceutica) ? (
                <Text style={{ fontSize: 7, color: '#64748b' }}>
                  {[item.concentracion, item.forma_farmaceutica].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </View>
            <Text style={s.colCant}>{item.cantidad}</Text>
            <Text style={s.colNum}>{formatCOP(item.precio_unitario)}</Text>
            <Text style={s.colNum}>{formatCOP(item.subtotal)}</Text>
          </View>
        ))}

        {/* Totales */}
        <View style={s.totalesBloque}>
          <View style={s.totalFila}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalValor}>{formatCOP(factura.total)}</Text>
          </View>
          <View style={s.totalFila}>
            <Text style={s.totalLabel}>IVA</Text>
            <Text style={s.totalValor}>{formatCOP(0)}</Text>
          </View>
          <View style={s.totalDivider} />
          <View style={s.totalFila}>
            <Text style={s.totalPrincipalLabel}>Total a pagar</Text>
            <Text style={s.totalPrincipalValor}>{formatCOP(factura.total)}</Text>
          </View>
        </View>

        {/* Notas */}
        {factura.notas ? (
          <Text style={s.notasBloque}>Nota: {factura.notas}</Text>
        ) : null}


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
