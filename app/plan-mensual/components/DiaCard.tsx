'use client'

import type { FilaUI, Labor, Lote, Red, Sector } from '../utils/planUtils'
import { toNumber } from '../utils/planUtils'
import FilaRow from './FilaRow'

type Props = {
  fecha: string
  rows: FilaUI[]
  agregarFila: (fecha: string) => void

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

  updateFila: (fecha: string, ui_id: string, patch: Partial<FilaUI>) => void
  duplicarFila: (fecha: string, ui_id: string) => void
  quitarFila: (fecha: string, ui_id: string) => void
}

export default function DiaCard({
  fecha,
  rows,
  agregarFila,
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
  updateFila,
  duplicarFila,
  quitarFila,
}: Props) {
  const totalDiaHA = rows.reduce((a, r) => a + toNumber(r.ha_prog), 0)
  const totalDiaJ = rows.reduce((a, r) => a + toNumber(r.jornales_prog), 0)

  return (
    <div id={`dia-${fecha}`} className="rounded-xl border border-gray-200 shadow-sm bg-white">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="font-bold text-gray-800">{fecha}</div>
          <div className="text-sm text-gray-600">
            HA: <b className="text-gray-900">{totalDiaHA.toFixed(2)}</b> · Jornales: <b className="text-gray-900">{totalDiaJ.toFixed(2)}</b>
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
              <th className={`${tableTh} min-w-[190px]`}>Subgrupo</th>
              <th className={`${tableTh} min-w-[420px]`}>Labor</th>
              <th className={`${tableTh} min-w-[340px]`}>Ubicación</th>
              <th className={`${tableTh} w-28 min-w-[112px]`}>HA</th>
              <th className={`${tableTh} w-28 min-w-[112px]`}>Ratio</th>
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

            {rows.map((r) => (
              <FilaRow
                key={r.ui_id}
                fecha={fecha}
                r={r}
                labores={labores}
                laboresByCodigo={laboresByCodigo}
                subgruposDisponibles={subgruposDisponibles}
                lotes={lotes}
                redesPorLote={redesPorLote}
                sectoresPorLoteRed={sectoresPorLoteRed}
                sectorHA={sectorHA}
                selectCls={selectCls}
                inputCls={inputCls}
                tableTd={tableTd}
                updateFila={updateFila}
                duplicarFila={duplicarFila}
                quitarFila={quitarFila}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
