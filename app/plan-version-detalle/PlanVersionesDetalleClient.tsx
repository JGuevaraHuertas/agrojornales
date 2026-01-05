// app/plan-version-detalle/PlanVersionesDetalleClient.tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

/* =========================
   Tipos
========================= */
type DetRow = {
  id: string
  plan_version_id: string
  plan_id: string
  fecha: string | null

  subgrupo: string | null
  labor_codigo: number | null
  labor_texto: string | null

  lote_id: string | null
  red_id: string | null
  sector_id: string | null

  ha: number | null
  ratio: number | null
  jornales: number | null

  modo: string | null
  obs: string | null
}

type VersionMeta = {
  created_at: string | null
  created_by_email: string | null
  comentario: string | null
  version_nro: number | null
}

type Dia = {
  fecha: string // YYYY-MM-DD
  items: DetRow[]
  totalHa: number
  totalJornales: number
}

/* =========================
   Utils
========================= */
const pad2 = (n: number) => String(n).padStart(2, '0')

const toNum = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

const fmtFechaHora = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = pad2(d.getDate())
  const mm = pad2(d.getMonth() + 1)
  const yyyy = d.getFullYear()

  let hh = d.getHours()
  const min = pad2(d.getMinutes())
  const ampm = hh >= 12 ? 'p.m.' : 'a.m.'
  hh = hh % 12
  if (hh === 0) hh = 12

  return `${dd}/${mm}/${yyyy} ${hh}:${min} ${ampm}`
}

const monthES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function ymdFromDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// Monday-first index: Lu=0 ... Do=6
function weekdayMon0(d: Date) {
  const js = d.getDay() // 0 Sunday ... 6 Saturday
  return (js + 6) % 7
}

function buildCalendarGrid(year: number, month1to12: number) {
  // returns cells: (null | {date: Date, ymd: string, day: number})[]
  const first = new Date(year, month1to12 - 1, 1)
  const daysInMonth = new Date(year, month1to12, 0).getDate()
  const lead = weekdayMon0(first)

  const cells: Array<null | { date: Date; ymd: string; day: number }> = []
  for (let i = 0; i < lead; i++) cells.push(null)

  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(year, month1to12 - 1, day)
    cells.push({ date: dt, ymd: ymdFromDate(dt), day })
  }

  // pad to full weeks (multiple of 7)
  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

function laborLabel(r: DetRow) {
  const code = r.labor_codigo ?? null
  const txt = (r.labor_texto ?? '').trim()
  if (code && txt) return `${code} - ${txt}`
  if (code) return String(code)
  return txt
}

/* =========================
   Componente
========================= */
export default function PlanVersionesDetalleClient() {
  const router = useRouter()
  const sp = useSearchParams()

  const versionId = sp.get('version_id') ?? ''
  const planId = sp.get('plan_id') ?? ''
  const anioStr = sp.get('anio') ?? ''
  const mesStr = sp.get('mes') ?? ''
  const deptoId = sp.get('depto_id') ?? ''
  const versionNroQS = sp.get('version_nro') ?? ''

  const anio = Number(anioStr)
  const mes = Number(mesStr)

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [rows, setRows] = useState<DetRow[]>([])
  const [meta, setMeta] = useState<VersionMeta | null>(null)

  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [selectedDay, setSelectedDay] = useState<string>('') // YYYY-MM-DD

  // para “Ir al detalle ↓” (manual, NO auto-scroll)
  const selectedDayRef = useRef<HTMLDivElement | null>(null)
  const scrollToSelected = () => {
    const el = selectedDayRef.current
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // estilos
  const card = 'rounded-xl border border-gray-200 shadow-sm bg-white'
  const btn =
    'rounded-lg px-3 py-2 text-sm font-medium border border-green-700 bg-green-700 text-white hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed'
  const btnGhost =
    'rounded-lg px-3 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed'
  const tabOn = 'rounded-lg px-3 py-2 text-sm font-semibold border border-green-700 bg-green-700 text-white'
  const tabOff = 'rounded-lg px-3 py-2 text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'

  /* =========================
     Fetch
  ========================= */
  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setErrorMsg('')

      try {
        if (!versionId) throw new Error('Falta version_id en la URL')

        // meta
        const { data: metaData, error: metaErr } = await supabase
          .from('plan_versiones')
          .select('created_at, created_by_email, comentario, version_nro')
          .eq('id', versionId)
          .maybeSingle()

        if (metaErr) throw metaErr
        setMeta((metaData ?? null) as VersionMeta | null)

        // detalle
        const { data, error } = await supabase
          .from('plan_detalle_versiones')
          .select(
            'id, plan_version_id, plan_id, fecha, subgrupo, labor_codigo, labor_texto, lote_id, red_id, sector_id, ha, ratio, jornales, modo, obs'
          )
          .eq('plan_version_id', versionId)
          .order('fecha', { ascending: true })
          .order('id', { ascending: true })

        if (error) throw error

        setRows((data ?? []) as DetRow[])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error cargando detalle de versión'
        setErrorMsg(msg)
        toast.error('Error', { description: msg })
        setRows([])
        setMeta(null)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [versionId])

  /* =========================
     Agrupar por día
  ========================= */
  const dias: Dia[] = useMemo(() => {
    const map = new Map<string, DetRow[]>()

    for (const r of rows) {
      const f = r.fecha ?? 'SIN-FECHA'
      const list = map.get(f) ?? []
      list.push(r)
      map.set(f, list)
    }

    const out: Dia[] = []
    Array.from(map.keys())
      .sort()
      .forEach((fecha) => {
        const items = map.get(fecha) ?? []
        const totalHa = items.reduce((a, x) => a + toNum(x.ha), 0)
        const totalJornales = items.reduce((a, x) => a + toNum(x.jornales), 0)
        out.push({ fecha, items, totalHa, totalJornales })
      })

    return out
  }, [rows])

  const totalHa = useMemo(() => dias.reduce((a, d) => a + d.totalHa, 0), [dias])
  const totalJornales = useMemo(() => dias.reduce((a, d) => a + d.totalJornales, 0), [dias])

  const diasMap = useMemo(() => {
    const m = new Map<string, Dia>()
    for (const d of dias) m.set(d.fecha, d)
    return m
  }, [dias])

  // Default selected day (solo para calendario): el primer día con items del mes
  useEffect(() => {
    if (view !== 'calendar') return
    if (selectedDay) return
    // primer día disponible del mes
    const first = dias.find((d) => d.fecha && d.fecha !== 'SIN-FECHA')
    if (first?.fecha) setSelectedDay(first.fecha)
  }, [view, selectedDay, dias])

  /* =========================
     Calendar grid
  ========================= */
  const cal = useMemo(() => {
    const y = Number.isFinite(anio) ? anio : new Date().getFullYear()
    const m = Number.isFinite(mes) ? mes : new Date().getMonth() + 1
    const cells = buildCalendarGrid(y, m)
    return {
      year: y,
      month: m,
      label: `${monthES[m - 1] ?? 'Mes'} ${y}`,
      cells,
    }
  }, [anio, mes])

  const selectedDia = useMemo(() => (selectedDay ? diasMap.get(selectedDay) ?? null : null), [selectedDay, diasMap])

  /* =========================
     UI
  ========================= */
  const versionLabel = useMemo(() => {
    if (versionNroQS) return versionNroQS
    if (meta?.version_nro != null) return String(meta.version_nro)
    return ''
  }, [versionNroQS, meta?.version_nro])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold text-gray-800">
              DETALLE DE VERSIÓN {versionLabel ? `· ${versionLabel}` : ''}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Contexto: Año {anioStr || '-'} · Mes {mesStr ? String(mesStr).padStart(2, '0') : '-'} · Depto {deptoId || '-'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {meta?.created_at ? `Creada: ${fmtFechaHora(meta.created_at)}` : ''}{' '}
              {meta?.created_by_email ? `· Por: ${meta.created_by_email}` : ''}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className={btn}
              onClick={() =>
                router.push(`/plan-versiones?plan_id=${planId}&anio=${anioStr}&mes=${mesStr}&depto_id=${deptoId}`)
              }
            >
              Volver a versiones
            </button>
            <button className={btn} onClick={() => router.push(`/plan-mensual?anio=${anioStr}&mes=${mesStr}&depto_id=${deptoId}`)}>
              Volver al plan
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2">
          <button className={view === 'list' ? tabOn : tabOff} onClick={() => setView('list')}>
            Vista lista
          </button>
          <button className={view === 'calendar' ? tabOn : tabOff} onClick={() => setView('calendar')}>
            Vista calendario
          </button>
        </div>

        {/* Totales */}
        <div className={`${card} p-3 text-sm text-gray-700 flex justify-end gap-6`}>
          <div>
            <b>Total HA:</b> {totalHa.toFixed(2)}
          </div>
          <div>
            <b>Total Jornales:</b> {totalJornales.toFixed(2)}
          </div>
        </div>

        {/* Estados */}
        {errorMsg ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
        ) : null}
        {loading ? <div className={`${card} p-4 text-sm text-gray-600`}>Cargando…</div> : null}
        {!loading && dias.length === 0 ? (
          <div className={`${card} p-4 text-sm text-gray-600`}>Sin detalle para esta versión</div>
        ) : null}

        {/* =========================
            VISTA LISTA
        ========================= */}
        {view === 'list' ? (
          <div className="space-y-4">
            {dias.map((d) => (
              <div key={d.fecha} className={card}>
                <div className="flex justify-between items-center px-4 py-3 border-b">
                  <div className="font-bold text-gray-800">{d.fecha}</div>
                  <div className="text-sm text-gray-600">
                    <b>HA:</b> {d.totalHa.toFixed(2)} · <b>Jornales:</b> {d.totalJornales.toFixed(2)}
                  </div>
                </div>

                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-600">
                      <tr className="border-b">
                        <th className="py-2 text-left">Subgrupo</th>
                        <th className="py-2 text-left">Labor</th>
                        <th className="py-2 text-left">Ubicación</th>
                        <th className="py-2 text-right">HA</th>
                        <th className="py-2 text-right">Ratio</th>
                        <th className="py-2 text-right">Jornales</th>
                        <th className="py-2 text-left">Modo</th>
                        <th className="py-2 text-left">Obs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.items.map((r) => (
                        <tr key={r.id} className="border-b last:border-b-0">
                          <td className="py-2">{r.subgrupo ?? ''}</td>
                          <td className="py-2">{laborLabel(r)}</td>
                          <td className="py-2">
                            {r.lote_id ?? ''}
                            {r.red_id ? ` · ${r.red_id}` : ''}
                            {r.sector_id ? ` · ${r.sector_id}` : ''}
                          </td>
                          <td className="py-2 text-right">{toNum(r.ha).toFixed(2)}</td>
                          <td className="py-2 text-right">{toNum(r.ratio).toFixed(2)}</td>
                          <td className="py-2 text-right">{toNum(r.jornales).toFixed(2)}</td>
                          <td className="py-2">{r.modo ?? ''}</td>
                          <td className="py-2">{r.obs ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* =========================
            VISTA CALENDARIO
        ========================= */}
        {view === 'calendar' ? (
          <div className={card}>
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between gap-4">
                <div className="font-bold text-gray-800">{cal.label}</div>

                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500">Tip: haz clic en un día para ver el detalle abajo 👇</div>

                  {/* ✅ Manual (NO auto-scroll) */}
                  <button className={btnGhost} onClick={scrollToSelected} disabled={!selectedDay} title="Bajar al detalle del día">
                    Ir al detalle ↓
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 overflow-x-auto">
              <div className="min-w-[980px]">
                {/* Cabecera días */}
                <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-gray-600 mb-2">
                  <div>Lu</div>
                  <div>Ma</div>
                  <div>Mi</div>
                  <div>Ju</div>
                  <div>Vi</div>
                  <div>Sá</div>
                  <div>Do</div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {cal.cells.map((cell, idx) => {
                    if (!cell) {
                      return <div key={`empty-${idx}`} className="h-[110px] rounded-lg border border-transparent" />
                    }

                    const d = diasMap.get(cell.ymd) ?? null
                    const isSel = selectedDay === cell.ymd

                    const itemsCount = d?.items.length ?? 0
                    const haDay = d?.totalHa ?? 0
                    const jDay = d?.totalJornales ?? 0

                    const firstLabor = d?.items?.[0] ? laborLabel(d.items[0]) : ''
                    const extra = itemsCount > 1 ? itemsCount - 1 : 0

                    return (
                      <button
                        key={cell.ymd}
                        type="button"
                        className={[
                          'h-[110px] rounded-lg border p-2 text-left bg-white overflow-hidden',
                          'hover:border-green-300 hover:shadow-sm transition',
                          isSel ? 'border-green-600 ring-2 ring-green-100' : 'border-gray-200',
                        ].join(' ')}
                        onClick={() => setSelectedDay(cell.ymd)}
                        title={`Ver detalle del ${cell.ymd}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-gray-800">{cell.day}</div>
                          {itemsCount > 0 ? (
                            <div className="text-[11px] font-semibold text-green-700">{itemsCount} items</div>
                          ) : (
                            <div className="text-[11px] text-gray-300">—</div>
                          )}
                        </div>

                        <div className="mt-1 text-[11px] text-gray-600">
                          <div className="truncate">
                            <b>HA:</b> {haDay.toFixed(2)}
                          </div>
                          <div className="truncate">
                            <b>J:</b> {jDay.toFixed(2)}
                          </div>
                        </div>

                        {/* ✅ Esto evita que el texto se “salga”: truncate + overflow-hidden */}
                        <div className="mt-1 text-[11px] text-gray-500 min-w-0">
                          {firstLabor ? (
                            <div className="truncate" title={firstLabor}>
                              {firstLabor}
                              {extra > 0 ? <span className="ml-1 font-semibold text-gray-400">+{extra}</span> : null}
                            </div>
                          ) : (
                            <div className="text-gray-300"> </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Detalle del día seleccionado (NO auto-scroll) */}
            <div className="px-4 pb-4">
              {selectedDay ? (
                <div ref={selectedDayRef} className={`${card} p-0`}>
                  <div className="flex justify-between items-center px-4 py-3 border-b">
                    <div className="font-bold text-gray-800">{selectedDay}</div>
                    <div className="text-sm text-gray-600">
                      <b>HA:</b> {(selectedDia?.totalHa ?? 0).toFixed(2)} · <b>Jornales:</b>{' '}
                      {(selectedDia?.totalJornales ?? 0).toFixed(2)}
                    </div>
                  </div>

                  <div className="p-4 overflow-x-auto">
                    {!selectedDia || selectedDia.items.length === 0 ? (
                      <div className="text-sm text-gray-500">Sin registros en este día</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-gray-600">
                          <tr className="border-b">
                            <th className="py-2 text-left">Subgrupo</th>
                            <th className="py-2 text-left">Labor</th>
                            <th className="py-2 text-left">Ubicación</th>
                            <th className="py-2 text-right">HA</th>
                            <th className="py-2 text-right">Ratio</th>
                            <th className="py-2 text-right">Jornales</th>
                            <th className="py-2 text-left">Modo</th>
                            <th className="py-2 text-left">Obs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDia.items.map((r) => (
                            <tr key={r.id} className="border-b last:border-b-0">
                              <td className="py-2">{r.subgrupo ?? ''}</td>
                              <td className="py-2">{laborLabel(r)}</td>
                              <td className="py-2">
                                {r.lote_id ?? ''}
                                {r.red_id ? ` · ${r.red_id}` : ''}
                                {r.sector_id ? ` · ${r.sector_id}` : ''}
                              </td>
                              <td className="py-2 text-right">{toNum(r.ha).toFixed(2)}</td>
                              <td className="py-2 text-right">{toNum(r.ratio).toFixed(2)}</td>
                              <td className="py-2 text-right">{toNum(r.jornales).toFixed(2)}</td>
                              <td className="py-2">{r.modo ?? ''}</td>
                              <td className="py-2">{r.obs ?? ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">Selecciona un día para ver el detalle.</div>
              )}
            </div>

            <div className="px-4 pb-4 text-[11px] text-gray-400">
              * En calendario, el texto se recorta automáticamente con “…” para que no se salga del recuadro.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
