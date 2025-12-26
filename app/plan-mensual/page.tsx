'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

type Depto = {
  id: string
  departamento: string | null
  jefe: string | null
  cultivo: string | null
  fundo: string | null
  activo: boolean | null
}

type Labor = {
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

type Lote = {
  lote_id: string
  cultivo: string | null
  fundo: string | null
  ha_total: number | null
  activo: boolean | null
}

type Red = {
  red_ref: string | null
  lote_id: string
  red_id: string
}

type Sector = {
  sector_id: string
  lote_id: string
  red_id: string
  ha: number | null
  variedad: string | null
}

type ModoJornales = 'AUTO' | 'MANUAL'

type FilaUI = {
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

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function generarDiasDelMes(anio: number, mes: number): string[] {
  const last = new Date(anio, mes, 0)
  const days: string[] = []
  for (let d = 1; d <= last.getDate(); d++) days.push(`${anio}-${pad2(mes)}-${pad2(d)}`)
  return days
}

function toNumber(v: any): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim()
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** "R01_L01_Pal:R01" => "R01_L01" */
function formatRedId(raw: string) {
  if (!raw) return ''
  let x = raw.split(':')[0]
  x = x.replace(/_PALTO|_PAL|_ARANDANOS|_ARANDANO|_ARA/gi, '')
  x = x.replace(/__+/g, '_').replace(/_$/g, '')
  return x
}

/**
 * "L05_ARA_R01_S02" => "S2"
 * Solo para mostrar en UI (el value sigue siendo sector_id completo)
 */
function formatSectorLabel(raw: string) {
  const s = String(raw ?? '').trim()
  if (!s) return ''

  // Caso típico: termina en _S02 o -S02
  let m = s.match(/(?:_|-)S(\d+)$/i)
  if (m?.[1]) return `S${Number(m[1])}`

  // Fallback: cualquier S##
  m = s.match(/S(\d+)/i)
  if (m?.[1]) return `S${Number(m[1])}`

  return s
}

function normKey(v: any) {
  return String(v ?? '').trim().toUpperCase()
}

function labelDepto(d: Depto) {
  const dep = String(d.departamento ?? '').trim()
  const cul = String(d.cultivo ?? '').trim()
  return cul ? `${dep} - ${cul}` : dep
}

export default function PlanMensualPage() {
  const router = useRouter()

  const now = new Date()
  const [anio, setAnio] = useState<number>(now.getFullYear())
  const [mes, setMes] = useState<number>(now.getMonth() + 1)

  const [userEmail, setUserEmail] = useState<string>('')
  const [userRol, setUserRol] = useState<string>('')

  const [deptos, setDeptos] = useState<Depto[]>([])
  const [deptoSel, setDeptoSel] = useState<Depto | null>(null)

  const [labores, setLabores] = useState<Labor[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [redes, setRedes] = useState<Red[]>([])
  const [sectores, setSectores] = useState<Sector[]>([])

  const [planId, setPlanId] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)

  const [dias, setDias] = useState<string[]>([])
  const [filas, setFilas] = useState<Record<string, FilaUI[]>>({})

  const [errorMsg, setErrorMsg] = useState<string>('')
  const [guardando, setGuardando] = useState(false)

  const guardandoRef = useRef(false)
  const loadDetalleTokenRef = useRef(0)

  const [fechaOrigen, setFechaOrigen] = useState<string>('')
  const [fechaDestino, setFechaDestino] = useState<string>('')

  // ============================
  // Estilos (verde/gris)
  // ============================
  const panelBg = 'bg-white/95'
  const card = 'rounded-xl border border-gray-200 shadow-sm'
  const btn =
    'rounded-lg px-3 py-2 text-sm font-medium border border-green-700 bg-green-700 text-white hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed'
  const btnGhost =
    'rounded-lg px-3 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'

  const selectCls =
    'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-200'
  const inputCls =
    'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-200'
  const tableTh = 'border px-2 py-2 bg-gray-50 text-gray-700 font-semibold whitespace-nowrap'
  const tableTd = 'border px-2 py-1 align-top'

  // ============================================================
  // dedupe deptos por (departamento + cultivo)
  // ============================================================
  const dedupeDeptos = (data: any[]): Depto[] => {
    const m = new Map<string, any>()
    for (const d of data ?? []) {
      const key = `${normKey(d.departamento)}|${normKey(d.cultivo)}`
      if (!m.has(key)) m.set(key, d)
    }
    return Array.from(m.values()) as Depto[]
  }

  // ============================================================
  // 1) Cargar deptos según usuario
  // ============================================================
  useEffect(() => {
    const run = async () => {
      setErrorMsg('')

      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) {
        console.error(authErr)
        setErrorMsg(authErr.message)
        return
      }

      const email = authData.user?.email ?? ''
      setUserEmail(email)

      if (!email) {
        setDeptos([])
        setDeptoSel(null)
        setErrorMsg('No hay usuario logueado.')
        return
      }

      const { data: perfil, error: perErr } = await supabase
        .from('profiles')
        .select('rol')
        .eq('email', email)
        .maybeSingle()

      if (perErr) {
        console.error(perErr)
        setErrorMsg(perErr.message)
        return
      }

      const rol = String(perfil?.rol ?? '').toUpperCase()
      setUserRol(rol)

      if (rol === 'ADMIN') {
        const { data, error } = await supabase
          .from('deptos')
          .select('id, departamento, jefe, cultivo, fundo, activo')
          .eq('activo', true)
          .order('departamento')
          .order('cultivo')

        if (error) {
          console.error(error)
          setErrorMsg(error.message)
          return
        }

        const unicos = dedupeDeptos(data ?? [])
        setDeptos(unicos)
        if (unicos.length === 1) setDeptoSel(unicos[0])
        return
      }

      // NO admin
      const emailKey = String(email).trim().toLowerCase()
      const { data: accesos, error: accErr } = await supabase
        .from('jefes_acceso_v2')
        .select('depto_id, email')
        .eq('activo (boolean)', true)

      if (accErr) {
        console.error(accErr)
        setErrorMsg(accErr.message)
        return
      }

      const accesosUser = (accesos ?? []).filter(
        (a: any) => String(a.email ?? '').trim().toLowerCase() === emailKey
      )

      const ids = accesosUser.map((x: any) => x.depto_id).filter(Boolean)

      if (ids.length === 0) {
        setDeptos([])
        setDeptoSel(null)
        setErrorMsg(`No tienes departamentos asignados en jefes_acceso para: ${emailKey}`)
        return
      }

      const { data: dataDeptos, error: depErr } = await supabase
        .from('deptos')
        .select('id, departamento, jefe, cultivo, fundo, activo')
        .in('id', ids)
        .eq('activo', true)
        .order('departamento')
        .order('cultivo')

      if (depErr) {
        console.error(depErr)
        setErrorMsg(depErr.message)
        return
      }

      const unicos = dedupeDeptos(dataDeptos ?? [])
      setDeptos(unicos)
      if (unicos.length === 1) setDeptoSel(unicos[0])
    }

    run()
  }, [])

  // ============================================================
  // 2) Inicializar días del mes
  // ============================================================
  useEffect(() => {
    const d = generarDiasDelMes(anio, mes)
    setDias(d)

    setFilas((prev) => {
      const next: Record<string, FilaUI[]> = { ...prev }
      for (const fecha of d) if (!next[fecha]) next[fecha] = []
      for (const k of Object.keys(next)) if (!d.includes(k)) delete next[k]
      return next
    })

    setFechaOrigen('')
    setFechaDestino('')
  }, [anio, mes])

  // ============================================================
  // 3) Cargar catálogos al elegir depto
  // ============================================================
  useEffect(() => {
    if (!deptoSel) return

    const run = async () => {
      setErrorMsg('')
      setLabores([])
      setLotes([])
      setRedes([])
      setSectores([])

      const deptoName = String(deptoSel.departamento ?? '').trim()
      const cultivoSel = String(deptoSel.cultivo ?? '').trim()

      const qLab = supabase
        .from('labores')
        .select('codigo, nombre, departamento, grupo, subgrupo, cultivo, um, ratio_default, activo')
        .eq('activo', true)
        .eq('departamento', deptoName)
        .eq('cultivo', cultivoSel)

      const qLotes = supabase
        .from('lotes')
        .select('lote_id, cultivo, fundo, ha_total, activo')
        .eq('activo', true)
        .eq('cultivo', cultivoSel)

      const qRedes = supabase.from('redes').select('red_ref, lote_id, red_id')
      const qSect = supabase.from('sectores').select('sector_id, lote_id, red_id, ha, variedad')

      const [r1, r2, r3, r4] = await Promise.all([qLab, qLotes, qRedes, qSect])

      if (r1.error) return setErrorMsg(r1.error.message)
      if (r2.error) return setErrorMsg(r2.error.message)
      if (r3.error) return setErrorMsg(r3.error.message)
      if (r4.error) return setErrorMsg(r4.error.message)

      setLabores((r1.data ?? []) as Labor[])
      setLotes((r2.data ?? []) as Lote[])
      setRedes((r3.data ?? []) as Red[])
      setSectores((r4.data ?? []) as Sector[])

      // limpiar selecciones en filas cuando cambias depto
      setFilas((prev) => {
        const next: Record<string, FilaUI[]> = {}
        for (const k of Object.keys(prev)) {
          next[k] = (prev[k] ?? []).map((f) => ({
            ...f,
            lote_id: '',
            red_id: '',
            sector_id: '',
            subgrupo_labor: '',
            codigo_labor: null,
            ratio: '0',
            ha_prog: '0',
            jornales_prog: '0',
            modo_jornales: 'MANUAL',
            obs: '',
            obs_open: false,
          }))
        }
        return next
      })
    }

    run()
  }, [deptoSel])

  // ============================================================
  // 4) Asegurar plan
  // ============================================================
  useEffect(() => {
    if (!deptoSel) return

    const run = async () => {
      setLoadingPlan(true)
      setErrorMsg('')
      setPlanId(null)

      const { data: found, error: e1 } = await supabase
        .from('planes')
        .select('id')
        .eq('anio', anio)
        .eq('mes', mes)
        .eq('depto_id', deptoSel.id)
        .maybeSingle()

      if (e1) {
        console.error(e1)
        setErrorMsg(e1.message)
        setLoadingPlan(false)
        return
      }

      if (found?.id) {
        setPlanId(found.id)
        setLoadingPlan(false)
        return
      }

      const { data: created, error: e2 } = await supabase
        .from('planes')
        .insert({
          anio,
          mes,
          depto_id: deptoSel.id,
          jefe: deptoSel.jefe ?? null,
          estado: 'BORRADOR',
        })
        .select('id')
        .single()

      if (e2) {
        console.error(e2)
        setErrorMsg(e2.message)
        setLoadingPlan(false)
        return
      }

      setPlanId(created.id)
      setLoadingPlan(false)
    }

    run()
  }, [anio, mes, deptoSel])

  // ============================================================
  // 5) Cargar plan_detalle (idempotente, sin duplicados)
  // ============================================================
  useEffect(() => {
    const run = async () => {
      if (!planId) return
      if (!dias || dias.length === 0) return

      const myToken = ++loadDetalleTokenRef.current
      setErrorMsg('')

      const nextBase: Record<string, FilaUI[]> = {}
      for (const d of dias) nextBase[d] = []

      const { data, error } = await supabase
        .from('plan_detalle')
        .select('fecha, linea, lote_id, red_id, sector_id, codigo_labor, ratio, ha_prog, jornales_prog, obs')
        .eq('plan_id', planId)
        .order('fecha')
        .order('linea')

      if (myToken !== loadDetalleTokenRef.current) return

      if (error) {
        console.error(error)
        setErrorMsg(error.message)
        setFilas(nextBase)
        return
      }

      for (const row of data ?? []) {
        const fecha = String((row as any).fecha).slice(0, 10)
        if (!nextBase[fecha]) continue

        const ratioNum = toNumber((row as any).ratio)
        const haNum = toNumber((row as any).ha_prog)
        const jNum = toNumber((row as any).jornales_prog)

        nextBase[fecha].push({
          ui_id: crypto.randomUUID(),
          fecha,
          linea: Number((row as any).linea ?? nextBase[fecha].length + 1),
          lote_id: (row as any).lote_id ?? '',
          red_id: (row as any).red_id ?? '',
          sector_id: (row as any).sector_id ?? '',
          subgrupo_labor: '',
          codigo_labor: (row as any).codigo_labor ?? null,
          ratio: String(ratioNum || 0),
          ha_prog: String(haNum || 0),
          jornales_prog: String(jNum || 0),
          modo_jornales: 'MANUAL',
          obs: (row as any).obs ?? '',
          obs_open: false,
        })
      }

      for (const f of Object.keys(nextBase)) {
        nextBase[f] = (nextBase[f] ?? []).map((x, idx) => ({ ...x, linea: idx + 1 }))
      }

      setFilas(nextBase)
    }

    run()
  }, [planId, dias])

  // ============================================================
  // memos
  // ============================================================
  const laboresByCodigo = useMemo(() => {
    const m = new Map<number, Labor>()
    for (const l of labores) m.set(l.codigo, l)
    return m
  }, [labores])

  const subgruposDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const l of labores) {
      const sg = String(l.subgrupo ?? '').trim()
      if (sg) set.add(sg)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [labores])

  const redesPorLote = useMemo(() => {
    const m = new Map<string, Red[]>()
    for (const r of redes) {
      const arr = m.get(r.lote_id) ?? []
      arr.push(r)
      m.set(r.lote_id, arr)
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => (a.red_id ?? '').localeCompare(b.red_id ?? ''))
      m.set(k, arr)
    }
    return m
  }, [redes])

  const sectoresPorLoteRed = useMemo(() => {
    const m = new Map<string, Sector[]>()
    for (const s of sectores) {
      const key = `${s.lote_id}__${s.red_id}`
      const arr = m.get(key) ?? []
      arr.push(s)
      m.set(key, arr)
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => (a.sector_id ?? '').localeCompare(b.sector_id ?? ''))
      m.set(k, arr)
    }
    return m
  }, [sectores])

  const totalHA = useMemo(
    () => Object.values(filas).flat().reduce((a, r) => a + toNumber(r.ha_prog), 0),
    [filas]
  )
  const totalJornales = useMemo(
    () => Object.values(filas).flat().reduce((a, r) => a + toNumber(r.jornales_prog), 0),
    [filas]
  )

  function renumerar(fecha: string, arr: FilaUI[]) {
    return arr.map((x, idx) => ({ ...x, linea: idx + 1, fecha }))
  }

  function updateFila(fecha: string, ui_id: string, patch: Partial<FilaUI>) {
    setFilas((prev) => {
      const next = { ...prev }
      const arr = [...(next[fecha] ?? [])]
      const i = arr.findIndex((x) => x.ui_id === ui_id)
      if (i === -1) return prev
      arr[i] = { ...arr[i], ...patch }
      next[fecha] = renumerar(fecha, arr)
      return next
    })
  }

  function agregarFila(fecha: string) {
    setFilas((prev) => {
      const next = { ...prev }
      const arr = [...(next[fecha] ?? [])]
      arr.push({
        ui_id: crypto.randomUUID(),
        fecha,
        linea: arr.length + 1,
        lote_id: '',
        red_id: '',
        sector_id: '',
        subgrupo_labor: '',
        codigo_labor: null,
        ratio: '0',
        ha_prog: '0',
        jornales_prog: '0',
        modo_jornales: 'MANUAL',
        obs: '',
        obs_open: false,
      })
      next[fecha] = renumerar(fecha, arr)
      return next
    })
  }

  function duplicarFila(fecha: string, ui_id: string) {
    setFilas((prev) => {
      const next = { ...prev }
      const arr = [...(next[fecha] ?? [])]
      const i = arr.findIndex((x) => x.ui_id === ui_id)
      if (i === -1) return prev
      const base = arr[i]
      arr.splice(i + 1, 0, { ...base, ui_id: crypto.randomUUID(), obs_open: false })
      next[fecha] = renumerar(fecha, arr)
      return next
    })
  }

  function quitarFila(fecha: string, ui_id: string) {
    setFilas((prev) => {
      const next = { ...prev }
      const arr = (next[fecha] ?? []).filter((x) => x.ui_id !== ui_id)
      next[fecha] = renumerar(fecha, arr)
      return next
    })
  }

  function copiarAFEcha(origen: string, destino: string) {
    if (!origen || !destino || origen === destino) return
    setFilas((prev) => {
      const next = { ...prev }
      const src = next[origen] ?? []
      const dst = next[destino] ?? []
      const copias = src.map((x) => ({
        ...x,
        ui_id: crypto.randomUUID(),
        fecha: destino,
        obs_open: false,
      }))
      next[destino] = renumerar(destino, [...dst, ...copias])
      return next
    })
  }

  function moverAFEcha(origen: string, destino: string) {
    if (!origen || !destino || origen === destino) return
    setFilas((prev) => {
      const next = { ...prev }
      const src = next[origen] ?? []
      const dst = next[destino] ?? []
      const moved = src.map((x) => ({ ...x, fecha: destino }))
      next[destino] = renumerar(destino, [...dst, ...moved])
      next[origen] = []
      return next
    })
  }

  // GUARDAR
  const guardar = async () => {
    setErrorMsg('')
    if (!planId) return

    if (guardandoRef.current) return
    guardandoRef.current = true

    setGuardando(true)
    try {
      const flat = Object.values(filas).flat()

      const isRowEmpty = (f: any) => {
        return (
          !f.lote_id &&
          !f.red_id &&
          !f.sector_id &&
          !f.codigo_labor &&
          toNumber(f.ha_prog) === 0 &&
          toNumber(f.jornales_prog) === 0 &&
          !String(f.obs ?? '').trim()
        )
      }

      const invalid = flat.filter((f) => {
        if (isRowEmpty(f)) return false
        const hasLabor = !!f.codigo_labor
        const hasJornales = toNumber(f.jornales_prog) > 0
        return !(hasLabor && hasJornales)
      })

      if (invalid.length > 0) {
        toast.error('No se puede guardar', {
          description: 'Se tiene que seleccionar la labor y registrar los jornales.',
        })
        return
      }

      const rowsPrepared = flat
        .filter((f) => !isRowEmpty(f))
        .map((f) => {
          const lote = String(f.lote_id ?? '').trim()
          const labor = f.codigo_labor
          const jornales = toNumber(f.jornales_prog)

          const red = String(f.red_id ?? '').trim() || null
          const sector = String(f.sector_id ?? '').trim() || null

          return {
            plan_id: planId,
            fecha: f.fecha,
            linea: f.linea,
            lote_id: lote || null,
            red_id: red,
            sector_id: sector,
            codigo_labor: labor,
            ratio: toNumber(f.ratio),
            ha_prog: toNumber(f.ha_prog),
            jornales_prog: jornales,
            obs: f.obs ?? '',
          }
        })

      if (rowsPrepared.length === 0) {
        toast.message('No hay cambios para guardar', {
          description: 'Agrega filas o completa datos antes de guardar.',
        })
        return
      }

      const { error: delErr } = await supabase.from('plan_detalle').delete().eq('plan_id', planId)
      if (delErr) throw delErr

      const { data: insData, error: insErr } = await supabase
        .from('plan_detalle')
        .insert(rowsPrepared)
        .select('id')

      if (insErr) throw insErr

      const savedCount = (insData ?? []).length

      toast.success('Plan guardado correctamente ✅', {
        description: `${savedCount} registro(s) guardado(s)`,
      })
    } catch (e: any) {
      console.error(e)
      setErrorMsg(e?.message ?? 'Error al guardar')
      toast.error('No se pudo guardar', { description: e?.message ?? 'Error al guardar' })
    } finally {
      guardandoRef.current = false
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] p-4 space-y-4">
        {/* ✅ HEADER FIJO */}
        <div
          className={`${card} ${panelBg} p-4 sticky top-0 z-50 backdrop-blur`}
          style={{ backgroundColor: 'rgba(255,255,255,0.98)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-gray-800">PLANIFICACION MENSUAL DE JORNALES GAG</div>
            </div>

            <div className="text-right text-xs text-gray-500">
              <div className="mt-1">
                <span className="text-gray-500">Total HA:</span>{' '}
                <b className="text-gray-800">{totalHA.toFixed(2)}</b>{' '}
                <span className="text-gray-500 ml-3">Total Jornales:</span>{' '}
                <b className="text-gray-800">{totalJornales.toFixed(2)}</b>
              </div>
            </div>
          </div>

          {errorMsg ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {errorMsg}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-gray-600">Año</label>
              <input
                type="number"
                className={`${inputCls} w-28`}
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-gray-600">Mes</label>
              <select
                className={`${selectCls} w-36`}
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {pad2(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col min-w-[320px]">
              <label className="text-xs text-gray-600">Departamento</label>
              <select
                className={selectCls}
                value={deptoSel?.id ?? ''}
                onChange={(e) => {
                  const id = e.target.value
                  const d = deptos.find((x) => x.id === id) ?? null
                  setDeptoSel(d)
                }}
              >
                <option value="">Selecciona...</option>
                {deptos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {labelDepto(d)}
                  </option>
                ))}
              </select>
            </div>

            <button className={btn} onClick={guardar} disabled={!planId || guardando || loadingPlan}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>

            <button className={btnGhost} onClick={() => router.push('/')}>
              Volver
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
            <div className="text-sm font-semibold text-gray-700">Acciones por día:</div>

            <select
              className={`${selectCls} py-1`}
              value={fechaOrigen}
              onChange={(e) => setFechaOrigen(e.target.value)}
            >
              <option value="">Origen...</option>
              {dias.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              className={`${selectCls} py-1`}
              value={fechaDestino}
              onChange={(e) => setFechaDestino(e.target.value)}
            >
              <option value="">Destino...</option>
              {dias.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <button
              className="text-xs font-semibold text-green-800 underline"
              onClick={() => copiarAFEcha(fechaOrigen, fechaDestino)}
              disabled={!fechaOrigen || !fechaDestino || fechaOrigen === fechaDestino}
            >
              Copiar
            </button>

            <button
              className="text-xs font-semibold text-green-800 underline"
              onClick={() => moverAFEcha(fechaOrigen, fechaDestino)}
              disabled={!fechaOrigen || !fechaDestino || fechaOrigen === fechaDestino}
            >
              Mover
            </button>

            <div className="ml-auto text-xs text-gray-500">
              * Lotes y labores se filtran por cultivo del departamento seleccionado.
            </div>
          </div>
        </div>

        {/* ===== DÍAS ===== */}
        <div className="space-y-6">
          {dias.map((fecha) => {
            const rows = filas[fecha] ?? []
            const totalDiaHA = rows.reduce((a, r) => a + toNumber(r.ha_prog), 0)
            const totalDiaJ = rows.reduce((a, r) => a + toNumber(r.jornales_prog), 0)

            return (
              <div key={fecha} className={`${card} bg-white`}>
                <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-gray-800">{fecha}</div>
                    <div className="text-sm text-gray-600">
                      HA: <b className="text-gray-900">{totalDiaHA.toFixed(2)}</b> · Jornales:{' '}
                      <b className="text-gray-900">{totalDiaJ.toFixed(2)}</b>
                    </div>
                  </div>

                  <button className={btnGhost} onClick={() => agregarFila(fecha)}>
                    + Agregar
                  </button>
                </div>

                <div className="p-3 overflow-auto">
                  <table className="w-full text-sm border-collapse table-fixed">
                    <thead>
                      <tr>
                        <th className={`${tableTh} w-12`}>#</th>
                        <th className={`${tableTh} min-w-[340px]`}>Ubicación</th>
                        <th className={`${tableTh} min-w-[190px]`}>Subgrupo</th>
                        <th className={`${tableTh} min-w-[420px]`}>Labor</th>

                        <th className={`${tableTh} w-28 min-w-[112px]`}>Ratio</th>
                        <th className={`${tableTh} w-28 min-w-[112px]`}>HA</th>
                        <th className={`${tableTh} w-28 min-w-[112px]`}>Jornales</th>

                        <th className={`${tableTh} w-28`}>Modo</th>
                        <th className={`${tableTh} w-44`}>Acción</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td className="border px-2 py-3 text-center text-gray-500" colSpan={9}>
                            Sin registros
                          </td>
                        </tr>
                      ) : null}

                      {rows.map((r) => {
                        const redesLote = redesPorLote.get(r.lote_id) ?? []
                        const redKey = `${r.lote_id}__${r.red_id}`
                        const sectoresLR = sectoresPorLoteRed.get(redKey) ?? []

                        return (
                          <>
                            <tr key={r.ui_id} className="hover:bg-green-50/30">
                              <td className={`${tableTd} text-center`}>{r.linea}</td>

                              <td className={tableTd}>
                                <div className="grid grid-cols-3 gap-2">
                                  <select
                                    className={`${selectCls} w-full`}
                                    value={r.lote_id}
                                    onChange={(e) =>
                                      updateFila(fecha, r.ui_id, {
                                        lote_id: e.target.value,
                                        red_id: '',
                                        sector_id: '',
                                      })
                                    }
                                  >
                                    <option value="">Lote...</option>
                                    {lotes.map((l) => (
                                      <option key={l.lote_id} value={l.lote_id}>
                                        {l.lote_id}
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    className={`${selectCls} w-full`}
                                    value={r.red_id}
                                    onChange={(e) =>
                                      updateFila(fecha, r.ui_id, { red_id: e.target.value, sector_id: '' })
                                    }
                                    disabled={!r.lote_id}
                                  >
                                    <option value="">Red...</option>
                                    {redesLote.map((x) => (
                                      <option key={x.red_id} value={x.red_id}>
                                        {formatRedId(x.red_id)}
                                      </option>
                                    ))}
                                  </select>

                                  <select
                                    className={`${selectCls} w-full`}
                                    value={r.sector_id}
                                    onChange={(e) => updateFila(fecha, r.ui_id, { sector_id: e.target.value })}
                                    disabled={!r.lote_id || !r.red_id}
                                  >
                                    <option value="">Sector...</option>
                                    {sectoresLR.map((s) => (
                                      <option key={s.sector_id} value={s.sector_id}>
                                        {formatSectorLabel(s.sector_id)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>

                              <td className={tableTd}>
                                <select
                                  className={`${selectCls} w-full`}
                                  value={r.subgrupo_labor}
                                  onChange={(e) => {
                                    const sg = e.target.value
                                    updateFila(fecha, r.ui_id, {
                                      subgrupo_labor: sg,
                                      codigo_labor: null,
                                    })
                                  }}
                                >
                                  <option value="">Todos...</option>
                                  {subgruposDisponibles.map((sg) => (
                                    <option key={sg} value={sg}>
                                      {sg}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              <td className={tableTd}>
                                <select
                                  className={`${selectCls} w-full`}
                                  value={r.codigo_labor ?? ''}
                                  onChange={(e) => {
                                    const cod = e.target.value ? Number(e.target.value) : null
                                    const labor = cod ? laboresByCodigo.get(cod) : undefined
                                    const ratioDefNum = toNumber(labor?.ratio_default)
                                    const haNum = toNumber(r.ha_prog)

                                    updateFila(fecha, r.ui_id, {
                                      codigo_labor: cod,
                                      subgrupo_labor: String(labor?.subgrupo ?? '').trim(),
                                      ratio: String(ratioDefNum || 0),
                                      jornales_prog:
                                        r.modo_jornales === 'AUTO'
                                          ? String(Number((haNum * ratioDefNum).toFixed(2)))
                                          : r.jornales_prog,
                                    })
                                  }}
                                >
                                  <option value="">Selecciona labor...</option>
                                  {labores
                                    .filter((l) => {
                                      if (!r.subgrupo_labor) return true
                                      return String(l.subgrupo ?? '').trim() === r.subgrupo_labor
                                    })
                                    .map((l) => (
                                      <option key={l.codigo} value={l.codigo}>
                                        {l.codigo} - {l.nombre}
                                      </option>
                                    ))}
                                </select>
                              </td>

                              <td className={`${tableTd} w-28 min-w-[112px]`}>
                                <input
                                  type="number"
                                  step="0.01"
                                  className={`${inputCls} w-full text-right`}
                                  value={r.ratio}
                                  onFocus={(e) => {
                                    if (e.currentTarget.value === '0') e.currentTarget.select()
                                  }}
                                  onChange={(e) => {
                                    const ratioStr = e.target.value
                                    const ha = toNumber(r.ha_prog)
                                    if (r.modo_jornales === 'AUTO') {
                                      const ratioNum = toNumber(ratioStr)
                                      updateFila(fecha, r.ui_id, {
                                        ratio: ratioStr,
                                        jornales_prog: String(Number((ha * ratioNum).toFixed(2))),
                                      })
                                    } else {
                                      updateFila(fecha, r.ui_id, { ratio: ratioStr })
                                    }
                                  }}
                                />
                              </td>

                              <td className={`${tableTd} w-28 min-w-[112px]`}>
                                <input
                                  type="number"
                                  step="0.01"
                                  className={`${inputCls} w-full text-right`}
                                  value={r.ha_prog}
                                  onFocus={(e) => {
                                    if (e.currentTarget.value === '0') e.currentTarget.select()
                                  }}
                                  onChange={(e) => {
                                    const haStr = e.target.value
                                    const ratioNum = toNumber(r.ratio)
                                    if (r.modo_jornales === 'AUTO') {
                                      const haNum = toNumber(haStr)
                                      updateFila(fecha, r.ui_id, {
                                        ha_prog: haStr,
                                        jornales_prog: String(Number((haNum * ratioNum).toFixed(2))),
                                      })
                                    } else {
                                      updateFila(fecha, r.ui_id, { ha_prog: haStr })
                                    }
                                  }}
                                />
                              </td>

                              <td className={`${tableTd} w-28 min-w-[112px]`}>
                                <input
                                  type="number"
                                  step="0.01"
                                  className={`${inputCls} w-full text-right`}
                                  value={r.jornales_prog}
                                  disabled={r.modo_jornales === 'AUTO'}
                                  onFocus={(e) => {
                                    if (e.currentTarget.value === '0') e.currentTarget.select()
                                  }}
                                  onChange={(e) => updateFila(fecha, r.ui_id, { jornales_prog: e.target.value })}
                                />
                              </td>

                              <td className={tableTd}>
                                <select
                                  className={`${selectCls} w-full text-xs`}
                                  value={r.modo_jornales}
                                  onChange={(e) => {
                                    const modo = e.target.value as ModoJornales
                                    const ha = toNumber(r.ha_prog)
                                    const ratioNum = toNumber(r.ratio)
                                    updateFila(fecha, r.ui_id, {
                                      modo_jornales: modo,
                                      jornales_prog:
                                        modo === 'AUTO'
                                          ? String(Number((ha * ratioNum).toFixed(2)))
                                          : r.jornales_prog,
                                    })
                                  }}
                                >
                                  <option value="MANUAL">Manual</option>
                                  <option value="AUTO">Auto</option>
                                </select>
                              </td>

                              <td className={tableTd}>
                                <div className="flex items-center gap-3 whitespace-nowrap">
                                  <button
                                    className="text-xs font-semibold text-green-800 underline"
                                    onClick={() => duplicarFila(fecha, r.ui_id)}
                                  >
                                    Duplicar
                                  </button>

                                  <button
                                    className="text-xs font-semibold text-gray-700 underline"
                                    onClick={() => updateFila(fecha, r.ui_id, { obs_open: !r.obs_open })}
                                  >
                                    {r.obs_open ? 'Ocultar Obs' : 'Obs'}
                                  </button>

                                  <button
                                    className="text-xs font-semibold text-red-600 underline"
                                    onClick={() => quitarFila(fecha, r.ui_id)}
                                  >
                                    Quitar
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {r.obs_open ? (
                              <tr key={`${r.ui_id}__obs`}>
                                <td className={tableTd} colSpan={9}>
                                  <div className="flex items-center gap-2">
                                    <div className="text-xs font-semibold text-gray-600 w-10">Obs:</div>
                                    <input
                                      type="text"
                                      className={`${inputCls} w-full`}
                                      placeholder="Escribe una observación (opcional)"
                                      value={r.obs}
                                      onChange={(e) => updateFila(fecha, r.ui_id, { obs: e.target.value })}
                                    />
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}