'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

type VersionRow = {
  id: string
  plan_id: string
  version_nro: number | null
  created_at: string | null
  created_by: string | null
  nota: string | null
}

type VersionDetalleRow = {
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

function toNum(v: unknown) {
  const n = Number(String(v ?? '0'))
  return Number.isFinite(n) ? n : 0
}

export default function PlanVersionesPage() {
  const router = useRouter()
  const sp = useSearchParams()

  const plan_id = sp.get('plan_id') ?? ''
  const anio = sp.get('anio') ?? ''
  const mes = sp.get('mes') ?? ''
  const depto_id = sp.get('depto_id') ?? ''

  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const [versiones, setVersiones] = useState<VersionRow[]>([])
  const [versionSelId, setVersionSelId] = useState<string>('')

  const [detalle, setDetalle] = useState<VersionDetalleRow[]>([])

  // Totales (del detalle cargado)
  const totalHA = useMemo(() => detalle.reduce((a, r) => a + toNum(r.ha_prog), 0), [detalle])
  const totalJornales = useMemo(() => detalle.reduce((a, r) => a + toNum(r.jornales_prog), 0), [detalle])

  // ==========================
  // Cargar versiones
  // ==========================
  useEffect(() => {
    const run = async () => {
      if (!plan_id) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('plan_versiones')
          .select('id, plan_id, version_nro, created_at, created_by, nota')
          .eq('plan_id', plan_id)
          .order('version_nro', { ascending: false })

        if (error) throw error

        const arr = (data ?? []) as VersionRow[]
        setVersiones(arr)

        // si hay versiones, selecciona la más reciente por defecto
        if (arr.length > 0) setVersionSelId(arr[0].id)
        else setVersionSelId('')
      } catch (e: any) {
        console.error(e)
        toast.error('No se pudo cargar versiones', { description: e?.message ?? 'Error' })
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [plan_id])

  // ==========================
  // Cargar detalle de la versión seleccionada
  // ==========================
  useEffect(() => {
    const run = async () => {
      if (!versionSelId) {
        setDetalle([])
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('plan_version_detalle')
          .select('fecha, linea, lote_id, red_id, sector_id, codigo_labor, ratio, ha_prog, jornales_prog, obs')
          .eq('version_id', versionSelId)
          .order('fecha', { ascending: true })
          .order('linea', { ascending: true })

        if (error) throw error
        setDetalle((data ?? []) as VersionDetalleRow[])
      } catch (e: any) {
        console.error(e)
        toast.error('No se pudo cargar el detalle', { description: e?.message ?? 'Error' })
        setDetalle([])
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [versionSelId])

  // ==========================
  // ✅ CREAR VERSIÓN (snapshot)
  // ==========================
  const crearVersion = async () => {
    if (!plan_id) {
      toast.error('Falta plan_id')
      return
    }

    setCreating(true)
    try {
      // 1) Usuario actual
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      const email = authData.user?.email ?? null

      // 2) Calcular siguiente version_nro
      const maxNro = versiones.reduce((m, v) => Math.max(m, toNum(v.version_nro)), 0)
      const nextNro = maxNro + 1

      // 3) Insertar cabecera de versión
      const { data: vIns, error: vErr } = await supabase
        .from('plan_versiones')
        .insert({
          plan_id,
          version_nro: nextNro,
          created_by: email,
          nota: null,
        })
        .select('id, version_nro')
        .single()

      if (vErr) throw vErr
      const version_id = vIns.id as string

      // 4) Leer snapshot desde plan_detalle (plan actual)
      const { data: planDet, error: detErr } = await supabase
        .from('plan_detalle')
        .select('fecha, linea, lote_id, red_id, sector_id, codigo_labor, ratio, ha_prog, jornales_prog, obs')
        .eq('plan_id', plan_id)
        .order('fecha', { ascending: true })
        .order('linea', { ascending: true })

      if (detErr) throw detErr

      const rows = (planDet ?? []) as VersionDetalleRow[]

      if (rows.length === 0) {
        // Si no hay detalle, igual queda creada la versión vacía (por si quieres)
        toast.message('Versión creada, pero el plan está vacío', {
          description: `Versión v${nextNro} (sin detalle)`,
        })
      } else {
        // 5) Insertar detalle de versión
        const payload = rows.map((r) => ({
          version_id,
          fecha: r.fecha,
          linea: r.linea,
          lote_id: r.lote_id,
          red_id: r.red_id,
          sector_id: r.sector_id,
          codigo_labor: r.codigo_labor,
          ratio: r.ratio,
          ha_prog: r.ha_prog,
          jornales_prog: r.jornales_prog,
          obs: r.obs ?? '',
        }))

        // Insert por chunks por si hay muchos registros
        const CHUNK = 500
        for (let i = 0; i < payload.length; i += CHUNK) {
          const part = payload.slice(i, i + CHUNK)
          const { error: insErr } = await supabase.from('plan_version_detalle').insert(part)
          if (insErr) throw insErr
        }

        toast.success('Versión creada ✅', {
          description: `Se creó la versión v${nextNro} con ${rows.length} fila(s).`,
        })
      }

      // 6) Recargar versiones y seleccionar la recién creada
      const { data: vers2, error: vers2Err } = await supabase
        .from('plan_versiones')
        .select('id, plan_id, version_nro, created_at, created_by, nota')
        .eq('plan_id', plan_id)
        .order('version_nro', { ascending: false })

      if (vers2Err) throw vers2Err
      const arr2 = (vers2 ?? []) as VersionRow[]
      setVersiones(arr2)
      setVersionSelId(version_id)
    } catch (e: any) {
      console.error(e)
      toast.error('No se pudo crear versión', { description: e?.message ?? 'Error' })
    } finally {
      setCreating(false)
    }
  }

  const volverAlPlan = () => {
    // Si quieres volver con query:
    // router.push(`/plan-mensual?anio=${anio}&mes=${mes}&depto_id=${depto_id}`)
    router.push('/plan-mensual')
  }

  const exportarCSV = () => {
    if (!detalle.length) return
    const header = ['fecha', 'linea', 'lote_id', 'red_id', 'sector_id', 'codigo_labor', 'ratio', 'ha_prog', 'jornales_prog', 'obs'].join(',')
    const lines = detalle.map((r) =>
      [
        String(r.fecha ?? '').slice(0, 10),
        toNum(r.linea),
        r.lote_id ?? '',
        r.red_id ?? '',
        r.sector_id ?? '',
        r.codigo_labor ?? '',
        toNum(r.ratio),
        toNum(r.ha_prog),
        toNum(r.jornales_prog),
        String(r.obs ?? '').replace(/"/g, '""'),
      ].join(',')
    )
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plan_version_${plan_id}_${versionSelId}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportarPDF = () => window.print()

  const card = 'rounded-xl border border-gray-200 shadow-sm'
  const btn =
    'rounded-lg px-3 py-2 text-sm font-medium border border-green-700 bg-green-700 text-white hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed'
  const btnGhost =
    'rounded-lg px-3 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed'
  const selectCls =
    'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-200'
  const tableTh = 'border px-2 py-2 bg-gray-50 text-gray-700 font-semibold whitespace-nowrap'
  const tableTd = 'border px-2 py-1 align-top'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] p-4 space-y-4">
        {/* CABECERA */}
        <div className={`${card} bg-white p-4`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-gray-800">VERSIONES DE PLAN</div>
              <div className="text-xs text-gray-500 mt-1">Selecciona una versión</div>
            </div>

            <div className="text-right text-xs text-gray-500">
              <div className="mt-1">
                <span className="text-gray-500">Total HA:</span> <b className="text-gray-800">{totalHA.toFixed(2)}</b>{' '}
                <span className="text-gray-500 ml-3">Total Jornales:</span> <b className="text-gray-800">{totalJornales.toFixed(2)}</b>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col min-w-[360px]">
              <label className="text-xs text-gray-600">Versión</label>
              <select
                className={selectCls}
                value={versionSelId}
                onChange={(e) => setVersionSelId(e.target.value)}
                disabled={loading}
              >
                <option value="">{versiones.length ? 'Selecciona...' : 'Sin versiones'}</option>
                {versiones.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{toNum(v.version_nro)} · {v.created_at ? new Date(v.created_at).toLocaleString() : ''} · {v.created_by ?? ''}
                  </option>
                ))}
              </select>
            </div>

            {/* ✅ BOTÓN CREAR VERSIÓN */}
            <button className={btn} onClick={crearVersion} disabled={creating || !plan_id}>
              {creating ? 'Creando...' : 'Crear versión'}
            </button>

            <button className={btnGhost} onClick={volverAlPlan}>
              Volver al plan
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button className={btnGhost} onClick={exportarCSV} disabled={!detalle.length}>
                Exportar Excel (CSV)
              </button>
              <button className={btnGhost} onClick={exportarPDF}>
                Exportar PDF (Imprimir)
              </button>
            </div>
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {anio && mes && depto_id ? (
              <span>
                Contexto: Año <b>{anio}</b> · Mes <b>{mes}</b> · Depto <b>{depto_id}</b>
              </span>
            ) : null}
          </div>
        </div>

        {/* DETALLE */}
        <div className={`${card} bg-white p-4`}>
          <div className="flex items-center justify-between">
            <div className="font-bold text-gray-800">Detalle de la versión</div>
            <div className="text-xs text-gray-500">{detalle.length} fila(s)</div>
          </div>

          <div className="mt-3 overflow-auto">
            <table className="w-full text-sm border-collapse table-fixed">
              <thead>
                <tr>
                  <th className={`${tableTh} w-32`}>Fecha</th>
                  <th className={`${tableTh} w-12`}>#</th>
                  <th className={`${tableTh} min-w-[320px]`}>Labor</th>
                  <th className={`${tableTh} min-w-[320px]`}>Ubicación</th>
                  <th className={`${tableTh} w-28`}>HA</th>
                  <th className={`${tableTh} w-28`}>Ratio</th>
                  <th className={`${tableTh} w-28`}>Jornales</th>
                  <th className={`${tableTh} min-w-[260px]`}>Obs</th>
                </tr>
              </thead>

              <tbody>
                {!versionSelId ? (
                  <tr>
                    <td className="border px-2 py-6 text-center text-gray-500" colSpan={8}>
                      Selecciona una versión para ver el detalle
                    </td>
                  </tr>
                ) : detalle.length === 0 ? (
                  <tr>
                    <td className="border px-2 py-6 text-center text-gray-500" colSpan={8}>
                      No hay filas en esta versión
                    </td>
                  </tr>
                ) : (
                  detalle.map((r, idx) => (
                    <tr key={`${r.fecha}-${r.linea}-${idx}`} className="hover:bg-green-50/30">
                      <td className={tableTd}>{String(r.fecha ?? '').slice(0, 10)}</td>
                      <td className={`${tableTd} text-center`}>{toNum(r.linea)}</td>
                      <td className={tableTd}>
                        <span className="text-gray-700">Código:</span> <b>{r.codigo_labor ?? '-'}</b>
                      </td>
                      <td className={tableTd}>
                        <b>{r.lote_id ?? '-'}</b> · {r.red_id ?? '-'} · {r.sector_id ?? '-'}
                      </td>
                      <td className={`${tableTd} text-right`}>{toNum(r.ha_prog).toFixed(2)}</td>
                      <td className={`${tableTd} text-right`}>{toNum(r.ratio).toFixed(2)}</td>
                      <td className={`${tableTd} text-right`}>{toNum(r.jornales_prog).toFixed(2)}</td>
                      <td className={tableTd}>{r.obs ?? ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DEBUG (si te sirve) */}
        {!plan_id ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            Falta <b>plan_id</b> en la URL. Debes entrar desde el botón “Versiones” del plan mensual.
          </div>
        ) : null}
      </div>
    </div>
  )
}