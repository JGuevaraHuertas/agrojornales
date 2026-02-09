'use client'

import { useEffect, useMemo, useState } from 'react'
import DetalleCard from './component/DetalleCard'
import EncargadoModal from './component/EncargadoModal'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import type { ExtraKey } from './component/Extras'

type UserRole = 'USUARIO' | 'JEFE' | 'ADMIN'

type Depto = {
  id: string
  departamento: string | null
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

type EncargadoDb = {
  codigo: string | number | null
  nombres: string | null
  sexo: string | null
  labor_codigo: string | null
  labor_nombre: string | null
  activo: boolean | null
  created_at: string | null
}

type Encargado = {
  codigo: string
  nombres: string | null
  sexo: string | null
  labor_codigo: string | null
  labor_nombre: string | null
  activo: boolean | null
  created_at: string | null
  // campo derivado para UI
  nombre: string
}

type TipoLabor = 'MANO_OBRA' | 'INSUMO' | 'PRODUCCION'

type AvanceRow = {
  dbId?: string | null // 👈 id real en BD (avance_labor_diario.id)
  _id: string
  detalleId: string
  encargadoCodigo: string
  subgrupo: string
  laborCodigo: string
  loteId: string
  redId: string
  sectorId: string
  hectareas: string
  jornales: string
  cantidadInsumo: string
  kg: string
  obs: string
  yaramilaKg: string
  templeFertKg: string
  templeKg: string
  calmaxKg: string
  adherenteLit: string
  herbicidaLit: string
  herbosatoLit: string
  grapasUni: string
  papelUni: string
  variedad: string
  puntos: string
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim().replace(',', '.')
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function hoyYMD() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function norm(v: unknown) {
  return String(v ?? '').trim().toUpperCase()
}

function shortSectorId(sectorId: string) {
  const s = String(sectorId ?? '').trim()
  if (!s) return ''
  const parts = s.split('_').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : s
}

function shortLoteId(loteId: string) {
  const s = String(loteId ?? '').trim()
  if (!s) return ''
  return s.split('_')[0] // ej: L01_PAL -> L01
}

function makeId() {
  try {
    // navegador
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c: any = globalThis.crypto
    if (c?.randomUUID) return c.randomUUID()
  } catch {}
  return String(Date.now()) + Math.random().toString(16).slice(2)
}


function fmt2(n: number) {
  if (!Number.isFinite(n)) return '0.00'
  return n.toFixed(2)
}

function errMsg(e: unknown, fallback = 'Ocurrió un error') {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string' && e.trim()) return e
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message
    if (typeof m === 'string' && m.trim()) return m
  }
  return fallback
}



export default function AvanceDiarioPage() {
  const router = useRouter()

  const card = 'rounded-xl border border-gray-200 shadow-sm bg-white'
  const label = 'text-xs font-semibold text-gray-700'
  const inputCls =
    'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-200'
  const btn =
    'rounded-lg px-3 py-2 text-sm font-medium border border-green-700 bg-green-700 text-white hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed'
  const btnGhost = 'rounded-lg px-3 py-2 text-sm font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [userId, setUserId] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [userRole, setUserRole] = useState<UserRole>('USUARIO')

  // Deptos permitidos por usuario (según la tabla de accesos)
  const [allowedDeptoIds, setAllowedDeptoIds] = useState<string[]>([])

  const deptoSelectLocked = allowedDeptoIds.length === 1
  const isDeptoAllowed = (id: string) => allowedDeptoIds.includes(id)

  // IMPORTANTE: ajusta aquí si tu tabla/columnas se llaman distinto
  const ACCESOS_TABLE = 'usuarios_accesos'
  const ACCESOS_COL_EMAIL = 'email'
  const ACCESOS_COL_DEPTO_ID = 'depto_id'
  const ACCESOS_COL_ACTIVO = 'activo'

  const [deptos, setDeptos] = useState<Depto[]>([])
  const [labores, setLabores] = useState<Labor[]>([])
  const [lotes, setLotes] = useState<Lote[]>([])
  const [redes, setRedes] = useState<Red[]>([])
  const [sectores, setSectores] = useState<Sector[]>([])

  const [fecha, setFecha] = useState(hoyYMD())

  // Encargado (RRHH)
  const [encargados, setEncargados] = useState<Encargado[]>([])

  const [deptoId, setDeptoId] = useState<string>('')
  const deptoSel = useMemo(() => deptos.find((d) => d.id === deptoId) ?? null, [deptos, deptoId])

  // =========================
  // LOTES por FUNDO (regla negocio)
  // =========================
  const LOTES_PERMITIDOS_POR_FUNDO: Record<string, Set<string>> = {
    FUNDO1: new Set(['L01_PAL', 'L02_PAL', 'L09_PAL', 'L11_PAL', 'L12_PAL']),
    FUNDO2: new Set(['L03_PAL', 'L04_PAL', 'L06_PAL', 'L16_PAL']),
  }

  const lotesFiltradosPorFundo = useMemo(() => {
    const f = norm(deptoSel?.fundo)
    if (!f) return lotes

    const allowed = LOTES_PERMITIDOS_POR_FUNDO[f]
    if (!allowed) return lotes

    return lotes.filter((l) => allowed.has(String(l.lote_id).trim()))
  }, [lotes, deptoSel])

type DetalleUI = {
  id: string
  selSubgrupo: string
  selLaborCodigo: string
  extrasVisible: ExtraKey[]
  extraToAdd: ExtraKey | ''
}

  // Detalles (recuadros) para poder registrar varias labores en el mismo día
  const [detalles, setDetalles] = useState<DetalleUI[]>(() => [
    { id: makeId(), selSubgrupo: '', selLaborCodigo: '', extrasVisible: [], extraToAdd: '' },
  ])

  // Rows
  const makeRow = (detalleId: string, init?: Partial<Pick<AvanceRow, 'subgrupo' | 'laborCodigo'>>): AvanceRow => ({
    _id: makeId(),
    dbId: null,
    detalleId,
    encargadoCodigo: '',
    subgrupo: init?.subgrupo ?? '',
    laborCodigo: init?.laborCodigo ?? '',
    loteId: '',
    redId: '',
    sectorId: '',
    hectareas: '',
    jornales: '',
    cantidadInsumo: '',
    kg: '',
    obs: '',
    yaramilaKg: '',
    templeFertKg: '',
    templeKg: '',
    calmaxKg: '',
    adherenteLit: '',
    herbicidaLit: '',
    herbosatoLit: '',
    grapasUni: '',
    papelUni: '',
    variedad: '',
    puntos: '',
  })

  const [rows, setRows] = useState<AvanceRow[]>(() => [makeRow(detalles[0].id)])

  // =========== Extra columns UI state (per detalle) =============
  const setDetalleExtraToAdd = (detalleId: string, value: ExtraKey | '') => {
    setDetalles((prev) => prev.map((d) => (d.id === detalleId ? { ...d, extraToAdd: value } : d)))
  }

  const addExtraColForDetalle = (detalleId: string) => {
    setDetalles((prev) =>
      prev.map((d) => {
        if (d.id !== detalleId) return d
        if (!d.extraToAdd) return d
        const key = d.extraToAdd
        const nextVisible = d.extrasVisible.includes(key) ? d.extrasVisible : [...d.extrasVisible, key]
        return { ...d, extrasVisible: nextVisible, extraToAdd: '' }
      })
    )
  }

  const removeExtraColForDetalle = (detalleId: string, key: ExtraKey) => {
    setDetalles((prev) => prev.map((d) => (d.id === detalleId ? { ...d, extrasVisible: d.extrasVisible.filter((k) => k !== key) } : d)))
  }

  const getTableMinWidthClass = (extraCount: number) => {
    const px = 1200 + extraCount * 120
    return `min-w-[${px}px]`
  }

  // Map de encargados por código
  const encargadoByCodigo = useMemo(() => {
    const m = new Map<string, Encargado>()
    for (const e of encargados) m.set(String(e.codigo).trim(), e)
    return m
  }, [encargados])

  const updateRow = (id: string, patch: Partial<AvanceRow>) => {
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, ...patch } : r)))
  }

  const addRowForDetalle = (detalleId: string) => {
    const det = detalles.find((d) => d.id === detalleId)
    if (!det?.selLaborCodigo) {
      toast.error('Selecciona una labor antes de agregar la fila.')
      return
    }
    setRows((prev) => [...prev, makeRow(detalleId, { subgrupo: det.selSubgrupo, laborCodigo: det.selLaborCodigo })])
  }

  const addDetalle = () => {
    const id = makeId()
    setDetalles((prev) => [
      ...prev,
      { id, selSubgrupo: '', selLaborCodigo: '', extrasVisible: [], extraToAdd: '' },
    ])
    setRows((prev) => [...prev, makeRow(id)])
  }

  const removeDetalle = async (detalleId: string) => {
    // No permitir dejar la pantalla sin ningún detalle
    if (detalles.length <= 1) {
      toast.error('Debe existir al menos un detalle.')
      return
    }

    // Si hay filas guardadas en DB para este detalle, eliminarlas en lote
    const dbIds = rows.filter((r) => r.detalleId === detalleId && r.dbId).map((r) => String(r.dbId))
    if (dbIds.length > 0) {
      const { error } = await supabase.from('avance_labor_diario').delete().in('id', dbIds)
      if (error) {
        console.error(error)
        toast.error(error.message)
        return
      }
    }

    // Quitar el detalle
    setDetalles((prev) => prev.filter((d) => d.id !== detalleId))

    // Quitar todas las filas asociadas a ese detalle
    setRows((prev) => {
      const remaining = prev.filter((r) => r.detalleId !== detalleId)
      // seguridad: siempre dejar al menos una fila
      if (remaining.length === 0) {
        const firstId = makeId()
        setDetalles([{ id: firstId, selSubgrupo: '', selLaborCodigo: '', extrasVisible: [], extraToAdd: '' }])
        return [makeRow(firstId)]
      }
      return remaining
    })

    // Cerrar observaciones abiertas de filas que se van
    setObsOpenIds((prev) => {
      const next = new Set(prev)
      const idsToRemove = rows.filter((r) => r.detalleId === detalleId).map((r) => r._id)
      for (const id of idsToRemove) next.delete(id)
      return next
    })
  }

  const removeRow = async (id: string) => {
    const row = rows.find((r) => r._id === id)

    // No permitir dejar sin filas
    if (rows.length <= 1) return

    // Si existe en DB, eliminar
    if (row?.dbId) {
      const { error } = await supabase.from('avance_labor_diario').delete().eq('id', row.dbId)
      if (error) {
        console.error(error)
        toast.error(error.message)
        return
      }
    }

    setRows((prev) => prev.filter((r) => r._id !== id))
    setObsOpenIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // Observaciones desplegables por fila
  const [obsOpenIds, setObsOpenIds] = useState<Set<string>>(() => new Set())

  const toggleObs = (rowId: string) => {
    setObsOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  // Modal para buscar encargado
  const [encModalOpen, setEncModalOpen] = useState(false)
  const [encModalRowId, setEncModalRowId] = useState<string>('')
  const [encSearch, setEncSearch] = useState<string>('')

  // Encargados: agregar / editar / quitar
  const [encFormOpen, setEncFormOpen] = useState(false)
  const [encFormMode, setEncFormMode] = useState<'ADD' | 'EDIT'>('ADD')
  const [encFormCodigo, setEncFormCodigo] = useState('')
  const [encFormNombre, setEncFormNombre] = useState('')
  const [encWorking, setEncWorking] = useState(false)

  const openEncModal = (rowId: string) => {
    setEncModalRowId(rowId)
    setEncSearch('')
    setEncModalOpen(true)
  }

  const closeEncModal = () => {
    setEncModalOpen(false)
    setEncModalRowId('')
    setEncSearch('')
  }

  const loadEncargados = async () => {
    const { data: enc, error: encErr } = await supabase
      .from('encargados')
      .select('codigo, nombres, sexo, labor_codigo, labor_nombre, activo, created_at')
      .eq('activo', true)
      .order('nombres')
      .returns<EncargadoDb[]>()

    if (encErr) {
      console.error(encErr)
      toast.error(encErr.message)
      setEncargados([])
      return
    }

    const normalized: Encargado[] = (enc ?? []).map((e: EncargadoDb) => ({
      codigo: String(e.codigo ?? '').trim(),
      nombres: e.nombres ?? null,
      sexo: e.sexo ?? null,
      labor_codigo: e.labor_codigo ?? null,
      labor_nombre: e.labor_nombre ?? null,
      activo: e.activo ?? null,
      created_at: e.created_at ?? null,
      nombre: String(e.nombres ?? '').trim(),
    }))

    setEncargados(normalized)
  }

  const openAddEncForm = () => {
    const q = encSearch.trim()
    setEncFormMode('ADD')
    setEncFormCodigo(q && /^\d+$/.test(q) ? q : '')
    setEncFormNombre(q && !/^\d+$/.test(q) ? q : '')
    setEncFormOpen(true)
  }

  const openEditEncForm = (codigo: string, nombre: string) => {
    setEncFormMode('EDIT')
    setEncFormCodigo(String(codigo ?? '').trim())
    setEncFormNombre(String(nombre ?? '').trim())
    setEncFormOpen(true)
  }

  const closeEncForm = () => {
    setEncFormOpen(false)
    setEncFormCodigo('')
    setEncFormNombre('')
  }

  const saveEncargado = async () => {
    const codigo = encFormCodigo.trim()
    const nombre = encFormNombre.trim()

    if (!codigo) return toast.error('Ingresa el código del encargado.')
    if (!/^\d+$/.test(codigo)) return toast.error('El código debe ser numérico.')
    if (!nombre) return toast.error('Ingresa el nombre del encargado.')

    setEncWorking(true)
    try {
      if (encFormMode === 'ADD') {
        const exists = encargados.some((e) => String(e.codigo).trim() === codigo)
        if (exists) {
          toast.error('Ese código ya existe.')
          return
        }

        const { error } = await supabase.from('encargados').insert({
          codigo,
          nombres: nombre,
          activo: true,
        })

        if (error) throw error
        toast.success('Encargado agregado ✅')
      } else {
        const { error } = await supabase
          .from('encargados')
          .update({ nombres: nombre })
          .eq('codigo', codigo)

        if (error) throw error
        toast.success('Encargado actualizado ✅')
      }

      closeEncForm()
      await loadEncargados()
    } catch (e: unknown) {
      console.error(e)
      toast.error(errMsg(e, 'No se pudo guardar el encargado'))
    } finally {
      setEncWorking(false)
    }
  }

  const desactivarEncargado = async (codigo: string) => {
    const c = String(codigo ?? '').trim()
    if (!c) return
    if (!window.confirm(`¿Quitar (desactivar) al encargado ${c}?`)) return

    setEncWorking(true)
    try {
      const { error } = await supabase.from('encargados').update({ activo: false }).eq('codigo', c)
      if (error) throw error

      // Si estaba seleccionado en la fila actual, limpiarlo
      if (encModalRowId) updateRow(encModalRowId, { encargadoCodigo: '' })

      toast.success('Encargado quitado ✅')
      await loadEncargados()
    } catch (e: unknown) {
      console.error(e)
      toast.error(errMsg(e, 'No se pudo quitar el encargado'))
    } finally {
      setEncWorking(false)
    }
  }

  const encFiltrados = useMemo(() => {
    const q = encSearch.trim().toLowerCase()
    if (!q) return encargados.slice(0, 60)

    const parts = q.split(/\s+/g).filter(Boolean)
    return encargados
      .filter((e) => {
        const codigo = String(e.codigo ?? '').trim().toLowerCase()
        const nombre = String(e.nombre ?? '').trim().toLowerCase()
        if (codigo.includes(q)) return true
        if (nombre.includes(q)) return true
        return parts.every((p) => codigo.includes(p) || nombre.includes(p))
      })
      .slice(0, 60)
  }, [encSearch, encargados])

  // Map de labores
  const laborByCodigo = useMemo(() => {
    const m = new Map<string, Labor>()
    for (const l of labores) m.set(String(l.codigo), l)
    return m
  }, [labores])

  const getTipoLabor = (labor: Labor | null): TipoLabor => {
    const um = norm(labor?.um)
    if (um === 'KG') return 'PRODUCCION'
    if (!um || um === 'HA' || um === 'HÁ' || um === 'HECTAREA' || um === 'HECTÁREA') return 'MANO_OBRA'
    return 'INSUMO'
  }

  // filtrar labores por depto
  const laboresFiltradasPorDepto = useMemo(() => {
    if (!deptoSel) return labores
    const dep = norm(deptoSel.departamento)
    const cul = norm(deptoSel.cultivo)

    return labores.filter((l) => {
      const okDep = dep ? norm(l.departamento).includes(dep) || dep.includes(norm(l.departamento)) : true
      const okCul = cul ? norm(l.cultivo) === cul : true
      return okDep && okCul
    })
  }, [labores, deptoSel])

  // Subgrupos
  const subgruposOptions = useMemo(() => {
    const set = new Set<string>()
    for (const l of laboresFiltradasPorDepto) {
      const sg = String(l.subgrupo ?? '').trim()
      if (sg) set.add(sg)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [laboresFiltradasPorDepto])

  useEffect(() => {
    const run = async () => {
      setLoading(true)

      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr) {
        console.error(authErr)
        toast.error(authErr.message)
        router.replace('/login')
        return
      }

      const u = authData.user
      if (!u?.id) {
        router.replace('/login')
        return
      }

      setUserId(u.id)
      setUserEmail(u.email ?? '')

      // Rol del usuario (USUARIO -> Avance Diario / JEFE-ADMIN -> Plan Mensual)
      const emailKey = (u.email ?? '').trim().toLowerCase()
      const { data: rolRow, error: rolErr } = await supabase
        .from('profiles')
        .select('rol')
        .eq('email', emailKey)
        .maybeSingle<{ rol: UserRole | null }>()

      if (rolErr) {
        console.error(rolErr)
        setUserRole('USUARIO')
      } else {
        setUserRole((rolRow?.rol ?? 'USUARIO') as UserRole)
      }

      // 1) Leer accesos del usuario (solo deptos activos)
      // const emailKey = (u.email ?? '').trim().toLowerCase()  // <--- already declared above

      const { data: accRows, error: accErr } = await supabase
        .from(ACCESOS_TABLE)
        .select(`${ACCESOS_COL_DEPTO_ID}, ${ACCESOS_COL_ACTIVO}`)
        .eq(ACCESOS_COL_EMAIL, emailKey)
        .eq(ACCESOS_COL_ACTIVO, true)

      if (accErr) {
        console.error(accErr)
        toast.error(accErr.message)
        setAllowedDeptoIds([])
        setDeptos([])
      } else {
        const ids = (accRows ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => String(r?.[ACCESOS_COL_DEPTO_ID] ?? '').trim())
          .filter(Boolean)

        setAllowedDeptoIds(ids)

        if (ids.length === 0) {
          setDeptos([])
          setDeptoId('')
          toast.error('No tienes accesos activos a departamentos. Solicita acceso al administrador.')
        } else {
          // 2) Traer solo los deptos permitidos
          const { data: dpt, error: dptErr } = await supabase
            .from('deptos')
            .select('id, departamento, cultivo, fundo, activo')
            .eq('activo', true)
            .in('id', ids)
            .order('departamento')

          if (dptErr) {
            console.error(dptErr)
            toast.error(dptErr.message)
            setDeptos([])
            setDeptoId('')
          } else {
            const list = (dpt ?? []) as Depto[]
            setDeptos(list)

            // preseleccionar: si depto actual no está permitido, elegir el primero
            const current = deptoId
            if (!current || !ids.includes(current)) {
              if (list.length > 0) setDeptoId(list[0].id)
              else setDeptoId('')
            }
          }
        }
      }

      const { data: labs, error: labErr } = await supabase
        .from('labores')
        .select('codigo, nombre, departamento, grupo, subgrupo, cultivo, um, activo')
        .eq('activo', true)
        .order('nombre')

      if (labErr) {
        console.error(labErr)
        toast.error(labErr.message)
      }
      setLabores((labs ?? []) as Labor[])

      const { data: lot, error: lotErr } = await supabase
        .from('lotes')
        .select('lote_id, cultivo, fundo, ha_total, activo')
        .eq('activo', true)
        .order('lote_id')

      if (lotErr) {
        console.error(lotErr)
        toast.error(lotErr.message)
      }
      setLotes((lot ?? []) as Lote[])

      const { data: red, error: redErr } = await supabase.from('redes').select('red_ref, lote_id, red_id')
      if (redErr) {
        console.error(redErr)
        toast.error(redErr.message)
      }
      setRedes((red ?? []) as Red[])

      const { data: sec, error: secErr } = await supabase.from('sectores').select('sector_id, lote_id, red_id, ha, variedad')

      if (secErr) {
        console.error(secErr)
        toast.error(secErr.message)
      }
      setSectores((sec ?? []) as Sector[])

      await loadEncargados()

      setLoading(false)
    }

    run()
  }, [router])

  // Redirigir JEFE/ADMIN a Plan Mensual
  useEffect(() => {
    if (loading) return
    if (userRole !== 'USUARIO') {
      router.replace('/plan-mensual')
    }
  }, [loading, userRole, router])

  const puedeGuardar = useMemo(() => {
    if (!fecha) return false
    if (!deptoId) return false
    if (!userId) return false

    return rows.some((r) => {
      const labor = laborByCodigo.get(r.laborCodigo) ?? null
      if (!labor) return false
      if (!r.loteId) return false
      if (!String(r.encargadoCodigo ?? '').trim()) return false

      const hect = toNum(r.hectareas)
      const jorn = toNum(r.jornales)
      if (hect <= 0) return false
      if (jorn < 0) return false

      const tipo = getTipoLabor(labor)
      if (tipo === 'MANO_OBRA') return true

      const kgVal = toNum(r.kg)
      const cantVal = toNum(r.cantidadInsumo)
      return kgVal > 0 || cantVal > 0
    })
  }, [fecha, deptoId, userId, rows, laborByCodigo])

  // Resumen POR DETALLE (labor): promedios por HA
  const resumenPorDetalle = useMemo(() => {
    const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0)
    type Agg = { ha: number; jorn: number; cant: number; kg: number }

    const byLabor = new Map<string, Agg>()

    for (const r of rows) {
      const key = String(r.laborCodigo ?? '').trim()
      if (!key) continue

      const prev = byLabor.get(key) ?? { ha: 0, jorn: 0, cant: 0, kg: 0 }

      const haR = toNum(r.hectareas)
      if (haR > 0) prev.ha += haR

      prev.jorn += toNum(r.jornales)
      prev.cant += toNum(r.cantidadInsumo)
      prev.kg += toNum(r.kg)

      byLabor.set(key, prev)
    }

    const items = Array.from(byLabor.entries()).map(([laborCodigo, a]) => {
      const lab = laborByCodigo.get(laborCodigo) ?? null
      const label = lab ? lab.nombre : `Labor ${laborCodigo}`
      return {
        laborCodigo,
        label,
        jornPorHa: safeDiv(a.jorn, a.ha),
        cantPorHa: safeDiv(a.cant, a.ha),
        kgPorHa: safeDiv(a.kg, a.ha),
      }
    })

    items.sort((x, y) => x.label.localeCompare(y.label, 'es'))
    return items
  }, [rows, laborByCodigo])

  // =========================
  // CARGA DESDE BD (SOLO POR USUARIO)
  // =========================
  type AvanceDbRow = {
    id: string
    fecha: string | null
    depto_id: string | null
    labor_id: string | null
    email: string | null
    encargado_codigo: string | null
    hectareas: number | null
    jornales: number | null
    cantidad: number | null
    unidad: string | null
    observacion: string | null
    lote_id: string | null
    red_id: string | null
    sector_id: string | null
    yaramila_kg: number | null
    temple_fert_kg: number | null
    temple_kg: number | null
    calmax_kg: number | null
    adherente_lit: number | null
    herbicida_lit: number | null
    herbosato_lit: number | null
    grapas_uni: number | null
    papel_uni: number | null
    variedad: string | null
    puntos: number | null
  }

  const hydrateFromDb = (data: AvanceDbRow[]) => {
    const byLabor = new Map<string, { detId: string; rows: AvanceDbRow[] }>()
    for (const d of data) {
      const laborCodigo = String(d.labor_id ?? '').trim()
      if (!laborCodigo) continue
      const found = byLabor.get(laborCodigo)
      if (found) found.rows.push(d)
      else byLabor.set(laborCodigo, { detId: makeId(), rows: [d] })
    }

    if (byLabor.size === 0) {
      const firstId = makeId()
      setDetalles([{ id: firstId, selSubgrupo: '', selLaborCodigo: '', extrasVisible: [], extraToAdd: '' }])
      setRows([makeRow(firstId)])
      return
    }

    const newDetalles: DetalleUI[] = []
    const newRows: AvanceRow[] = []

    for (const [laborCodigo, pack] of byLabor.entries()) {
      const lab = laborByCodigo.get(laborCodigo) ?? null
      const sg = String(lab?.subgrupo ?? '').trim()

      // Compute which extra columns to show for this detalle
      const keysToShow = new Set<ExtraKey>()
      for (const rr of pack.rows) {
        if (rr.yaramila_kg != null) keysToShow.add('yaramilaKg')
        if (rr.temple_fert_kg != null) keysToShow.add('templeFertKg')
        if (rr.temple_kg != null) keysToShow.add('templeKg')
        if (rr.calmax_kg != null) keysToShow.add('calmaxKg')
        if (rr.adherente_lit != null) keysToShow.add('adherenteLit')
        if (rr.herbicida_lit != null) keysToShow.add('herbicidaLit')
        if (String(rr.variedad ?? '').trim()) keysToShow.add('variedad')
        if (rr.herbosato_lit != null) keysToShow.add('herbosatoLit')
        if (rr.grapas_uni != null) keysToShow.add('grapasUni')
        if (rr.papel_uni != null) keysToShow.add('papelUni')
        if (rr.puntos != null) keysToShow.add('puntos')
      }

      newDetalles.push({
        id: pack.detId,
        selSubgrupo: sg,
        selLaborCodigo: laborCodigo,
        extrasVisible: Array.from(keysToShow),
        extraToAdd: '',
      })

      for (const r of pack.rows) {
        newRows.push({
          _id: makeId(),
          dbId: r.id,
          detalleId: pack.detId,
          encargadoCodigo: String(r.encargado_codigo ?? '').trim(),
          subgrupo: sg,
          laborCodigo,
          loteId: String(r.lote_id ?? ''),
          redId: String(r.red_id ?? ''),
          sectorId: String(r.sector_id ?? ''),
          hectareas: r.hectareas == null ? '' : String(r.hectareas),
          jornales: r.jornales == null ? '' : String(r.jornales),
          cantidadInsumo: r.cantidad == null ? '' : String(r.cantidad),
          kg: '',
          obs: String(r.observacion ?? ''),
          yaramilaKg: r.yaramila_kg == null ? '' : String(r.yaramila_kg),
          templeFertKg: r.temple_fert_kg == null ? '' : String(r.temple_fert_kg),
          templeKg: r.temple_kg == null ? '' : String(r.temple_kg),
          calmaxKg: r.calmax_kg == null ? '' : String(r.calmax_kg),
          adherenteLit: r.adherente_lit == null ? '' : String(r.adherente_lit),
          herbicidaLit: r.herbicida_lit == null ? '' : String(r.herbicida_lit),
          herbosatoLit: r.herbosato_lit == null ? '' : String(r.herbosato_lit),
          grapasUni: r.grapas_uni == null ? '' : String(r.grapas_uni),
          papelUni: r.papel_uni == null ? '' : String(r.papel_uni),
          variedad: String(r.variedad ?? ''),
          puntos: r.puntos == null ? '' : String(r.puntos),
        })
      }
    }

    setDetalles(newDetalles)
    setRows(newRows.length ? newRows : [makeRow(newDetalles[0].id)])
  }

  const cargarRegistrosGuardados = async () => {
    const emailKey = (userEmail ?? '').trim().toLowerCase()
    if (!fecha || !deptoId || !emailKey) return

    const { data, error } = await supabase
      .from('avance_labor_diario')
      .select('id, fecha, depto_id, labor_id, email, encargado_codigo, hectareas, jornales, cantidad, unidad, observacion, lote_id, red_id, sector_id, yaramila_kg, temple_fert_kg, temple_kg, calmax_kg, adherente_lit, herbicida_lit, herbosato_lit, grapas_uni, papel_uni, variedad, puntos')
      .eq('fecha', fecha)
      .eq('depto_id', deptoId)
      .eq('email', emailKey)
      .order('labor_id')

    if (error) {
      console.error(error)
      toast.error(error.message)
      return
    }

    hydrateFromDb((data ?? []) as AvanceDbRow[])
  }

  useEffect(() => {
    if (loading) return
    if (!deptoId) {
      const firstId = makeId()
      setDetalles([{ id: firstId, selSubgrupo: '', selLaborCodigo: '', extrasVisible: [], extraToAdd: '' }])
      setRows([makeRow(firstId)])
      return
    }
    if (labores.length === 0) return
    if (!(userEmail ?? '').trim()) return
    void cargarRegistrosGuardados()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, fecha, deptoId, labores.length, userEmail])

  // (per-detalle extrasVisible: no global auto-show effect needed)

  // =========================
  // GUARDAR (INSERT/UPDATE)
  // =========================
  const guardar = async () => {
    if (!fecha || !deptoId) {
      toast.error('Completa Fecha y Departamento.')
      return
    }
    if (allowedDeptoIds.length > 0 && !isDeptoAllowed(deptoId)) {
      toast.error('No tienes permiso para registrar en este departamento.')
      return
    }

    if (!userId) {
      toast.error('Sesión inválida. Vuelve a iniciar sesión.')
      router.replace('/login')
      return
    }

    setSaving(true)
    try {
      const toSave = rows
        .map((r) => ({ r, labor: laborByCodigo.get(r.laborCodigo) ?? null }))
        .filter(({ r, labor }) => {
          const hasAny =
            !!r.laborCodigo ||
            !!r.loteId ||
            !!r.hectareas ||
            !!r.jornales ||
            !!r.cantidadInsumo ||
            !!r.kg ||
            !!r.obs ||
            !!r.redId ||
            !!r.sectorId ||
            !!r.encargadoCodigo
            || !!r.yaramilaKg
            || !!r.templeFertKg
            || !!r.templeKg
            || !!r.calmaxKg
            || !!r.adherenteLit
            || !!r.herbicidaLit
            || !!r.herbosatoLit
            || !!r.grapasUni
            || !!r.papelUni
            || !!r.variedad
            || !!r.puntos
          return hasAny && !!labor
        })

      if (toSave.length === 0) {
        toast.error('Agrega al menos una fila con labor y datos.')
        return
      }

      for (const { r, labor } of toSave) {
        if (!labor) throw new Error('Selecciona una labor en todas las filas usadas.')
        if (!r.loteId) throw new Error('Selecciona Lote en todas las filas usadas.')
        if (!String(r.encargadoCodigo ?? '').trim()) throw new Error('Selecciona Encargado en todas las filas usadas.')

        const hect = toNum(r.hectareas)
        const jorn = toNum(r.jornales)
        if (hect <= 0) throw new Error('HA debe ser mayor a 0 en todas las filas usadas.')
        if (jorn < 0) throw new Error('Jornales no puede ser negativo.')

        const tipo = getTipoLabor(labor)
        const kgVal = toNum(r.kg)
        const cantVal = toNum(r.cantidadInsumo)

        if (tipo !== 'MANO_OBRA' && kgVal <= 0 && cantVal <= 0) {
          throw new Error('Ingresa KG o Cantidad (mayor a 0) en filas de Insumo/Producción.')
        }
      }

      let inserts = 0
      let updates = 0

      for (const { r, labor } of toSave) {
        if (!labor) continue

        const tipo = getTipoLabor(labor)
        const cultivo = deptoSel?.cultivo ?? labor.cultivo ?? ''
        const fundo = deptoSel?.fundo ?? lotes.find((l) => l.lote_id === r.loteId)?.fundo ?? null

        let cantidadDB: number | null = null
        let unidadDB: string | null = null

        const kgVal = toNum(r.kg)
        const cantVal = toNum(r.cantidadInsumo)

        if (kgVal > 0) {
          cantidadDB = kgVal
          unidadDB = 'KG'
        } else if (cantVal > 0) {
          cantidadDB = cantVal
          const umAuto = norm(labor.um)
          unidadDB = umAuto ? umAuto : null
        }

        const payloadBase = {
          fecha,
          user_id: userId,
          email: (userEmail ?? '').trim().toLowerCase(),
          encargado_codigo: r.encargadoCodigo.trim(),
          cultivo,
          fundo,
          depto_id: deptoId,
          tipo_labor: tipo,
          hectareas: toNum(r.hectareas),
          jornales: toNum(r.jornales),
          cantidad: cantidadDB,
          unidad: unidadDB,
          observacion: r.obs || null,
          lote_id: r.loteId,
          red_id: r.redId || null,
          sector_id: r.sectorId || null,
          yaramila_kg: toNum(r.yaramilaKg) > 0 ? toNum(r.yaramilaKg) : null,
          temple_fert_kg: toNum(r.templeFertKg) > 0 ? toNum(r.templeFertKg) : null,
          temple_kg: toNum(r.templeKg) > 0 ? toNum(r.templeKg) : null,
          calmax_kg: toNum(r.calmaxKg) > 0 ? toNum(r.calmaxKg) : null,
          adherente_lit: toNum(r.adherenteLit) > 0 ? toNum(r.adherenteLit) : null,
          herbicida_lit: toNum(r.herbicidaLit) > 0 ? toNum(r.herbicidaLit) : null,
          herbosato_lit: toNum(r.herbosatoLit) > 0 ? toNum(r.herbosatoLit) : null,
          grapas_uni: toNum(r.grapasUni) > 0 ? toNum(r.grapasUni) : null,
          papel_uni: toNum(r.papelUni) > 0 ? toNum(r.papelUni) : null,
          variedad: (r.variedad || '').trim() ? (r.variedad || '').trim() : null,
          puntos: toNum(r.puntos) > 0 ? toNum(r.puntos) : null,
        }

        const payload = { ...payloadBase, labor_id: String(labor.codigo) }

        if (r.dbId) {
          const res = await supabase.from('avance_labor_diario').update(payload).eq('id', r.dbId)
          if (res.error) throw res.error
          updates += 1
        } else {
          const res = await supabase.from('avance_labor_diario').insert(payload).select('id').single()
          if (res.error) throw res.error
          const newId = (res.data as { id: string } | null)?.id
          if (newId) {
            setRows((prev) => prev.map((x) => (x._id === r._id ? { ...x, dbId: newId } : x)))
          }
          inserts += 1
        }
      }

      toast.success(`Registros guardados ✅ (Nuevos: ${inserts}, Actualizados: ${updates})`)
      // 👈 NO limpiamos la pantalla. Así quedan visibles para editar.
    } catch (e: unknown) {
      console.error(e)
      toast.error(errMsg(e, 'Error al guardar'))
    } finally {
      setSaving(false)
    }
  }

  // Si cambian los deptos permitidos, asegurar que el seleccionado sea válido
  useEffect(() => {
    if (allowedDeptoIds.length === 0) return
    if (!deptoId || !allowedDeptoIds.includes(deptoId)) {
      setDeptoId(allowedDeptoIds[0])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedDeptoIds.join('|')])

  // ✅ Si cambia el FUNDO del departamento, limpiar lotes no permitidos en las filas
  useEffect(() => {
    const f = norm(deptoSel?.fundo)
    if (!f) return

    const allowed = LOTES_PERMITIDOS_POR_FUNDO[f]
    if (!allowed) return

    setRows((prev) =>
      prev.map((r) => {
        const lote = String(r.loteId ?? '').trim()
        if (!lote) return r
        if (allowed.has(lote)) return r
        return { ...r, loteId: '', redId: '', sectorId: '' }
      })
    )
  }, [deptoSel?.fundo])

  if (loading) return <div className="p-6">Cargando…</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Avance diario de labores</h1>
            <p className="text-sm text-gray-600">
              Registra a nivel <b>Lote</b> / <b>Red</b> / <b>Sector</b>. Agrega y quita filas como en el Plan Mensual.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              className={btnGhost}
              onClick={() => {
                if (userRole === 'USUARIO') return
                router.push('/plan-mensual')
              }}
              disabled={userRole === 'USUARIO'}
              title={userRole === 'USUARIO' ? 'No disponible para usuarios' : 'Ir a Plan Mensual'}
            >
              Ir a Plan Mensual
            </button>
          </div>
        </div>

        <div className={card + ' p-4'}>
          {/* Arriba: Fecha + Departamento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className={label}>Fecha</div>
              <input className={inputCls + ' w-full'} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>

            <div>
              <div className={label}>Departamento</div>
              <select
                className={inputCls + ' w-full'}
                value={deptoId}
                onChange={(e) => setDeptoId(e.target.value)}
                disabled={deptoSelectLocked}
              >
                {!deptoSelectLocked && <option value="">— Seleccionar —</option>}
                {deptos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.departamento ?? d.id} {d.cultivo ? `(${d.cultivo})` : ''} {d.fundo ? `- ${d.fundo}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Botón antes de los recuadros para agregar un nuevo DETALLE (otra labor) */}
          <div className="mt-4 flex items-center justify-end">
            <button className={btnGhost} type="button" onClick={addDetalle}>
              + Nuevo detalle
            </button>
          </div>

          {/* Detalles (recuadros) */}
          <div className="mt-3 space-y-4">
            {detalles.map((det, detIdx) => {
              const rowsDet = rows.filter((r) => r.detalleId === det.id)

              return (
                <DetalleCard
                  key={det.id}
                  det={det}
                  detIdx={detIdx}
                  rowsDet={rowsDet}
                  cardClassName={card}
                  labelClassName={label}
                  inputClassName={inputCls}
                  btnGhostClassName={btnGhost}
                  deptoId={deptoId}
                  subgruposOptions={subgruposOptions}
                  laboresFiltradasPorDepto={laboresFiltradasPorDepto}
                  lotesFiltradosPorFundo={lotesFiltradosPorFundo}
                  redes={redes}
                  sectores={sectores}
                  encargadoByCodigo={encargadoByCodigo}
                  obsOpenIds={obsOpenIds}
                  onToggleObs={toggleObs}
                  onUpdateRow={updateRow}
                  onOpenEncModal={openEncModal}
                  onAddRow={() => addRowForDetalle(det.id)}
                  onRemoveDetalle={() => void removeDetalle(det.id)}
                  onSubgrupoChange={(v) => {
                    setDetalles((prev) => prev.map((x) => (x.id === det.id ? { ...x, selSubgrupo: v, selLaborCodigo: '' } : x)))
                    setRows((prev) => prev.map((r) => (r.detalleId === det.id && !r.subgrupo ? { ...r, subgrupo: v } : r)))
                  }}
                  onLaborChange={(v) => {
                    setDetalles((prev) => prev.map((x) => (x.id === det.id ? { ...x, selLaborCodigo: v } : x)))
                    setRows((prev) =>
                      prev.map((r) =>
                        r.detalleId === det.id && !r.laborCodigo
                          ? { ...r, laborCodigo: v, subgrupo: r.subgrupo || det.selSubgrupo }
                          : r
                      )
                    )
                  }}
                  onExtraToAddChange={(v) => setDetalleExtraToAdd(det.id, v)}
                  onAddExtraCol={() => addExtraColForDetalle(det.id)}
                  onRemoveExtraCol={(k) => removeExtraColForDetalle(det.id, k)}
                  onRemoveRow={(rowId) => void removeRow(rowId)}
                />
              )
            })}

            {resumenPorDetalle.length > 0 && (
              <div className={card + ' p-4'}>
                <div className="text-xs text-gray-700">
                  <div className="font-semibold text-gray-800">Promedios por HA (por detalle / labor)</div>
                  <div className="mt-1 space-y-1">
                    {resumenPorDetalle.map((it) => (
                      <div key={it.laborCodigo} className="flex flex-wrap gap-x-2 gap-y-1">
                        <span className="text-gray-900">• {it.label}:</span>
                        <span>
                          Jornales/HA <b>{fmt2(it.jornPorHa)}</b>
                        </span>
                        <span className="text-gray-400">|</span>
                        <span>
                          Cantidad/HA <b>{fmt2(it.cantPorHa)}</b>
                        </span>
                        <span className="text-gray-400">|</span>
                        <span>
                          KG/HA <b>{fmt2(it.kgPorHa)}</b>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <EncargadoModal
            open={encModalOpen}
            btn={btn}
            btnGhost={btnGhost}
            inputCls={inputCls}
            label={label}
            working={encWorking}
            search={encSearch}
            setSearch={setEncSearch}
            onClose={closeEncModal}
            onAddOpen={openAddEncForm}
            formOpen={encFormOpen}
            formMode={encFormMode}
            formCodigo={encFormCodigo}
            setFormCodigo={setEncFormCodigo}
            formNombre={encFormNombre}
            setFormNombre={setEncFormNombre}
            onFormClose={closeEncForm}
            onFormSave={() => void saveEncargado()}
            filtrados={encFiltrados}
            onSeleccionar={(codigo: string | number) => {
              if (!encModalRowId) return
              updateRow(encModalRowId, { encargadoCodigo: String(codigo).trim() })
              closeEncModal()
            }}
            onEditar={(codigo: string | number, nombre: string) =>
              openEditEncForm(String(codigo).trim(), String(nombre ?? '').trim())
            }
            onQuitar={(codigo: string | number) => void desactivarEncargado(String(codigo).trim())}
          />

          {/* Botones */}
          <div className="mt-4 flex items-center justify-end gap-2">
            <button className={btnGhost} type="button" onClick={() => router.back()}>
              Volver
            </button>
            <button className={btn} type="button" disabled={!puedeGuardar || saving} onClick={guardar}>
              {saving ? 'Guardando…' : 'Guardar registros'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}