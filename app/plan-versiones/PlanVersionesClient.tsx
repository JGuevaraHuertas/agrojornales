'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

type PlanVersionRow = {
  id: string
  plan_id: string
  version_nro: number | null
  created_at: string | null
  created_by_email: string | null
  comentario?: string | null
}

type PlanVersionUI = PlanVersionRow & { ui_nro: number }

function pad2(n: number) {
  const v = Number.isFinite(n) ? n : 0
  return String(v).padStart(2, '0')
}

function fmtFechaHora(iso: string | null) {
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

  return `${dd}/${mm}/${yyyy}, ${hh}:${min} ${ampm}`
}

function toTime(iso: string | null) {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

export default function PlanVersionesClient() {
  const router = useRouter()
  const sp = useSearchParams()

  const planId = sp.get('plan_id') ?? ''
  const anio = sp.get('anio') ?? ''
  const mes = sp.get('mes') ?? ''
  const deptoId = sp.get('depto_id') ?? ''

  // ✅ Ruta de detalle (asegúrate de que exista app/plan-version-detalle/page.tsx)
  const DETAIL_PATH = '/plan-version-detalle'

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [versiones, setVersiones] = useState<PlanVersionUI[]>([])

  // estilos similares a tu app (verde/gris)
  const card = 'rounded-xl border border-gray-200 shadow-sm bg-white'
  const clickableCard = 'cursor-pointer hover:border-green-300 hover:shadow-md transition'
  const btn =
    'rounded-lg px-3 py-2 text-sm font-medium border border-green-700 bg-green-700 text-white hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed'

  const contexto = useMemo(() => {
    const m = mes ? pad2(Number(mes)) : ''
    return `Contexto: Año ${anio}${m ? ` · Mes ${m}` : ''}${deptoId ? ` · Depto ${deptoId}` : ''}`
  }, [anio, mes, deptoId])

  const goToDetalle = (v: PlanVersionUI) => {
    if (!planId) return

    const qs = new URLSearchParams({
      version_id: v.id,
      plan_id: planId,
      anio,
      mes,
      depto_id: deptoId,
      version_nro: String(v.ui_nro),
    }).toString()

    router.push(`${DETAIL_PATH}?${qs}`)
  }

  useEffect(() => {
    const run = async () => {
      setErrorMsg('')
      setLoading(true)

      try {
        if (!planId) {
          setVersiones([])
          setErrorMsg('Falta plan_id en la URL.')
          return
        }

        const { data, error } = await supabase
          .from('plan_versiones')
          .select('id, plan_id, version_nro, created_at, created_by_email, comentario')
          .eq('plan_id', planId)
          .order('created_at', { ascending: false })
          .order('version_nro', { ascending: false })

        if (error) throw error

        const rows = (data ?? []) as PlanVersionRow[]

        // Orden extra por seguridad
        rows.sort((a, b) => {
          const tb = toTime(b.created_at)
          const ta = toTime(a.created_at)
          if (tb !== ta) return tb - ta

          const nb = typeof b.version_nro === 'number' ? b.version_nro : -1
          const na = typeof a.version_nro === 'number' ? a.version_nro : -1
          return nb - na
        })

        // Si hay nulls en version_nro, asignamos un nro solo para UI
        const maxN = rows.reduce((mx, r) => {
          const n = typeof r.version_nro === 'number' ? r.version_nro : 0
          return n > mx ? n : mx
        }, 0)

        let next = maxN + 1
        const rowsUi: PlanVersionUI[] = rows.map((r) => {
          const ui_nro = typeof r.version_nro === 'number' ? r.version_nro : next++
          return { ...r, ui_nro }
        })

        setVersiones(rowsUi)
      } catch (e: unknown) {
        console.error(e)
        const msg = e instanceof Error ? e.message : 'Error al cargar versiones'
        setErrorMsg(msg)
        toast.error('No se pudo cargar versiones', { description: msg })
        setVersiones([])
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [planId])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-extrabold text-gray-800">VERSIONES DE PLAN</div>
            <div className="text-sm text-gray-600 mt-1">{contexto}</div>
          </div>

          <button
            className={btn}
            onClick={() => router.push(`/plan-mensual?anio=${anio}&mes=${mes}&depto_id=${deptoId}`)}
          >
            Volver al plan
          </button>
        </div>

        {errorMsg ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMsg}</div>
        ) : null}

        {loading ? <div className={`${card} p-4 text-sm text-gray-600`}>Cargando versiones…</div> : null}

        {!loading && versiones.length === 0 ? (
          <div className={`${card} p-4 text-sm text-gray-600`}>Sin versiones</div>
        ) : null}

        <div className="space-y-3">
          {versiones.map((v) => (
            <div
              key={v.id}
              className={`${card} ${clickableCard} p-4`}
              role="button"
              tabIndex={0}
              onClick={() => goToDetalle(v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  goToDetalle(v)
                }
              }}
              title="Ver detalle de esta versión"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-bold text-gray-800">Versión {v.ui_nro}</div>
                <div className="text-xs text-green-700 font-semibold">Ver detalle →</div>
              </div>

              <div className="text-xs text-gray-500 mt-1">{fmtFechaHora(v.created_at)}</div>
              <div className="text-xs text-gray-500">Por: {v.created_by_email ?? '-'}</div>

              {v.comentario ? <div className="text-sm text-gray-700 mt-2">{v.comentario}</div> : null}
            </div>
          ))}
        </div>

        <div className="text-[11px] text-gray-500">
          * Si alguna versión llega con <b>version_nro = null</b>, el sistema le asigna un número solo para mostrar.
        </div>
      </div>
    </div>
  )
}
