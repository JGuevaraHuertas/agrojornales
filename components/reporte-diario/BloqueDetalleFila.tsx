'use client'

import { type ChangeEvent } from 'react'
import { type Sector } from './BloqueEncargado'

export type ReporteBloqueDetalle = {
  labor_texto: string
  sectores?: string | null
  comedor?: string | null
  jor_prog: number
  jor_real: number
}

type Props = {
  detalle: ReporteBloqueDetalle
  onChange: (next: ReporteBloqueDetalle) => void
  onRemove?: () => void

  // Contexto para filtrar sectores por Lote/Red
  loteId: string
  redId: string
  sectoresPorLoteRed: Map<string, Sector[]>
}

export default function BloqueDetalleFila({ detalle, onChange, onRemove, loteId, redId, sectoresPorLoteRed }: Props) {
  const onText =
    (key: 'labor_texto' | 'comedor') =>
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...detalle,
        [key]: e.target.value,
      })
    }

  const onSelect =
    (key: 'sectores') =>
    (e: ChangeEvent<HTMLSelectElement>) => {
      onChange({
        ...detalle,
        [key]: e.target.value,
      })
    }

  const sectoresKey = `${String(loteId ?? '')}__${String(redId ?? '')}`
  const sectoresList = sectoresPorLoteRed.get(sectoresKey) ?? []

  const onNumber =
    (key: 'jor_prog' | 'jor_real') => (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      // UX friendly: vacío -> 0
      const n = v === '' ? 0 : Number(v)
      onChange({
        ...detalle,
        [key]: Number.isFinite(n) ? n : 0,
      })
    }

  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <input
        className="col-span-4 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        placeholder="Labor"
        value={detalle.labor_texto}
        onChange={onText('labor_texto')}
      />

      <select
        className="col-span-3 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        value={detalle.sectores ?? ''}
        onChange={onSelect('sectores')}
        disabled={!loteId || sectoresList.length === 0}
      >
        <option value="">
          {!loteId ? 'Selecciona lote' : sectoresList.length === 0 ? 'Sin sectores' : 'Selecciona...'}
        </option>
        {sectoresList.map((s) => (
          <option key={String(s.sector_id)} value={String(s.sector_id)}>
            {String(s.sector_id)}
          </option>
        ))}
      </select>

      <input
        className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        placeholder="Comedor"
        value={detalle.comedor ?? ''}
        onChange={onText('comedor')}
      />

      <input
        className="col-span-1 rounded-md border border-gray-300 px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-600"
        type="number"
        inputMode="numeric"
        placeholder="0"
        value={Number.isFinite(detalle.jor_prog) ? detalle.jor_prog : 0}
        onChange={onNumber('jor_prog')}
      />

      <input
        className="col-span-1 rounded-md border border-gray-300 px-2 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-600"
        type="number"
        inputMode="numeric"
        placeholder="0"
        value={Number.isFinite(detalle.jor_real) ? detalle.jor_real : 0}
        onChange={onNumber('jor_real')}
      />

      <div className="col-span-1 flex justify-end">
        <button
          type="button"
          onClick={() => onRemove?.()}
          disabled={!onRemove}
          className="rounded-md border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Eliminar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}