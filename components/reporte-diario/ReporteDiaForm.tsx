'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import BloqueEncargado, {
  type Lote,
  type Red,
  type Labor,
  type Sector,
  type ReporteBloque,
  type Option,
} from './BloqueEncargado'

type Props = {
  userEmail: string
}

type Depto = {
  id: string
  departamento: string | null
  jefe: string | null
  cultivo: string | null
  fundo: string | null
  activo: boolean | null
}

type ProfileRow = { rol: string | null }

type JefesAccesoV2Row = {
  depto_id: string | null
  email: string | null
  activo: boolean | null
}

const labelCls = 'text-xs font-medium text-gray-600'
const inputCls = 'w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-600/20'
const selectCls = inputCls
const cardCls = 'rounded-xl border border-gray-300 bg-white p-6 shadow-sm'
const btnPrimary =
  'inline-flex items-center justify-center rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed'

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function norm(v: unknown): string {
  return String(v ?? '').trim().toUpperCase()
}

function aplicaSelectorFundo(depto: Depto | null): boolean {
  const dep = norm(depto?.departamento)
  const cul = norm(depto?.cultivo)
  return dep.includes('LABORES') && (cul.includes('PALTO') || cul.includes('PALTA'))
}

function uniqueDeptos(list: Depto[]): Depto[] {
  const seen = new Set<string>()
  const out: Depto[] = []
  for (const d of list) {
    const key = `${norm(d.departamento)}__${norm(d.cultivo)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(d)
  }
  return out
}

const FUNDO1_LOTES_PREFIX = ['L01', 'L02', 'L09', 'L11', 'L12']
const FUNDO2_LOTES_PREFIX = ['L03', 'L04', 'L06', 'L16']

function lotePrefix3(loteId: string): string {
  return String(loteId ?? '').trim().substring(0, 3).toUpperCase()
}

export default function ReporteDiaForm({ userEmail }: Props) {
  const [fecha, setFecha] = useState<string>(todayISO())
  const [deptos, setDeptos] = useState<Depto[]>([])
  const [deptoId, setDeptoId] = useState<string>('')

  const deptoSel = useMemo(() => deptos.find((d) => d.id === deptoId) ?? null, [deptos, deptoId])

  const showFundo = useMemo(() => aplicaSelectorFundo(deptoSel), [deptoSel])
  const [fundo, setFundo] = useState<string>('')

  const [bloques, setBloques] = useState<ReporteBloque[]>([])

  const [loadingDeptos, setLoadingDeptos] = useState<boolean>(false)
  const [loadingCatalogos, setLoadingCatalogos] = useState<boolean>(false)

  const [lotes, setLotes] = useState<Lote[]>([])
  const [redes, setRedes] = useState<Red[]>([])
  const [labores, setLabores] = useState<Labor[]>([])
  const [sectores, setSectores] = useState<Sector[]>([])

  const [saving, setSaving] = useState<boolean>(false)

  const canAddEncargado = useMemo(() => {
    if (loadingDeptos || loadingCatalogos) return false
    if (!deptoId) return false
    if (showFundo && !fundo) return false
    return true
  }, [loadingDeptos, loadingCatalogos, deptoId, showFundo, fundo])

  const redesPorLote = useMemo(() => {
    const m = new Map<string, Red[]>()
    for (const r of redes) {
      const arr = m.get(r.lote_id) ?? []
      arr.push(r)
      m.set(r.lote_id, arr)
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => String(a.red_id ?? '').localeCompare(String(b.red_id ?? '')))
      m.set(k, arr)
    }
    return m
  }, [redes])

  // ========= SUBGRUPOS + LABORES FILTRADAS =========
  const subgruposOptions: Option[] = useMemo(() => {
    const set = new Set<string>()
    for (const l of labores ?? []) {
      const sg = String(l.subgrupo ?? '').trim()
      if (sg) set.add(sg)
    }
    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((sg) => ({ value: sg, label: sg }))
  }, [labores])

  const laboresOptions: Option[] = useMemo(() => {
    return (labores ?? []).map((l) => ({
      value: `${l.codigo} - ${l.nombre}`,
      label: `${l.codigo} - ${l.nombre}`,
    }))
  }, [labores])

  const laboresPorSubgrupo: Record<string, Option[]> = useMemo(() => {
    const out: Record<string, Option[]> = {}
    for (const l of labores ?? []) {
      const sg = String(l.subgrupo ?? '').trim()
      if (!sg) continue
      if (!out[sg]) out[sg] = []
      out[sg].push({ value: `${l.codigo} - ${l.nombre}`, label: `${l.codigo} - ${l.nombre}` })
    }
    for (const k of Object.keys(out)) out[k].sort((a, b) => a.label.localeCompare(b.label))
    return out
  }, [labores])

  const sectoresPorLoteRed = useMemo(() => {
    const m = new Map<string, Sector[]>()
    for (const s of sectores) {
      const key = `${s.lote_id}__${String(s.red_id ?? '')}`
      const arr = m.get(key) ?? []
      arr.push(s)
      m.set(key, arr)
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => String(a.sector_id ?? '').localeCompare(String(b.sector_id ?? '')))
      m.set(k, arr)
    }
    return m
  }, [sectores])

  useEffect(() => {
    if (!showFundo) setFundo('')
  }, [showFundo])

  // Cargar departamentos según rol
  useEffect(() => {
    let alive = true

    const run = async () => {
      if (!userEmail) return
      setLoadingDeptos(true)

      try {
        const { data: perfilData, error: perErr } = await supabase.from('profiles').select('rol').eq('email', userEmail).maybeSingle()
        if (perErr) throw perErr
        const perfil = (perfilData ?? null) as ProfileRow | null
        const rol = norm(perfil?.rol)

        if (rol === 'ADMIN') {
          const { data, error } = await supabase
            .from('deptos')
            .select('id, departamento, jefe, cultivo, fundo, activo')
            .eq('activo', true)
            .order('departamento', { ascending: true })
            .order('cultivo', { ascending: true })
            .order('fundo', { ascending: true })

          if (error) throw error
          if (!alive) return

          const list = uniqueDeptos((data ?? []) as Depto[])
          setDeptoId((prev) => (prev && list.some((d) => d.id === prev) ? prev : ''))
          setDeptos(list)
          return
        }

        const emailKey = String(userEmail).trim().toLowerCase()
        const { data: accData, error: accErr } = await supabase
          .from('jefes_acceso_v2')
          .select('depto_id, email, activo')
          .eq('email', emailKey)
          .eq('activo', true)

        if (accErr) throw accErr

        const accesos = (accData ?? []) as JefesAccesoV2Row[]
        const ids = accesos.map((a) => a.depto_id).filter((x): x is string => !!x)

        if (!ids.length) {
          if (!alive) return
          setDeptos([])
          setDeptoId('')
          toast.error('No tienes departamentos asignados')
          return
        }

        const { data: deps, error: depErr } = await supabase
          .from('deptos')
          .select('id, departamento, jefe, cultivo, fundo, activo')
          .in('id', ids)
          .eq('activo', true)
          .order('departamento', { ascending: true })
          .order('cultivo', { ascending: true })
          .order('fundo', { ascending: true })

        if (depErr) throw depErr
        if (!alive) return

        const list = uniqueDeptos((deps ?? []) as Depto[])
        setDeptoId((prev) => (prev && list.some((d) => d.id === prev) ? prev : ''))
        setDeptos(list)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al cargar departamentos'
        toast.error(msg)
      } finally {
        if (alive) setLoadingDeptos(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [userEmail])

  // Cargar catálogos (lotes/redes/labores/sectores)
  useEffect(() => {
    let alive = true

    const run = async () => {
      if (!deptoSel || !deptoId) {
        setLotes([])
        setRedes([])
        setLabores([])
        setSectores([])
        return
      }

      if (showFundo && !fundo) {
        setLotes([])
        setRedes([])
        setLabores([])
        setSectores([])
        return
      }

      setLoadingCatalogos(true)
      try {
        // 1) Lotes
        let qLotes = supabase.from('lotes').select('lote_id, cultivo, fundo, ha_total, activo').eq('activo', true)

        const cultivo = String(deptoSel.cultivo ?? '').trim()
        if (cultivo) qLotes = qLotes.eq('cultivo', cultivo)

        const { data: lotesData, error: lotErr } = await qLotes.order('lote_id', { ascending: true })
        if (lotErr) throw lotErr

        let lotesList = (lotesData ?? []) as Lote[]

        // Filtro lógico por fundo (porque en BD lotes.fundo = NULL)
        if (showFundo && fundo) {
          const allowed = fundo === 'FUNDO1' ? FUNDO1_LOTES_PREFIX : FUNDO2_LOTES_PREFIX
          lotesList = lotesList.filter((l) => allowed.includes(lotePrefix3(l.lote_id)))
        }

        const loteIds = lotesList.map((l) => l.lote_id)

        // 2) Redes
        let redesList: Red[] = []
        if (loteIds.length) {
          const { data: redesData, error: redErr } = await supabase.from('redes').select('red_ref, lote_id, red_id').in('lote_id', loteIds)
          if (redErr) throw redErr
          redesList = (redesData ?? []) as Red[]
        }

        // 3) Labores (AHORA incluye subgrupo)
        let qLab = supabase.from('labores').select('codigo, nombre, subgrupo, departamento, cultivo, activo').eq('activo', true)

        const depName = String(deptoSel.departamento ?? '').trim()
        if (depName) qLab = qLab.eq('departamento', depName)
        if (cultivo) qLab = qLab.eq('cultivo', cultivo)

        const { data: labData, error: labErr } = await qLab.order('codigo', { ascending: true })
        if (labErr) throw labErr
        const laboresList = (labData ?? []) as Labor[]

        // 4) Sectores
        let sectoresList: Sector[] = []
        if (loteIds.length) {
          const { data: secData, error: secErr } = await supabase.from('sectores').select('sector_id, lote_id, red_id').in('lote_id', loteIds)
          if (secErr) throw secErr
          sectoresList = (secData ?? []) as Sector[]
        }

        if (!alive) return
        setLotes(lotesList)
        setRedes(redesList)
        setLabores(laboresList)
        setSectores(sectoresList)

        // Sanitizar bloques si cambias depto/fundo
        setBloques((prev) =>
          prev.map((b) => {
            const loteOk = !b.lote_id || loteIds.includes(b.lote_id)
            if (!loteOk) return { ...b, lote_id: '', red_id: '' }

            const reds = redesList.filter((r) => r.lote_id === b.lote_id)
            const redOk = !b.red_id || reds.some((r) => r.red_id === b.red_id)
            if (!redOk) return { ...b, red_id: '' }

            return b
          })
        )
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al cargar catálogos'
        toast.error(msg)
      } finally {
        if (alive) setLoadingCatalogos(false)
      }
    }

    run()
    return () => {
      alive = false
    }
  }, [deptoSel, deptoId, showFundo, fundo])

  function addBloque() {
    setBloques((prev) => [
      ...prev,
      {
        encargado_nombre: '',
        lote_id: '',
        red_id: '',
        detalles: [],
      },
    ])
  }

  function updateBloque(i: number, next: ReporteBloque) {
    setBloques((prev) => {
      const copy = [...prev]
      copy[i] = next
      return copy
    })
  }

  function removeBloque(i: number) {
    setBloques((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function guardarReporte() {
    if (!deptoId) return toast.error('Selecciona un departamento')
    if (showFundo && !fundo) return toast.error('Selecciona un fundo')
    if (bloques.length === 0) return toast.error('Agrega al menos un encargado')

    if (!deptoSel) return toast.error('Selecciona un departamento válido')

    const cultivoSel = String(deptoSel.cultivo ?? '').trim()
    const tipoProgramaSel = String(deptoSel.departamento ?? '').trim()
    if (!cultivoSel) return toast.error('El departamento seleccionado no tiene cultivo')
    if (!tipoProgramaSel) return toast.error('El departamento seleccionado no tiene nombre')

    const supervisorEmail = String(userEmail ?? '').trim().toLowerCase()
    if (!supervisorEmail) return toast.error('No se encontró el email del usuario')

    for (let bi = 0; bi < bloques.length; bi++) {
      const b = bloques[bi]
      if (!String(b.encargado_nombre ?? '').trim()) return toast.error(`Encargado ${bi + 1}: ingresa el nombre`)
      if (!String(b.lote_id ?? '').trim()) return toast.error(`Encargado ${bi + 1}: selecciona un lote`)
      if (!b.detalles?.length) return toast.error(`Encargado ${bi + 1}: agrega al menos una labor`)
      for (let di = 0; di < b.detalles.length; di++) {
        const d = b.detalles[di]
        if (!String(d.labor_texto ?? '').trim()) return toast.error(`Encargado ${bi + 1}, labor ${di + 1}: selecciona una labor`)
      }
    }

    setSaving(true)
    try {
      const { data: repDia, error: repErr } = await supabase
        .from('reporte_dia')
        .insert({
          fecha: fecha,
          supervisor_email: supervisorEmail,
          supervisor_nombre: null,
          cultivo: cultivoSel,
          tipo_programa: tipoProgramaSel,
          estado: 'REGISTRADO',
          observacion: null,
          fundo: showFundo ? (fundo || null) : null,
        })
        .select('id')
        .single()

      if (repErr) throw repErr

      const reporteDiaId = (repDia as { id: string } | null)?.id
      if (!reporteDiaId) throw new Error('No se pudo obtener el ID del reporte_dia')

      const parseLaborCodigo = (laborTexto: string): number | null => {
        const s = String(laborTexto ?? '').trim()
        // esperado: "3150 - PAL-..."
        const m = s.match(/^\s*(\d+)\s*[-–]/)
        if (!m) return null
        const n = Number(m[1])
        return Number.isFinite(n) ? n : null
      }

      for (const b of bloques) {
        const { data: repBloque, error: bloErr } = await supabase
          .from('reporte_bloque')
          .insert({
            reporte_id: reporteDiaId,
            encargado_nombre: String(b.encargado_nombre ?? '').trim(),
            encargado_email: supervisorEmail || null,
            lote_id: String(b.lote_id ?? '').trim() || null,
            red_id: String(b.red_id ?? '').trim() || null,
          })
          .select('id')
          .maybeSingle()

        if (bloErr) throw bloErr
        const reporteBloqueId = (repBloque as { id: string } | null)?.id
        if (!reporteBloqueId) throw new Error('No se pudo obtener el ID del reporte_bloque')

        const detallesRows = (b.detalles ?? []).map((d) => {
          const laborTexto = String(d.labor_texto ?? '').trim()
          const laborCodigo = parseLaborCodigo(laborTexto)
          return {
            bloque_id: reporteBloqueId,
            sectores: String(d.sectores ?? '').trim() || null,
            comedor: String(d.comedor ?? '').trim() || null,
            labor_codigo: laborCodigo,
            labor_texto: laborTexto,
            jor_prog: Number(d.jor_prog ?? 0) || 0,
            jor_real: Number(d.jor_real ?? 0) || 0,
          }
        })

        if (detallesRows.length) {
          const { error: detErr } = await supabase.from('reporte_bloque_detalle').insert(detallesRows)
          if (detErr) throw detErr
        }
      }

      toast.success('Reporte guardado')
      setBloques([])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar'

      // Log para depurar (sin usar `any`)
      // eslint-disable-next-line no-console
      console.error('guardarReporte error:', e)

      const getField = (err: unknown, key: 'code' | 'details' | 'hint'): string => {
        if (!err || typeof err !== 'object') return ''
        const rec = err as Record<string, unknown>
        const val = rec[key]
        return typeof val === 'string' ? val : ''
      }

      const supaDetails = [getField(e, 'code'), getField(e, 'details'), getField(e, 'hint')].filter(Boolean).join(' | ')

      toast.error(supaDetails ? `${msg} (${supaDetails})` : msg || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cardCls}>
      <div className="mb-4">
        <div className="text-lg font-semibold">Reporte Diario</div>
        <div className="text-sm text-gray-600">Registro de jornales reales por encargado de lote</div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="rep-fecha">
            Fecha
          </label>
          <input id="rep-fecha" type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>

        <div>
          <label className={labelCls} htmlFor="rep-depto">
            Departamento
          </label>
          <select id="rep-depto" className={selectCls} value={deptoId} onChange={(e) => setDeptoId(e.target.value)} disabled={loadingDeptos}>
            <option value="">{loadingDeptos ? 'Cargando...' : 'Selecciona...'}</option>
            {deptos.map((d) => {
              const dep = String(d.departamento ?? '').trim()
              const cul = String(d.cultivo ?? '').trim()
              const txt = cul ? `${dep} - ${cul}` : dep
              return (
                <option key={d.id} value={d.id}>
                  {txt}
                </option>
              )
            })}
          </select>
        </div>

        {showFundo ? (
          <div className="md:col-span-2">
            <label className={labelCls} htmlFor="rep-fundo">
              Fundo
            </label>
            <select id="rep-fundo" className={selectCls} value={fundo} onChange={(e) => setFundo(e.target.value)}>
              <option value="">Selecciona...</option>
              <option value="FUNDO1">Fundo 1</option>
              <option value="FUNDO2">Fundo 2</option>
            </select>
            <div className="mt-1 text-xs text-gray-500">
              * Solo aplica para <strong>LABORES - PALTO</strong>.
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Encargados</h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={guardarReporte}
            className={btnPrimary}
            disabled={saving || !deptoId || (showFundo && !fundo) || bloques.length === 0}
            title={bloques.length === 0 ? 'Agrega al menos un encargado' : 'Guardar reporte'}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!deptoId) {
                toast.error('Selecciona un departamento')
                return
              }
              if (showFundo && !fundo) {
                toast.error('Selecciona un fundo')
                return
              }
              addBloque()
            }}
            className={btnPrimary}
            disabled={!canAddEncargado}
            title={!deptoId ? 'Selecciona un departamento' : showFundo && !fundo ? 'Selecciona un fundo' : 'Agregar encargado'}
          >
            + Agregar Encargado
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {bloques.map((b, i) => (
          <BloqueEncargado
            key={i}
            bloqueIndex={i}
            bloque={b}
            onChange={(nb) => updateBloque(i, nb)}
            onRemove={() => removeBloque(i)}
            lotes={lotes}
            redesPorLote={redesPorLote}
            subgruposOptions={subgruposOptions}
            laboresOptions={laboresOptions}
            laboresPorSubgrupo={laboresPorSubgrupo}
            sectoresPorLoteRed={sectoresPorLoteRed}
            loadingCatalogos={loadingCatalogos}
          />
        ))}

        {bloques.length === 0 ? (
          <div className="border border-dashed p-4 text-gray-500 text-sm">No hay encargados aún. Usa “+ Agregar Encargado”.</div>
        ) : null}

        {loadingCatalogos ? <div className="text-xs text-gray-500">Cargando catálogos (lotes/redes/labores/sectores)...</div> : null}
      </div>
    </div>
  )
}