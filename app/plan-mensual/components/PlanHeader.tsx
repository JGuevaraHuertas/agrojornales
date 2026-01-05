'use client'

import { useRouter } from 'next/navigation'
import AccionesDiaBar from './AccionesDiaBar'
import type { Depto, Vista } from '../utils/planUtils'
import { labelDepto, pad2 } from '../utils/planUtils'

type Props = {
  vista: Vista
  setVista: (v: Vista) => void

  totalHA: number
  totalJornales: number

  errorMsg: string

  anio: number
  setAnio: (n: number) => void
  mes: number
  setMes: (n: number) => void

  deptos: Depto[]
  deptoSel: Depto | null
  setDeptoSel: (d: Depto | null) => void

  planId: string | null
  guardando: boolean
  loadingPlan: boolean

  guardar: () => Promise<void> | void

  creandoVersion: boolean
  crearVersion: () => Promise<void> | void
  irAVersiones: () => void

  exportarCSV: () => void
  exportarPDF: () => void

  dias: string[]
  fechaOrigen: string
  setFechaOrigen: (v: string) => void
  fechaDestino: string
  setFechaDestino: (v: string) => void
  rangoInicio: string
  setRangoInicio: (v: string) => void
  rangoFin: string
  setRangoFin: (v: string) => void
  copiarAFEcha: (origen: string, destino: string) => void
  moverAFEcha: (origen: string, destino: string) => void
  copiarARango: (origen: string, inicio: string, fin: string) => void
  moverARango: (origen: string, inicio: string, fin: string) => void

  card: string
  panelBg: string
  btn: string
  btnGhost: string
  selectCls: string
  inputCls: string
}

export default function PlanHeader(props: Props) {
  const router = useRouter()

  const {
    vista,
    setVista,
    totalHA,
    totalJornales,
    errorMsg,
    anio,
    setAnio,
    mes,
    setMes,
    deptos,
    deptoSel,
    setDeptoSel,
    planId,
    guardando,
    loadingPlan,
    guardar,
    creandoVersion,
    crearVersion,
    irAVersiones,
    exportarCSV,
    exportarPDF,
    dias,
    fechaOrigen,
    setFechaOrigen,
    fechaDestino,
    setFechaDestino,
    rangoInicio,
    setRangoInicio,
    rangoFin,
    setRangoFin,
    copiarAFEcha,
    moverAFEcha,
    copiarARango,
    moverARango,
    card,
    panelBg,
    btn,
    btnGhost,
    selectCls,
    inputCls,
  } = props

  return (
    <div className={`${card} ${panelBg} p-4 sticky top-0 z-50 backdrop-blur`} style={{ backgroundColor: 'rgba(255,255,255,0.98)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-bold text-gray-800">PLANIFICACION MENSUAL DE JORNALES GAG</div>

          <div className="mt-2 flex items-center gap-2">
            <button className={`${btnGhost} ${vista === 'LISTA' ? 'border-green-600 text-green-800' : ''}`} onClick={() => setVista('LISTA')}>
              Vista lista
            </button>
            <button
              className={`${btnGhost} ${vista === 'CALENDARIO' ? 'border-green-600 text-green-800' : ''}`}
              onClick={() => setVista('CALENDARIO')}
            >
              Vista calendario
            </button>
          </div>
        </div>

        <div className="text-right text-xs text-gray-500">
          <div className="mt-1">
            <span className="text-gray-500">Total HA:</span> <b className="text-gray-800">{totalHA.toFixed(2)}</b>{' '}
            <span className="text-gray-500 ml-3">Total Jornales:</span> <b className="text-gray-800">{totalJornales.toFixed(2)}</b>
          </div>
        </div>
      </div>

      {errorMsg ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{errorMsg}</div> : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Año</label>
          <input type="number" className={`${inputCls} w-28`} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
        </div>

        <div className="flex flex-col">
          <label className="text-xs text-gray-600">Mes</label>
          <select className={`${selectCls} w-36`} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
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

        {/* ✅ BOTÓN: CREAR VERSIÓN */}
        <button
          className={btnGhost}
          onClick={crearVersion}
          disabled={!deptoSel?.id || !planId || creandoVersion || guardando || loadingPlan}
          title="Genera una versión (snapshot) del plan"
        >
          {creandoVersion ? 'Creando versión…' : 'Crear versión'}
        </button>

        {/* ✅ BOTÓN: IR A VERSIONES */}
        <button className={btnGhost} onClick={irAVersiones} disabled={!deptoSel?.id || !planId} title="Ver versiones creadas">
          Versiones
        </button>

        {/* <button className={btnGhost} onClick={() => router.push('/')}>
        Volver
        </button> */}


        <div className="ml-auto flex items-center gap-2">
          <button className={btnGhost} onClick={exportarCSV} disabled={!deptoSel}>
            Exportar Excel (CSV)
          </button>
          <button className={btnGhost} onClick={exportarPDF}>
            Exportar PDF (Imprimir)
          </button>
        </div>
      </div>

      <AccionesDiaBar
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
        selectCls={selectCls}
      />
    </div>
  )
}
