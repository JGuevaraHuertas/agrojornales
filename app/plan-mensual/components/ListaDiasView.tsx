'use client'

import type { FilaUI, Labor, Lote, Red, Sector } from '../utils/planUtils'
import DiaCard from './DiaCard'

type Props = {
  dias: string[]
  filas: Record<string, FilaUI[]>

  agregarFila: (fecha: string) => void
  updateFila: (fecha: string, ui_id: string, patch: Partial<FilaUI>) => void
  duplicarFila: (fecha: string, ui_id: string) => void
  quitarFila: (fecha: string, ui_id: string) => void

  labores: Labor[]
  laboresByCodigo: Map<number, Labor>
  subgruposDisponibles: string[]

  lotes: Lote[]
  redesPorLote: Map<string, Red[]>
  sectoresPorLoteRed: Map<string, Sector[]>
  sectorHA: Map<string, number>

  selectCls: string
  inputCls: string
  tableTh: string
  tableTd: string
  btnGhost: string
}

export default function ListaDiasView({
  dias,
  filas,
  agregarFila,
  updateFila,
  duplicarFila,
  quitarFila,
  labores,
  laboresByCodigo,
  subgruposDisponibles,
  lotes,
  redesPorLote,
  sectoresPorLoteRed,
  sectorHA,
  selectCls,
  inputCls,
  tableTh,
  tableTd,
  btnGhost,
}: Props) {
  return (
    <div className="space-y-6">
      {dias.map((fecha) => (
        <DiaCard
          key={fecha}
          fecha={fecha}
          rows={filas[fecha] ?? []}
          agregarFila={agregarFila}
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
          updateFila={updateFila}
          duplicarFila={duplicarFila}
          quitarFila={quitarFila}
        />
      ))}
    </div>
  )
}
