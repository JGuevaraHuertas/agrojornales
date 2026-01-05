'use client'

type Props = {
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

  selectCls: string
}

export default function AccionesDiaBar({
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
  selectCls,
}: Props) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
      <div className="text-sm font-semibold text-gray-700">Acciones por día:</div>

      <select className={`${selectCls} py-1`} value={fechaOrigen} onChange={(e) => setFechaOrigen(e.target.value)}>
        <option value="">Origen...</option>
        {dias.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select className={`${selectCls} py-1`} value={fechaDestino} onChange={(e) => setFechaDestino(e.target.value)}>
        <option value="">Destino...</option>
        {dias.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <button
        className="text-xs font-semibold text-green-800 underline disabled:opacity-50"
        onClick={() => copiarAFEcha(fechaOrigen, fechaDestino)}
        disabled={!fechaOrigen || !fechaDestino || fechaOrigen === fechaDestino}
      >
        Copiar
      </button>

      <button
        className="text-xs font-semibold text-green-800 underline disabled:opacity-50"
        onClick={() => moverAFEcha(fechaOrigen, fechaDestino)}
        disabled={!fechaOrigen || !fechaDestino || fechaOrigen === fechaDestino}
      >
        Mover
      </button>

      <div className="mx-2 text-gray-300">|</div>

      <div className="text-sm font-semibold text-gray-700">Copiar a rango:</div>

      <select className={`${selectCls} py-1`} value={rangoInicio} onChange={(e) => setRangoInicio(e.target.value)}>
        <option value="">Inicio...</option>
        {dias.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <select className={`${selectCls} py-1`} value={rangoFin} onChange={(e) => setRangoFin(e.target.value)}>
        <option value="">Fin...</option>
        {dias.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <button
        className="text-xs font-semibold text-green-800 underline disabled:opacity-50"
        onClick={() => copiarARango(fechaOrigen, rangoInicio, rangoFin)}
        disabled={!fechaOrigen || !rangoInicio || !rangoFin}
      >
        Copiar a rango
      </button>

      <button
        className="text-xs font-semibold text-green-800 underline disabled:opacity-50"
        onClick={() => moverARango(fechaOrigen, rangoInicio, rangoFin)}
        disabled={!fechaOrigen || !rangoInicio || !rangoFin}
      >
        Mover a rango
      </button>
    </div>
  )
}
