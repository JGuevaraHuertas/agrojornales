export type Depto = {
  id: string
  departamento: string | null
  jefe: string | null
  cultivo: string | null
  fundo: string | null
  activo: boolean | null
}

export type Labor = {
  codigo: number
  nombre: string
  departamento: string | null
  grupo: string | null
  subgrupo: string | null
  cultivo: string | null
  um: string | null
  ratio_default: number | null
  activo: boolean | null
}

export type Lote = {
  lote_id: string
  cultivo: string | null
  fundo: string | null
  ha_total: number | null
  activo: boolean | null
}

export type Red = {
  red_ref: string | null
  lote_id: string
  red_id: string
}

export type Sector = {
  sector_id: string
  lote_id: string
  red_id: string
  ha: number | null
  variedad: string | null
}

export type ModoJornales = 'AUTO' | 'MANUAL'
export type Vista = 'LISTA' | 'CALENDARIO'

export type FilaUI = {
  ui_id: string
  fecha: string
  linea: number

  lote_id: string
  red_id: string
  sector_id: string

  subgrupo_labor: string
  codigo_labor: number | null

  ratio: string
  ha_prog: string
  jornales_prog: string

  modo_jornales: ModoJornales
  obs: string
  obs_open: boolean
}

export const UI = {
  panelBg: 'bg-white/95',
  card: 'rounded-xl border border-gray-200 shadow-sm',
  btn: 'rounded-lg px-3 py-2 text-sm font-medium border border-green-700 bg-green-700 text-white hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed',
  btnGhost:
    'rounded-lg px-3 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed',
  selectCls:
    'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-200',
  inputCls:
    'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-200',
  tableTh: 'border px-2 py-2 bg-gray-50 text-gray-700 font-semibold whitespace-nowrap',
  tableTd: 'border px-2 py-1 align-top',
}

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

type CryptoWithRandomUUID = Crypto & { randomUUID: () => string }

function getCrypto(): Crypto | undefined {
  return typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
}

function hasRandomUUID(c: Crypto | undefined): c is CryptoWithRandomUUID {
  return !!c && 'randomUUID' in c && typeof (c as CryptoWithRandomUUID).randomUUID === 'function'
}

export function makeId() {
  const c = getCrypto()
  if (hasRandomUUID(c)) return c.randomUUID()
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function generarDiasDelMes(anio: number, mes: number): string[] {
  const last = new Date(anio, mes, 0)
  const days: string[] = []
  for (let d = 1; d <= last.getDate(); d++) days.push(`${anio}-${pad2(mes)}-${pad2(d)}`)
  return days
}

export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim()
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

export function fmt2(n: number) {
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}

export function formatRedId(raw: string) {
  if (!raw) return ''
  let x = raw.split(':')[0]
  x = x.replace(/_PALTO|_PAL|_ARANDANOS|_ARANDANO|_ARA/gi, '')
  x = x.replace(/__+/g, '_').replace(/_$/g, '')
  return x
}

export function formatSectorLabel(raw: string) {
  const s = String(raw ?? '').trim()
  if (!s) return ''

  let m = s.match(/(?:_|-)S(\d+)$/i)
  if (m?.[1]) return `S${Number(m[1])}`

  m = s.match(/S(\d+)/i)
  if (m?.[1]) return `S${Number(m[1])}`

  return s
}

export function normKey(v: unknown) {
  return String(v ?? '').trim().toUpperCase()
}

export function labelDepto(d: Depto) {
  const dep = String(d.departamento ?? '').trim()
  const cul = String(d.cultivo ?? '').trim()
  if (!cul) return dep
  if (dep.toUpperCase().includes(cul.toUpperCase())) return dep
  return `${dep} - ${cul}`
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function escapeCsv(v: unknown) {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function colorByGrupo(grupoRaw: string) {
  const g = String(grupoRaw ?? '').trim().toUpperCase()
  if (!g) return 'bg-gray-50 border-gray-200 text-gray-800'
  if (g.includes('FERTI')) return 'bg-green-50 border-green-200 text-green-900'
  if (g.includes('SAN')) return 'bg-red-50 border-red-200 text-red-900'
  if (g.includes('COSE')) return 'bg-amber-50 border-amber-200 text-amber-900'
  if (g.includes('CAL')) return 'bg-blue-50 border-blue-200 text-blue-900'
  if (g.includes('INV')) return 'bg-purple-50 border-purple-200 text-purple-900'
  if (g.includes('BIO')) return 'bg-emerald-50 border-emerald-200 text-emerald-900'
  return 'bg-gray-50 border-gray-200 text-gray-800'
}

export function buildCalendarWeeks(anio: number, mes: number) {
  const first = new Date(anio, mes - 1, 1)
  const last = new Date(anio, mes, 0)
  const daysInMonth = last.getDate()

  // Monday=0..Sunday=6
  const firstDow = (first.getDay() + 6) % 7

  const cells: Array<{ ymd: string | null; day: number | null }> = []
  for (let i = 0; i < firstDow; i++) cells.push({ ymd: null, day: null })

  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${anio}-${pad2(mes)}-${pad2(d)}`
    cells.push({ ymd, day: d })
  }

  while (cells.length % 7 !== 0) cells.push({ ymd: null, day: null })

  const weeks: Array<Array<{ ymd: string | null; day: number | null }>> = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
