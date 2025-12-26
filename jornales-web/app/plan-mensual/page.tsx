'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Depto = {
  id: string
  cultivo: string | null
  fundo: string | null
  jefe: string | null
  activo?: boolean | null
}

type Lote = {
  lote_id: string
  cultivo: string | null
  fundo: string | null
  ha_total?: number | null
  activo?: boolean | null
}

type Sector = {
  sector_id: string
  lote_id: string
  red_id: string | null
  ha: number | null
  variedad: string | null
}

type Labor = {
  codigo: number
  nombre: string
  ratio_default: number | null
  cultivo: string | null
  departamento: string | null
  um?: string | null
  activo?: boolean | null
}

type PlanFila = {
  ui_id: string
  fecha: string
  linea: number
  lote_id: string
  red_id: string
  sector_id: string
  codigo_labor: number | null
  ha_prog: number
  jornales_prog: number
  obs: string
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const isoDate = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`
const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate()
const uid = () => crypto.randomUUID()

const MESES = [
  { n: 1, label: 'Enero' },
  { n: 2, label: 'Febrero' },
  { n: 3, label: 'Marzo' },
  { n: 4, label: 'Abril' },
  { n: 5, label: 'Mayo' },
  { n: 6, label: 'Junio' },
  { n: 7, label: 'Julio' },
  { n: 8, label: 'Agosto' },
  { n: 9, label: 'Septiembre' },
  { n: 10, label: 'Octubre' },
  { n: 11, label: 'Noviembre' },
  { n: 12, label: 'Diciembre' },
]

function clampDateToMonth(anio: number, mes: number, fechaISO: string) {
  const first = isoDate(anio, mes, 1)
  const last = isoDate(anio, mes, daysInMonth(anio, mes))
  if (!fechaISO) return first
  if (fechaISO < first) return first
  if (fechaISO > last) return last
  return fechaISO
}

function enumerateDates(fromISO: string, toISO: string) {
  const res: string[] = []
  const from = new Date(fromISO + 'T00:00:00')
  const to = new Date(toISO + 'T00:00:00')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return res
  if (from > to) return res
  const d = new Date(from)
  while (d <= to) {
    res.push(isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate()))
    d.setDate(d.getDate() + 1)
  }
  return res
}

export default function PlanMensualPage() {
  const router = useRouter()

  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // ✅ Guard sesión
  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) router.replace('/login')
    }
    run()
  }, [router])

  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)

  const [deptos, setDeptos] = useState<Depto[]>([])
  const [deptoId, setDeptoId] = useState('')
  const deptoSel = useMemo(() => deptos.find((d) => d.id === deptoId) ?? null, [deptos, deptoId])

  const [planId, setPlanId] = useState('')

  const [lotes, setLotes] = useState<Lote[]>([])
  const [sectores, setSectores] = useState<Sector[]>([])
  const [labores, setLabores] = useState<Labor[]>([])

  const [filas, setFilas] = useState<Record<string, PlanFila[]>>({})

  // ✅ Acciones rápidas (rango)
  const [rangoPorDia, setRangoPorDia] = useState<Record<string, { desde: string; hasta: string }>>({})
  const [modoCopiaPorDia, setModoCopiaPorDia] = useState<Record<string, 'AGREGAR' | 'REEMPLAZAR'>>({})

  // ✅ Nivel 2.5: destino por fila
  const [destinoPorFila, setDestinoPorFila] = useState<Record<string, string>>({})

  // Cargar deptos
  useEffect(() => {
    const run = async () => {
      setErrorMsg('')
      const { data, error } = await supabase
        .from('deptos')
        .select('id, cultivo, fundo, jefe, activo')
        .eq('activo', true)
        .order('id')

      if (error) {
        console.error(error)
        setErrorMsg(error.message)
        setDeptos([])
        return
      }
      setDeptos((data ?? []) as Depto[])
    }
    run()
  }, [])

  // Al cambiar depto: cargar maestros
  useEffect(() => {
    const run = async () => {
      setErrorMsg('')
      setPlanId('')
      setFilas({})
      setRangoPorDia({})
      setModoCopiaPorDia({})
      setDestinoPorFila({})
      setLotes([])
      setSectores([])
      setLabores([])

      if (!deptoSel) return
      setLoading(true)

      // LOTES
      let qLotes = supabase.from('lotes').select('lote_id, cultivo, fundo, ha_total, activo').eq('activo', true)
      if (deptoSel.cultivo) qLotes = qLotes.eq('cultivo', deptoSel.cultivo)
      if (deptoSel.fundo) qLotes = qLotes.eq('fundo', deptoSel.fundo)

      const { data: lotesData, error: lotesErr } = await qLotes.order('lote_id')
      if (lotesErr) {
        console.error(lotesErr)
        setErrorMsg(lotesErr.message)
        setLoading(false)
        return
      }
      setLotes((lotesData ?? []) as Lote[])

      // SECTORES
      const { data: secData, error: secErr } = await supabase
        .from('sectores')
        .select('sector_id, lote_id, red_id, ha, variedad')
        .order('lote_id')
        .order('red_id')
        .order('sector_id')

      if (secErr) {
        console.error(secErr)
        setErrorMsg(secErr.message)
        setLoading(false)
        return
      }
      setSectores((secData ?? []) as Sector[])

      // LABORES
      let qLab = supabase.from('labores').select('codigo, nombre, ratio_default, cultivo, departamento, um, activo').eq('activo', true)
      if (deptoSel.cultivo) qLab = qLab.eq('cultivo', deptoSel.cultivo)

      const { data: labData, error: labErr } = await qLab.order('nombre')
      if (labErr) {
        console.error(labErr)
        setErrorMsg(labErr.message)
        setLoading(false)
        return
      }
      setLabores((labData ?? []) as Labor[])

      setLoading(false)
    }
    run()
  }, [deptoSel])

  // Asegurar plan
  useEffect(() => {
    const run = async () => {
      setErrorMsg('')
      setPlanId('')
      if (!deptoSel || !anio || !mes) return

      const { data: found, error: errFind } = await supabase
        .from('planes')
        .select('id')
        .eq('anio', anio)
        .eq('mes', mes)
        .eq('depto_id', deptoSel.id)
        .maybeSingle()

      if (errFind) {
        console.error(errFind)
        setErrorMsg(errFind.message)
        return
      }

      if (found?.id) {
        setPlanId(found.id)
        return
      }

      const { data: created, error: errCreate } = await supabase
        .from('planes')
        .insert([{ anio, mes, depto_id: deptoSel.id, jefe: deptoSel.jefe ?? null, estado: 'BORRADOR' }])
        .select('id')
        .single()

      if (errCreate) {
        console.error(errCreate)
        setErrorMsg(errCreate.message)
        return
      }
      if (!created?.id) return setErrorMsg('No se pudo crear el plan (id vacío).')

      setPlanId(created.id)
    }
    run()
  }, [anio, mes, deptoSel])

  // Inicializar días
  useEffect(() => {
    if (!planId) return

    const dim = daysInMonth(anio, mes)
    const base: Record<string, PlanFila[]> = {}
    const baseRangos: Record<string, { desde: string; hasta: string }> = {}
    const baseModo: Record<string, 'AGREGAR' | 'REEMPLAZAR'> = {}

    for (let d = 1; d <= dim; d++) {
      const f = isoDate(anio, mes, d)
      base[f] = []
      baseRangos[f] = { desde: f, hasta: isoDate(anio, mes, dim) }
      baseModo[f] = 'AGREGAR'
    }

    setFilas(base)
    setRangoPorDia(baseRangos)
    setModoCopiaPorDia(baseModo)
  }, [planId, anio, mes])

  /* =======================
     Helpers lote/red/sector
  ======================= */

  const getRedsByLote = (lote_id: string) => {
    if (!lote_id) return []
    return Array.from(
      new Set(
        sectores
          .filter((s) => s.lote_id === lote_id)
          .map((s) => s.red_id)
          .filter((x): x is string => !!x)
      )
    )
  }

  const getSectorsByLoteRed = (lote_id: string, red_id: string) => {
    if (!lote_id || !red_id) return []
    return sectores.filter((s) => s.lote_id === lote_id && s.red_id === red_id)
  }

  /* =======================
     Acciones de fila
  ======================= */

  const addFila = (fecha: string) => {
    setFilas((prev) => {
      const list = prev[fecha] ?? []
      const linea = list.length + 1
      const newRow: PlanFila = {
        ui_id: uid(),
        fecha,
        linea,
        lote_id: '',
        red_id: '',
        sector_id: '',
        codigo_labor: null,
        ha_prog: 0,
        jornales_prog: 0,
        obs: '',
      }
      return { ...prev, [fecha]: [...list, newRow] }
    })
  }

  const duplicarFila = (fecha: string, fila: PlanFila) => {
    setFilas((prev) => {
      const list = prev[fecha] ?? []
      return {
        ...prev,
        [fecha]: [...list, { ...fila, ui_id: uid(), fecha, linea: list.length + 1 }],
      }
    })
  }

  const quitarFila = (fecha: string, ui_id: string) => {
    setFilas((prev) => {
      const nextList = (prev[fecha] ?? []).filter((x) => x.ui_id !== ui_id)
      const renum = nextList.map((x, idx) => ({ ...x, linea: idx + 1 }))
      return { ...prev, [fecha]: renum }
    })
  }

  const updateFila = (fecha: string, ui_id: string, patch: Partial<PlanFila>) => {
    setFilas((prev) => ({
      ...prev,
      [fecha]: (prev[fecha] ?? []).map((f) => (f.ui_id === ui_id ? { ...f, ...patch } : f)),
    }))
  }

  // Replicar 1 fila a rango
  const replicarFilaARango = (fechaOrigen: string, fila: PlanFila) => {
    const rango = rangoPorDia[fechaOrigen]
    if (!rango?.desde || !rango?.hasta) return

    const desde = clampDateToMonth(anio, mes, rango.desde)
    const hasta = clampDateToMonth(anio, mes, rango.hasta)
    const fechas = enumerateDates(desde, hasta)

    setFilas((prev) => {
      const next = { ...prev }
      for (const f of fechas) {
        if (!next[f]) continue
        const list = next[f] ?? []
        next[f] = [...list, { ...fila, ui_id: uid(), fecha: f, linea: list.length + 1 }]
      }
      return next
    })
  }

  // Replicar TODO el día a rango
  const replicarDiaARango = (fechaOrigen: string) => {
    const rango = rangoPorDia[fechaOrigen]
    const modo = modoCopiaPorDia[fechaOrigen] ?? 'AGREGAR'
    if (!rango?.desde || !rango?.hasta) return

    const desde = clampDateToMonth(anio, mes, rango.desde)
    const hasta = clampDateToMonth(anio, mes, rango.hasta)
    const fechas = enumerateDates(desde, hasta)

    const origen = filas[fechaOrigen] ?? []
    if (origen.length === 0) return

    setFilas((prev) => {
      const next = { ...prev }

      for (const f of fechas) {
        if (!next[f]) continue

        const baseList = modo === 'REEMPLAZAR' ? [] : (next[f] ?? [])
        const start = baseList.length

        const copias = origen.map((row, idx) => ({
          ...row,
          ui_id: uid(),
          fecha: f,
          linea: start + idx + 1,
        }))

        next[f] = [...baseList, ...copias]
      }

      return next
    })
  }

  // ✅ Nivel 2.5: mover / copiar a fecha destino (sin drag)
  const copiarAFEcha = (fechaOrigen: string, fila: PlanFila, fechaDestino: string) => {
    if (!fechaDestino || !filas[fechaDestino]) return
    if (fechaDestino === fechaOrigen) return

    setFilas((prev) => {
      const next = { ...prev }
      const listDst = next[fechaDestino] ?? []
      const copia: PlanFila = {
        ...fila,
        ui_id: uid(),
        fecha: fechaDestino,
        linea: listDst.length + 1,
      }
      next[fechaDestino] = [...listDst, copia]
      return next
    })
  }

  const moverAFEcha = (fechaOrigen: string, fila: PlanFila, fechaDestino: string) => {
    if (!fechaDestino || !filas[fechaDestino]) return
    if (fechaDestino === fechaOrigen) return

    setFilas((prev) => {
      const next = { ...prev }

      // Quitar de origen
      const src = (next[fechaOrigen] ?? []).filter((x) => x.ui_id !== fila.ui_id)
      next[fechaOrigen] = src.map((x, idx) => ({ ...x, linea: idx + 1 }))

      // Agregar a destino
      const dst = next[fechaDestino] ?? []
      const moved: PlanFila = { ...fila, fecha: fechaDestino, linea: dst.length + 1 } // mantiene ui_id
      next[fechaDestino] = [...dst, moved]

      return next
    })
  }

  /* =======================
     Totales
  ======================= */

  const totalesMes = useMemo(() => {
    const all = Object.values(filas).flat()
    const sumHa = all.reduce((acc, f) => acc + Number(f.ha_prog ?? 0), 0)
    const sumJr = all.reduce((acc, f) => acc + Number(f.jornales_prog ?? 0), 0)
    return { sumHa, sumJr }
  }, [filas])

  const totalesDia = (fecha: string) => {
    const list = filas[fecha] ?? []
    const sumHa = list.reduce((acc, f) => acc + Number(f.ha_prog ?? 0), 0)
    const sumJr = list.reduce((acc, f) => acc + Number(f.jornales_prog ?? 0), 0)
    return { sumHa, sumJr }
  }

  /* =======================
     Guardar (upsert)
  ======================= */

  const guardar = async () => {
    setErrorMsg('')
    if (!planId) return

    const rows = Object.values(filas)
      .flat()
      .filter((f) => f.lote_id && f.sector_id && f.codigo_labor)
      .map((f) => ({
        plan_id: planId,
        fecha: f.fecha,
        linea: f.linea,
        lote_id: f.lote_id,
        red_id: f.red_id || null,
        sector_id: f.sector_id,
        codigo_labor: f.codigo_labor,
        ha_prog: f.ha_prog,
        jornales_prog: f.jornales_prog,
        obs: f.obs,
      }))

    const { error } = await supabase.from('plan_detalle').upsert(rows, {
      onConflict: 'plan_id,fecha,linea',
    })

    if (error) {
      console.error(error)
      setErrorMsg(error.message)
      return
    }
    alert('Plan guardado ✅')
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Planificación Mensual de Jornales</h1>

      {errorMsg ? <div className="text-red-600 font-medium">✖ {errorMsg}</div> : null}
      {loading ? <div className="text-sm text-gray-600">Cargando maestros...</div> : null}

      <div className="text-xs text-gray-600">
        lotes: <b>{lotes.length}</b> | sectores: <b>{sectores.length}</b> | labores: <b>{labores.length}</b>
      </div>

      {/* Controles */}
      <div className="flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-sm font-medium">Año</label>
          <input className="border p-2 rounded w-28" type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </div>

        <div>
          <label className="block text-sm font-medium">Mes</label>
          <select className="border p-2 rounded" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {MESES.map((m) => (
              <option key={m.n} value={m.n}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Departamento</label>
          <select className="border p-2 rounded min-w-[280px]" value={deptoId} onChange={(e) => setDeptoId(e.target.value)}>
            <option value="">Seleccione departamento</option>
            {deptos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id}
              </option>
            ))}
          </select>

          {deptoSel ? (
            <div className="text-xs text-gray-700 mt-1">
              Cultivo: <b>{deptoSel.cultivo ?? '-'}</b> | Fundo: <b>{deptoSel.fundo ?? '-'}</b> | Jefe: <b>{deptoSel.jefe ?? '-'}</b>
            </div>
          ) : null}
        </div>
      </div>

      {/* Totales del mes */}
      <div className="border rounded p-3 text-sm flex gap-6 flex-wrap">
        <div>
          <b>Total HA mes:</b> {totalesMes.sumHa.toFixed(2)}
        </div>
        <div>
          <b>Total Jornales mes:</b> {totalesMes.sumJr.toFixed(2)}
        </div>
      </div>

      {/* Info plan */}
      <div className="border rounded p-4">
        <div className="font-bold">Plan del mes</div>
        {planId ? (
          <div className="text-sm mt-2 space-y-1">
            <div><b>Plan ID:</b> {planId}</div>
            <div><b>Periodo:</b> {anio}-{pad2(mes)}</div>
            <div><b>Depto:</b> {deptoSel?.id ?? '-'}</div>
            <div><b>Estado:</b> BORRADOR</div>
          </div>
        ) : (
          <div className="text-sm mt-2 text-gray-600">Seleccione un departamento.</div>
        )}
      </div>

      {/* Tabla por día */}
      {!planId ? (
        <div className="text-sm text-gray-600">Seleccione un departamento para iniciar.</div>
      ) : (
        Object.keys(filas)
          .sort()
          .map((fecha) => {
            const tDia = totalesDia(fecha)
            const rango = rangoPorDia[fecha] ?? { desde: fecha, hasta: fecha }
            const modo = modoCopiaPorDia[fecha] ?? 'AGREGAR'

            return (
              <div key={fecha} className="border rounded p-4 space-y-3">
                <div className="font-bold flex items-center gap-3 flex-wrap">
                  <span>{fecha}</span>

                  <button className="text-sm underline" onClick={() => addFila(fecha)}>
                    + Agregar actividad
                  </button>

                  <span className="text-xs font-normal text-gray-600 ml-auto">
                    ΣHA: <b>{tDia.sumHa.toFixed(2)}</b> | ΣJornales: <b>{tDia.sumJr.toFixed(2)}</b>
                  </span>
                </div>

                {/* Acciones rápidas (Nivel 2) */}
                <div className="border rounded p-3 bg-gray-50 text-sm flex gap-3 flex-wrap items-end">
                  <div className="text-xs text-gray-700 font-medium">Acciones rápidas:</div>

                  <div>
                    <label className="block text-xs text-gray-600">Desde</label>
                    <input
                      type="date"
                      className="border p-1 rounded"
                      value={rango.desde}
                      onChange={(e) => setRangoPorDia((p) => ({ ...p, [fecha]: { ...rango, desde: e.target.value } }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600">Hasta</label>
                    <input
                      type="date"
                      className="border p-1 rounded"
                      value={rango.hasta}
                      onChange={(e) => setRangoPorDia((p) => ({ ...p, [fecha]: { ...rango, hasta: e.target.value } }))}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600">Modo</label>
                    <select
                      className="border p-1 rounded"
                      value={modo}
                      onChange={(e) => setModoCopiaPorDia((p) => ({ ...p, [fecha]: e.target.value as any }))}
                    >
                      <option value="AGREGAR">Agregar (no borra)</option>
                      <option value="REEMPLAZAR">Reemplazar (borra destino)</option>
                    </select>
                  </div>

                  <button className="border rounded px-3 py-1" onClick={() => replicarDiaARango(fecha)} disabled={(filas[fecha] ?? []).length === 0}>
                    Replicar TODO el día
                  </button>

                  <div className="text-xs text-gray-600">(También puedes usar “Replicar a rango” por fila)</div>
                </div>

                {filas[fecha].length === 0 ? (
                  <div className="text-sm text-gray-500">Sin actividades</div>
                ) : (
                  <div className="overflow-auto">
                    <table className="min-w-[1280px] border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border p-2 bg-gray-50">Lote</th>
                          <th className="border p-2 bg-gray-50">Red</th>
                          <th className="border p-2 bg-gray-50">Sector</th>
                          <th className="border p-2 bg-gray-50">Labor</th>
                          <th className="border p-2 bg-gray-50">HA</th>
                          <th className="border p-2 bg-gray-50">Jornales</th>
                          <th className="border p-2 bg-gray-50">Obs</th>
                          <th className="border p-2 bg-gray-50">Mover/Copiar</th>
                          <th className="border p-2 bg-gray-50"></th>
                        </tr>
                      </thead>

                      <tbody>
                        {filas[fecha].map((f) => {
                          const reds = getRedsByLote(f.lote_id)
                          const sectoresFiltrados = getSectorsByLoteRed(f.lote_id, f.red_id)
                          const destino = destinoPorFila[f.ui_id] ?? ''

                          return (
                            <tr key={f.ui_id}>
                              {/* Lote */}
                              <td className="border p-2">
                                <select
                                  className="border p-1 rounded"
                                  value={f.lote_id}
                                  onChange={(e) => {
                                    const lote_id = e.target.value
                                    const redsLote = getRedsByLote(lote_id)
                                    const firstRed = redsLote[0] ?? ''
                                    const secs = getSectorsByLoteRed(lote_id, firstRed)
                                    const firstSector = secs[0]?.sector_id ?? ''
                                    updateFila(fecha, f.ui_id, { lote_id, red_id: firstRed, sector_id: firstSector })
                                  }}
                                >
                                  <option value="">Seleccione lote</option>
                                  {lotes.map((l) => (
                                    <option key={l.lote_id} value={l.lote_id}>
                                      {l.lote_id}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Red */}
                              <td className="border p-2">
                                <select
                                  className="border p-1 rounded"
                                  value={f.red_id}
                                  onChange={(e) => {
                                    const red_id = e.target.value
                                    const secs = getSectorsByLoteRed(f.lote_id, red_id)
                                    const firstSector = secs[0]?.sector_id ?? ''
                                    updateFila(fecha, f.ui_id, { red_id, sector_id: firstSector })
                                  }}
                                  disabled={!f.lote_id}
                                >
                                  <option value="">{!f.lote_id ? 'Seleccione lote' : 'Seleccione red'}</option>
                                  {reds.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Sector */}
                              <td className="border p-2">
                                <select
                                  className="border p-1 rounded min-w-[280px]"
                                  value={f.sector_id}
                                  onChange={(e) => updateFila(fecha, f.ui_id, { sector_id: e.target.value })}
                                  disabled={!f.red_id}
                                >
                                  <option value="">{!f.red_id ? 'Seleccione red' : 'Seleccione sector'}</option>
                                  {sectoresFiltrados.map((s) => (
                                    <option key={s.sector_id} value={s.sector_id}>
                                      {s.sector_id}
                                      {s.variedad ? ` — ${s.variedad}` : ''}
                                      {s.ha != null ? ` — ${s.ha} ha` : ''}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Labor */}
                              <td className="border p-2">
                                <select
                                  className="border p-1 rounded min-w-[320px]"
                                  value={f.codigo_labor ?? ''}
                                  onChange={(e) => updateFila(fecha, f.ui_id, { codigo_labor: e.target.value ? Number(e.target.value) : null })}
                                >
                                  <option value="">Seleccione labor</option>
                                  {labores.map((l) => (
                                    <option key={l.codigo} value={l.codigo}>
                                      {l.nombre}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* HA */}
                              <td className="border p-2">
                                <input
                                  className="border p-1 rounded w-[90px]"
                                  type="number"
                                  step="0.01"
                                  value={f.ha_prog}
                                  onChange={(e) => {
                                    const ha = Number(e.target.value)
                                    updateFila(fecha, f.ui_id, { ha_prog: Number.isFinite(ha) ? ha : 0 })
                                  }}
                                />
                              </td>

                              {/* Jornales */}
                              <td className="border p-2">
                                <input
                                  className="border p-1 rounded w-[110px]"
                                  type="number"
                                  step="0.01"
                                  value={f.jornales_prog}
                                  onChange={(e) => {
                                    const jr = Number(e.target.value)
                                    updateFila(fecha, f.ui_id, { jornales_prog: Number.isFinite(jr) ? jr : 0 })
                                  }}
                                />
                              </td>

                              {/* Obs */}
                              <td className="border p-2">
                                <input
                                  className="border p-1 rounded w-[240px]"
                                  value={f.obs}
                                  onChange={(e) => updateFila(fecha, f.ui_id, { obs: e.target.value })}
                                />
                              </td>

                              {/* ✅ Mover / Copiar */}
                              <td className="border p-2">
                                <div className="flex gap-2 items-center">
                                  <select
                                    className="border p-1 rounded"
                                    value={destino}
                                    onChange={(e) => setDestinoPorFila((p) => ({ ...p, [f.ui_id]: e.target.value }))}
                                  >
                                    <option value="">Destino...</option>
                                    {Object.keys(filas)
                                      .sort()
                                      .map((d) => (
                                        <option key={d} value={d}>
                                          {d}
                                        </option>
                                      ))}
                                  </select>

                                  <button
                                    className="text-xs underline"
                                    onClick={() => copiarAFEcha(fecha, f, destino)}
                                    disabled={!destino || destino === fecha}
                                  >
                                    Copiar
                                  </button>

                                  <button
                                    className="text-xs underline"
                                    onClick={() => moverAFEcha(fecha, f, destino)}
                                    disabled={!destino || destino === fecha}
                                  >
                                    Mover
                                  </button>
                                </div>
                              </td>

                              {/* Acciones */}
                              <td className="border p-2 whitespace-nowrap">
                                <button className="text-xs underline mr-3" onClick={() => duplicarFila(fecha, f)}>
                                  Duplicar
                                </button>

                                <button className="text-xs underline mr-3" onClick={() => replicarFilaARango(fecha, f)}>
                                  Replicar a rango
                                </button>

                                <button className="text-xs underline text-red-600" onClick={() => quitarFila(fecha, f.ui_id)}>
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
      )}

      <button className="border rounded px-6 py-2" onClick={guardar} disabled={!planId}>
        Guardar plan
      </button>
    </div>
  )
}
