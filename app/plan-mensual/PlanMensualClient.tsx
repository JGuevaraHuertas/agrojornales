'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

import type { Depto, FilaUI, Labor, Lote, Red, Sector, Vista } from './utils/planUtils'
import { UI, buildCalendarWeeks, escapeCsv, generarDiasDelMes, makeId, pad2, toNumber, downloadTextFile } from './utils/planUtils'
import PlanHeader from './components/PlanHeader'
import CalendarioView from './components/CalendarioView'
import ListaDiasView from './components/ListaDiasView'

type ProfileRow = { rol: string | null }
type JefesAccesoRow = { depto_id: string | null }
type PlanRow = { id: string }
type PlanVersionRow = { version_nro: number | null; created_at: string | null }

type PlanDetalleRow = {
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

function normKey(v: unknown) {
  return String(v ?? '').trim().toUpperCase()
}

export default function PlanMensualClient() {
  const router = useRouter()

  const now = new Date()
  const [anio, setAnio] = useState<number>(now.getFullYear())
  const [mes, setMes] = useState<number>(now.getMonth() + 1)

  const [vista, setVista] = useState<Vista>('LISTA')

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

  const [creandoVersion, setCreandoVersion] = useState(false)
  const creandoVersionRef = useRef(false)

  const guardandoRef = useRef(false)
  const loadDetalleTokenRef = useRef(0)

  // acciones por día
  const [fechaOrigen, setFechaOrigen] = useState<string>('')
  const [fechaDestino, setFechaDestino] = useState<string>('')

  // copiar/mover a rango
  const [rangoInicio, setRangoInicio] = useState<string>('')
  const [rangoFin, setRangoFin] = useState<string>('')

  // ============================================================
  // dedupe deptos por (departamento + cultivo)
  // ============================================================
  const dedupeDeptos = (data: Depto[]): Depto[] => {
    const m = new Map<string, Depto>()
    for (const d of data ?? []) {
      const key = `${normKey(d.departamento)}|${normKey(d.cultivo)}`
      if (!m.has(key)) m.set(key, d)
    }
    return Array.from(m.values())
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

      const { data: perfilData, error: perErr } = await supabase.from('profiles').select('rol').eq('email', email).maybeSingle()
      if (perErr) {
        console.error(perErr)
        setErrorMsg(perErr.message)
        return
      }

      const perfil = perfilData as ProfileRow | null
      const rol = String(perfil?.rol ?? '').toUpperCase()
      setUserRol(rol)

      // ADMIN: ve todo
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

        const unicos = dedupeDeptos((data ?? []) as Depto[])
        setDeptos(unicos)
        if (unicos.length === 1) setDeptoSel(unicos[0])
        return
      }

      // NO admin: leer accesos
      const emailKey = String(email).trim().toLowerCase()

      const { data: accesosData, error: accErr } = await supabase.from('jefes_acceso').select('depto_id').eq('activo', true).eq('email', emailKey)

      if (accErr) {
        console.error(accErr)
        setErrorMsg(accErr.message)
        return
      }

      const accesos = (accesosData ?? []) as JefesAccesoRow[]
      const ids = accesos.map((x) => x.depto_id).filter((x): x is string => !!x)

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

      const unicos = dedupeDeptos((dataDeptos ?? []) as Depto[])
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
    setRangoInicio('')
    setRangoFin('')
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

      let qLab = supabase
        .from('labores')
        .select('codigo, nombre, departamento, grupo, subgrupo, cultivo, um, ratio_default, activo')
        .eq('activo', true)
        .eq('departamento', deptoName)

      if (cultivoSel) qLab = qLab.eq('cultivo', cultivoSel)

      let qLotes = supabase.from('lotes').select('lote_id, cultivo, fundo, ha_total, activo').eq('activo', true)
      if (cultivoSel) qLotes = qLotes.eq('cultivo', cultivoSel)

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

      // reset filas (mantiene fechas)
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

      const { data: foundData, error: e1 } = await supabase
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

      const found = foundData as PlanRow | null
      if (found?.id) {
        setPlanId(found.id)
        setLoadingPlan(false)
        return
      }

      const { data: createdData, error: e2 } = await supabase
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

      const created = createdData as PlanRow
      setPlanId(created.id)
      setLoadingPlan(false)
    }

    run()
  }, [anio, mes, deptoSel])

  // ============================================================
  // 5) Cargar plan_detalle
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

      const rows = (data ?? []) as PlanDetalleRow[]

      for (const row of rows) {
        const fecha = String(row.fecha ?? '').slice(0, 10)
        if (!nextBase[fecha]) continue

        const ratioNum = toNumber(row.ratio)
        const haNum = toNumber(row.ha_prog)
        const jNum = toNumber(row.jornales_prog)

        nextBase[fecha].push({
          ui_id: makeId(),
          fecha,
          linea: Number(row.linea ?? nextBase[fecha].length + 1),
          lote_id: row.lote_id ?? '',
          red_id: row.red_id ?? '',
          sector_id: row.sector_id ?? '',
          subgrupo_labor: '',
          codigo_labor: row.codigo_labor ?? null,
          ratio: String(ratioNum || 0),
          ha_prog: String(haNum || 0),
          jornales_prog: String(jNum || 0),
          modo_jornales: 'MANUAL',
          obs: row.obs ?? '',
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

  const sectorHA = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sectores) {
      const key = `${s.lote_id}__${s.red_id}__${s.sector_id}`
      m.set(key, toNumber(s.ha))
    }
    return m
  }, [sectores])

  const totalHA = useMemo(() => Object.values(filas).flat().reduce((a, r) => a + toNumber(r.ha_prog), 0), [filas])
  const totalJornales = useMemo(() => Object.values(filas).flat().reduce((a, r) => a + toNumber(r.jornales_prog), 0), [filas])

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
        ui_id: makeId(),
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
      arr.splice(i + 1, 0, { ...base, ui_id: makeId(), obs_open: false })
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

  // acciones por día
  function copiarAFEcha(origen: string, destino: string) {
    if (!origen || !destino || origen === destino) return
    setFilas((prev) => {
      const next = { ...prev }
      const src = next[origen] ?? []
      const dst = next[destino] ?? []
      const copias = src.map((x) => ({ ...x, ui_id: makeId(), fecha: destino, obs_open: false }))
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

  function getDiasEnRango(inicio: string, fin: string) {
    if (!inicio || !fin) return []
    const i = dias.indexOf(inicio)
    const f = dias.indexOf(fin)
    if (i === -1 || f === -1) return []
    const a = Math.min(i, f)
    const b = Math.max(i, f)
    return dias.slice(a, b + 1)
  }

  function copiarARango(origen: string, inicio: string, fin: string) {
    if (!origen || !inicio || !fin) return
    const targets = getDiasEnRango(inicio, fin).filter((d) => d !== origen)
    if (targets.length === 0) return
    setFilas((prev) => {
      const next = { ...prev }
      const src = next[origen] ?? []
      for (const dest of targets) {
        const dst = next[dest] ?? []
        const copias = src.map((x) => ({ ...x, ui_id: makeId(), fecha: dest, obs_open: false }))
        next[dest] = renumerar(dest, [...dst, ...copias])
      }
      return next
    })
  }

  function moverARango(origen: string, inicio: string, fin: string) {
    if (!origen || !inicio || !fin) return
    const targets = getDiasEnRango(inicio, fin).filter((d) => d !== origen)
    if (targets.length === 0) return
    setFilas((prev) => {
      const next = { ...prev }
      const src = next[origen] ?? []
      for (const dest of targets) {
        const dst = next[dest] ?? []
        const moved = src.map((x) => ({ ...x, ui_id: makeId(), fecha: dest, obs_open: false }))
        next[dest] = renumerar(dest, [...dst, ...moved])
      }
      next[origen] = []
      return next
    })
  }

  // ============================
  // GUARDAR
  // ============================
  const guardar = async () => {
    setErrorMsg('')
    if (!planId) return
    if (guardandoRef.current) return
    guardandoRef.current = true

    setGuardando(true)
    try {
      const flat = Object.values(filas).flat()

      const isRowEmpty = (f: FilaUI) =>
        !f.lote_id && !f.red_id && !f.sector_id && !f.codigo_labor && toNumber(f.ha_prog) === 0 && toNumber(f.jornales_prog) === 0 && !String(f.obs ?? '').trim()

      const invalid = flat.filter((f) => {
        if (isRowEmpty(f)) return false
        const hasLabor = !!f.codigo_labor
        const hasJornales = toNumber(f.jornales_prog) > 0
        return !(hasLabor && hasJornales)
      })

      if (invalid.length > 0) {
        toast.error('No se puede guardar', { description: 'Se tiene que seleccionar la labor y registrar los jornales.' })
        return
      }

      const rowsPrepared = flat
        .filter((f) => !isRowEmpty(f))
        .map((f) => {
          const red = String(f.red_id ?? '').trim() || null
          const sector = String(f.sector_id ?? '').trim() || null
          const lote = String(f.lote_id ?? '').trim() || null

          return {
            plan_id: planId,
            fecha: f.fecha,
            linea: f.linea,
            lote_id: lote,
            red_id: red,
            sector_id: sector,
            codigo_labor: f.codigo_labor,
            ratio: toNumber(f.ratio),
            ha_prog: toNumber(f.ha_prog),
            jornales_prog: toNumber(f.jornales_prog),
            obs: f.obs ?? '',
          }
        })

      if (rowsPrepared.length === 0) {
        toast.message('No hay cambios para guardar', { description: 'Agrega filas o completa datos antes de guardar.' })
        return
      }

      const { error: delErr } = await supabase.from('plan_detalle').delete().eq('plan_id', planId)
      if (delErr) throw delErr

      const { data: insData, error: insErr } = await supabase.from('plan_detalle').insert(rowsPrepared).select('id')
      if (insErr) throw insErr

      toast.success('Plan guardado correctamente ✅', { description: `${(insData ?? []).length} registro(s) guardado(s)` })
    } catch (e: unknown) {
      console.error(e)
      const msg = e instanceof Error ? e.message : 'Error al guardar'
      setErrorMsg(msg)
      toast.error('No se pudo guardar', { description: msg })
    } finally {
      guardandoRef.current = false
      setGuardando(false)
    }
  }

  // ============================
  // CALENDARIO: resumen por día
  // ============================
  const resumenDia = useMemo(() => {
    const m = new Map<string, { count: number; items: Array<{ codigo: number; nombre: string; grupo: string; jornales: number; ha: number }> }>()
    for (const d of dias) {
      const rows = filas[d] ?? []
      const items: Array<{ codigo: number; nombre: string; grupo: string; jornales: number; ha: number }> = []
      for (const r of rows) {
        if (!r.codigo_labor) continue
        const lab = laboresByCodigo.get(r.codigo_labor)
        items.push({
          codigo: r.codigo_labor,
          nombre: String(lab?.nombre ?? ''),
          grupo: String(lab?.grupo ?? ''),
          jornales: toNumber(r.jornales_prog),
          ha: toNumber(r.ha_prog),
        })
      }
      m.set(d, { count: items.length, items })
    }
    return m
  }, [dias, filas, laboresByCodigo])

  const totalesDia = useMemo(() => {
    const m = new Map<string, { ha: number; jornales: number }>()
    for (const d of dias) {
      const rows = filas[d] ?? []
      const ha = rows.reduce((a, r) => a + toNumber(r.ha_prog), 0)
      const jornales = rows.reduce((a, r) => a + toNumber(r.jornales_prog), 0)
      m.set(d, { ha, jornales })
    }
    return m
  }, [dias, filas])

  const weeks = useMemo(() => buildCalendarWeeks(anio, mes), [anio, mes])
  const today = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`
  }, [])

  const scrollToFecha = (fecha: string) => {
    setVista('LISTA')
    setTimeout(() => {
      const el = document.getElementById(`dia-${fecha}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  // ============================
  // EXPORTS
  // ============================
  const exportarCSV = () => {
    const flat = Object.values(filas).flat()

    const header = [
      'anio',
      'mes',
      'depto_id',
      'departamento',
      'cultivo',
      'fecha',
      'linea',
      'lote_id',
      'red_id',
      'sector_id',
      'codigo_labor',
      'labor',
      'subgrupo',
      'grupo',
      'ha_prog',
      'ratio',
      'jornales_prog',
      'modo',
      'obs',
    ].join(',')

    const lines = flat
      .filter((f) => !!(f.lote_id || f.red_id || f.sector_id || f.codigo_labor || toNumber(f.ha_prog) || toNumber(f.jornales_prog) || String(f.obs ?? '').trim()))
      .map((f) => {
        const lab = f.codigo_labor ? laboresByCodigo.get(f.codigo_labor) : undefined
        const row = [
          anio,
          mes,
          deptoSel?.id ?? '',
          deptoSel?.departamento ?? '',
          deptoSel?.cultivo ?? '',
          f.fecha,
          f.linea,
          f.lote_id,
          f.red_id,
          f.sector_id,
          f.codigo_labor ?? '',
          lab?.nombre ?? '',
          lab?.subgrupo ?? '',
          lab?.grupo ?? '',
          toNumber(f.ha_prog),
          toNumber(f.ratio),
          toNumber(f.jornales_prog),
          f.modo_jornales,
          f.obs ?? '',
        ]
        return row.map(escapeCsv).join(',')
      })

    const csv = [header, ...lines].join('\n')
    downloadTextFile(`plan_${anio}_${pad2(mes)}_${deptoSel?.id ?? 'depto'}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const exportarPDF = () => window.print()

  // ============================================================
  // ✅ VERSIONES (SIN any)
  // ============================================================
  const crearVersion = async () => {
    if (!planId || !deptoSel?.id) return
    if (creandoVersionRef.current) return

    creandoVersionRef.current = true
    setCreandoVersion(true)
    setErrorMsg('')

    try {
      // asegurar email
      let email = userEmail
      if (!email) {
        const { data } = await supabase.auth.getUser()
        email = data.user?.email ?? ''
      }
      if (!email) throw new Error('Usuario sin email')

      // RPC crea versión
      const { error: rpcErr } = await supabase.rpc('crear_plan_version', {
        p_plan_id: planId,
        p_email: email,
        p_comentario: null,
      })
      if (rpcErr) throw rpcErr

      // leer último nro (sin any)
      const { data: lastVData, error: vErr } = await supabase
        .from('plan_versiones')
        .select('version_nro, created_at')
        .eq('plan_id', planId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (vErr) {
        toast.success('Versión creada ✅')
      } else {
        const lastV = lastVData as PlanVersionRow | null
        const nro = lastV?.version_nro
        toast.success(nro ? `Versión ${nro} creada ✅` : 'Versión creada ✅')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al crear versión'
      setErrorMsg(msg)
      toast.error('No es posible crear versión', { description: msg })
    } finally {
      creandoVersionRef.current = false
      setCreandoVersion(false)
    }
  }

  const irAVersiones = () => {
    if (!planId || !deptoSel?.id) return
    router.push(`/plan-versiones?plan_id=${planId}&anio=${anio}&mes=${mes}&depto_id=${deptoSel.id}`)
  }

  // ============================
  // UI styles
  // ============================
  const { panelBg, card, btn, btnGhost, selectCls, inputCls, tableTh, tableTd } = UI

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] p-4 space-y-4">
        <PlanHeader
          vista={vista}
          setVista={setVista}
          totalHA={totalHA}
          totalJornales={totalJornales}
          errorMsg={errorMsg}
          anio={anio}
          setAnio={setAnio}
          mes={mes}
          setMes={setMes}
          deptos={deptos}
          deptoSel={deptoSel}
          setDeptoSel={setDeptoSel}
          planId={planId}
          guardando={guardando}
          loadingPlan={loadingPlan}
          guardar={guardar}
          creandoVersion={creandoVersion}
          crearVersion={crearVersion}
          irAVersiones={irAVersiones}
          exportarCSV={exportarCSV}
          exportarPDF={exportarPDF}
          dias={dias}
          fechaOrigen={fechaOrigen}
          setFechaOrigen={setFechaOrigen}
          fechaDestino={fechaDestino}
          setFechaDestino={setFechaDestino}
          rangoInicio={rangoInicio}
          setRangoInicio={setRangoInicio}
          rangoFin={rangoFin}
          setRangoFin={setRangoFin}
          copiarAFEcha={copiarAFEcha}
          moverAFEcha={moverAFEcha}
          copiarARango={copiarARango}
          moverARango={moverARango}
          card={card}
          panelBg={panelBg}
          btn={btn}
          btnGhost={btnGhost}
          selectCls={selectCls}
          inputCls={inputCls}
        />

        {vista === 'CALENDARIO' ? (
          <CalendarioView anio={anio} mes={mes} weeks={weeks} today={today} resumenDia={resumenDia} totalesDia={totalesDia} scrollToFecha={scrollToFecha} />
        ) : null}

        {vista === 'LISTA' ? (
          <ListaDiasView
            dias={dias}
            filas={filas}
            agregarFila={agregarFila}
            updateFila={updateFila}
            duplicarFila={duplicarFila}
            quitarFila={quitarFila}
            labores={labores}
            laboresByCodigo={laboresByCodigo}
            subgruposDisponibles={subgruposDisponibles}
            lotes={lotes}
            redesPorLote={redesPorLote}
            sectoresPorLoteRed={sectoresPorLoteRed}
            sectorHA={sectorHA}
            selectCls={selectCls}
            inputCls={inputCls}
            tableTh={tableTh}
            tableTd={tableTd}
            btnGhost={btnGhost}
          />
        ) : null}
      </div>
    </div>
  )
}
