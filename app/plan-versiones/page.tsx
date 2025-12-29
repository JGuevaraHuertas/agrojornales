'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

type Labor = {
  codigo: number
  nombre: string
  grupo: string | null
  subgrupo: string | null
}

type VersionRow = {
  id: string
  plan_id: string
  depto_id: string
  anio: number
  mes: number
  created_at: string
  created_by: string | null
  comentario: string | null
}

type DetalleVersionRow = {
  id?: string
  version_id: string
  fecha: string | null
  linea: number | null
  lote_id: string | null
  red_id: string | null
  sector_id: string | null
  codigo_labor: number | null
  ratio: number | null
  ha_prog: number | null
  jornales_prog: number | null
  obs: string | null
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim()
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function fmt2(n: number) {
  return (Number.isFinite(n) ? n : 0).toFixed(2)
}

function escapeCsv(v: unknown) {
  const s = String(v ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
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

export default function PlanVersionesPage() {
  const router = useRouter()
  const sp = useSearchParams()

  // Puedes entrar con:
  // /plan-versiones?planId=...&anio=2025&mes=12&deptoId=...
  const planId = sp.get('planId') ?? ''
  const deptoId = sp.get('deptoId') ?? ''
  const anio = Number(sp.get('anio') ?? '0')
  const mes = Number(sp.get('mes') ?? '0')

  const [loading, setLoading] = useState(false)
  const [loadingDetalle, setLoadingDetalle] = useState(false)

  const [versiones, setVersiones] = useState<VersionRow[]>([])
  const [versionSel, setVersionSel] = useState<string>('')

  const [detalle, setDetalle] = useState<DetalleVersionRow[]>([])
  const [laboresMap, setLaboresMap] = useState<Map<number, Labor>>(new Map())

  const card = 'rounded-xl border border-gray-200 shadow-sm bg-white'
  const btn =
    'rounded-lg px-3 py-2 text-sm font-medium border border-green-700 bg-green-700 text-white hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed'
  const btnGhost =
    'rounded-lg px-3 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
  const selectCls =
    'border border-gray-300 rounded-lg px-2 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-200'

  // ===========================
  // Cargar labores (para nombres)
  // ===========================
  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabase
          .from('labores')
          .select('codigo, nombre, grupo, subgrupo')
          .eq('activo', true)

        if (error) throw error

        const m = new Map<number, Labor>()
        ;((data ?? []) as Labor[]).forEach((l) => {
          m.set(Number(l.codigo), l)
        })
        setLaboresMap(m)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido'
        toast.error('Error cargando labores', { description: msg })
      }
    }
    run()
  }, [])

  // ===========================
  // Cargar versiones
  // ===========================
  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        if (!planId && (!deptoId || !anio || !mes)) {
          setVersiones([])
          setVersionSel('')
          setDetalle([])
          return
        }

        let q = supabase
          .from('plan_versiones')
          .select('id, plan_id, depto_id, anio, mes, created_at, created_by, comentario')
          .order('created_at', { ascending: false })

        if (planId) q = q.eq('plan_id', planId)
        if (!planId && deptoId) q = q.eq('depto_id', deptoId)
        if (!planId && anio) q = q.eq('anio', anio)
        if (!planId && mes) q = q.eq('mes', mes)

        const { data, error } = await q
        if (error) throw error

        const rows = (data ?? []) as VersionRow[]
        setVersiones(rows)

        // auto-seleccionar la más reciente
        if (rows.length > 0) setVersionSel(rows[0].id)
        else {
          setVersionSel('')
          setDetalle([])
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido'
        toast.error('Error cargando versiones', { description: msg })
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [planId, deptoId, anio, mes])

  // ===========================
  // Cargar detalle de versión seleccionada
  // ===========================
  useEffect(() => {
    const run = async () => {
      if (!versionSel) {
        setDetalle([])
        return
      }

      setLoadingDetalle(true)
      try {
        const { data, error } = await supabase
          .from('plan_detalle_versiones')
          .select(
            'version_id, fecha, linea, lote_id, red_id, sector_id, codigo_labor, ratio, ha_prog, jornales_prog, obs'
          )
          .eq('version_id', versionSel)
          .order('fecha')
          .order('linea')

        if (error) throw error
        setDetalle((data ?? []) as DetalleVersionRow[])
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error desconocido'
        toast.error('No se pudo cargar la versión', { description: msg })
        setDetalle([])
      } finally {
        setLoadingDetalle(false)
      }
    }

    run()
  }, [versionSel])

  // ===========================
  // Totales por día
  // ===========================
  const totalesPorFecha = useMemo(() => {
    const m = new Map<string, { ha: number; jornales: number; count: number }>()
    for (const r of detalle) {
      const f = String(r.fecha ?? '').slice(0, 10)
      if (!f) continue
      const prev = m.get(f) ?? { ha: 0, jornales: 0, count: 0 }
      prev.ha += toNumber(r.ha_prog)
      prev.jornales += toNumber(r.jornales_prog)
      prev.count += 1
      m.set(f, prev)
    }
    return m
  }, [detalle])

  const totalHA = useMemo(() => detalle.reduce((a, r) => a + toNumber(r.ha_prog), 0), [detalle])
  const totalJ = useMemo(() => detalle.reduce((a, r) => a + toNumber(r.jornales_prog), 0), [detalle])

  // ===========================
  // Exportar CSV
  // ===========================
  const exportarCSV = () => {
    if (!versionSel) return

    const header = [
      'version_id',
      'fecha',
      'linea',
      'lote_id',
      'red_id',
      'sector_id',
      'codigo_labor',
      'labor',
      'grupo',
      'subgrupo',
      'ha_prog',
      'ratio',
      'jornales_prog',
      'obs',
    ].join(',')

    const lines = detalle.map((r) => {
      const lab = r.codigo_labor ? laboresMap.get(r.codigo_labor) : undefined
      const row = [
        r.version_id,
        String(r.fecha ?? '').slice(0, 10),
        r.linea ?? '',
        r.lote_id ?? '',
        r.red_id ?? '',
        r.sector_id ?? '',
        r.codigo_labor ?? '',
        lab?.nombre ?? '',
        lab?.grupo ?? '',
        lab?.subgrupo ?? '',
        toNumber(r.ha_prog),
        toNumber(r.ratio),
        toNumber(r.jornales_prog),
        r.obs ?? '',
      ]
      return row.map(escapeCsv).join(',')
    })

    const csv = [header, ...lines].join('\n')
    downloadTextFile(`version_${anio}_${pad2(mes)}_${versionSel}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const volverAPlan = () => {
    // vuelve con filtros (si los pasaste)
    const qs = new URLSearchParams()
    if (anio) qs.set('anio', String(anio))
    if (mes) qs.set('mes', String(mes))
    if (deptoId) qs.set('deptoId', deptoId)
    // si tú manejas el plan solo por depto/anio/mes, basta.
    router.push(`/plan-mensual${qs.toString() ? `?${qs.toString()}` : ''}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] p-4 space-y-4">
        {/* Header */}
        <div className={`${card} p-4 sticky top-0 z-50 backdrop-blur`} style={{ backgroundColor: 'rgba(255,255,255,0.98)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-gray-800">VERSIONES DE PLAN</div>
              <div className="text-xs text-gray-500 mt-1">
                {anio && mes ? (
                  <>
                    Periodo: <b className="text-gray-800">{anio}-{pad2(mes)}</b>
                  </>
                ) : (
                  <>Selecciona una versión</>
                )}
              </div>
            </div>

            <div className="text-right text-xs text-gray-500">
              <div>
                Total HA: <b className="text-gray-800">{fmt2(totalHA)}</b> · Total Jornales:{' '}
                <b className="text-gray-800">{fmt2(totalJ)}</b>
              </div>
              <div className="mt-2 flex gap-2 justify-end">
                <button className={btnGhost} onClick={exportarCSV} disabled={!versionSel}>
                  Exportar Excel (CSV)
                </button>
                <button className={btnGhost} onClick={() => window.print()}>
                  Exportar PDF (Imprimir)
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col min-w-[420px]">
              <label className="text-xs text-gray-600">Versión</label>
              <select
                className={selectCls}
                value={versionSel}
                onChange={(e) => setVersionSel(e.target.value)}
                disabled={loading || versiones.length === 0}
              >
                {versiones.length === 0 ? <option value="">Sin versiones</option> : null}
                {versiones.map((v) => (
                  <option key={v.id} value={v.id}>
                    {new Date(v.created_at).toLocaleString()} — {v.created_by ?? 'usuario'} {v.comentario ? `— ${v.comentario}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button className={btnGhost} onClick={volverAPlan}>
              Volver al plan
            </button>

            <div className="ml-auto text-xs text-gray-500">
              {loading ? 'Cargando versiones...' : versiones.length ? `${versiones.length} versión(es)` : 'No hay versiones'}
            </div>
          </div>
        </div>

        {/* Tabla detalle */}
        <div className={`${card} p-4`}>
          <div className="flex items-center justify-between">
            <div className="text-base font-bold text-gray-800">Detalle de la versión</div>
            <div className="text-xs text-gray-500">{loadingDetalle ? 'Cargando detalle...' : `${detalle.length} fila(s)`}</div>
          </div>

          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm border-collapse table-fixed">
              <thead>
                <tr>
                  <th className="border px-2 py-2 bg-gray-50 text-gray-700 font-semibold w-28">Fecha</th>
                  <th className="border px-2 py-2 bg-gray-50 text-gray-700 font-semibold w-14">#</th>
                  <th className="border px-2 py-2 bg-gray-50 text-gray-700 font-semibold min-w-[380px]">Labor</th>
                  <th className="border px-2 py-2 bg-gray-50 text-gray-700 font-semibold min-w-[260px]">Ubicación</th>
                  <th className="border px-2 py-2 bg-gray-50 text-gray-700 font-semibold w-24">HA</th>
                  <th className="border px-2 py-2 bg-gray-50 text-gray-700 font-semibold w-24">Ratio</th>
                  <th className="border px-2 py-2 bg-gray-50 text-gray-700 font-semibold w-28">Jornales</th>
                  <th className="border px-2 py-2 bg-gray-50 text-gray-700 font-semibold min-w-[260px]">Obs</th>
                </tr>
              </thead>

              <tbody>
                {detalle.length === 0 ? (
                  <tr>
                    <td className="border px-2 py-6 text-center text-gray-500" colSpan={8}>
                      {versionSel ? 'Sin detalle para esta versión' : 'Selecciona una versión para ver el detalle'}
                    </td>
                  </tr>
                ) : null}

                {detalle.map((r, idx) => {
                  const f = String(r.fecha ?? '').slice(0, 10)
                  const lab = r.codigo_labor ? laboresMap.get(r.codigo_labor) : undefined
                  const ub =
                    `${r.lote_id ?? ''}` +
                    `${r.red_id ? ` / ${r.red_id}` : ''}` +
                    `${r.sector_id ? ` / ${r.sector_id}` : ''}`

                  return (
                    <tr key={`${r.version_id}-${idx}`} className="hover:bg-green-50/30">
                      <td className="border px-2 py-1">{f}</td>
                      <td className="border px-2 py-1 text-center">{r.linea ?? ''}</td>
                      <td className="border px-2 py-1">
                        {r.codigo_labor ? (
                          <>
                            <b>{r.codigo_labor}</b> — {lab?.nombre ?? '(sin nombre)'}
                            <div className="text-xs text-gray-500">
                              {lab?.subgrupo ? `Subgrupo: ${lab.subgrupo}` : ''} {lab?.grupo ? `· Grupo: ${lab.grupo}` : ''}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">Sin labor</span>
                        )}
                      </td>
                      <td className="border px-2 py-1 truncate" title={ub}>
                        {ub || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="border px-2 py-1 text-right">{fmt2(toNumber(r.ha_prog))}</td>
                      <td className="border px-2 py-1 text-right">{fmt2(toNumber(r.ratio))}</td>
                      <td className="border px-2 py-1 text-right">{fmt2(toNumber(r.jornales_prog))}</td>
                      <td className="border px-2 py-1">{r.obs ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Resumen por día (opcional y liviano) */}
          {totalesPorFecha.size > 0 ? (
            <div className="mt-4 text-xs text-gray-600">
              <b>Totales por día:</b>{' '}
              {Array.from(totalesPorFecha.entries())
                .slice(0, 12)
                .map(([f, t]) => `${f} (HA ${fmt2(t.ha)} · J ${fmt2(t.jornales)})`)
                .join(' · ')}
              {totalesPorFecha.size > 12 ? ' · ...' : ''}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}