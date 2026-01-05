'use client'

import { Fragment } from 'react'
import type { FilaUI, Labor, Lote, Red, Sector } from '../utils/planUtils'
import { formatRedId, formatSectorLabel, toNumber } from '../utils/planUtils'

type Props = {
  fecha: string
  r: FilaUI

  labores: Labor[]
  laboresByCodigo: Map<number, Labor>
  subgruposDisponibles: string[]

  lotes: Lote[]
  redesPorLote: Map<string, Red[]>
  sectoresPorLoteRed: Map<string, Sector[]>
  sectorHA: Map<string, number>

  selectCls: string
  inputCls: string
  tableTd: string

  updateFila: (fecha: string, ui_id: string, patch: Partial<FilaUI>) => void
  duplicarFila: (fecha: string, ui_id: string) => void
  quitarFila: (fecha: string, ui_id: string) => void
}

export default function FilaRow({
  fecha,
  r,
  labores,
  laboresByCodigo,
  subgruposDisponibles,
  lotes,
  redesPorLote,
  sectoresPorLoteRed,
  sectorHA,
  selectCls,
  inputCls,
  tableTd,
  updateFila,
  duplicarFila,
  quitarFila,
}: Props) {
  const redesLote = redesPorLote.get(r.lote_id) ?? []
  const redKey = `${r.lote_id}__${r.red_id}`
  const sectoresLR = sectoresPorLoteRed.get(redKey) ?? []

  return (
    <Fragment>
      <tr className="hover:bg-green-50/30">
        <td className={`${tableTd} text-center`}>{r.linea}</td>

        {/* Subgrupo */}
        <td className={tableTd}>
          <select
            className={`${selectCls} w-full`}
            value={r.subgrupo_labor}
            onChange={(e) => {
              const sg = e.target.value
              updateFila(fecha, r.ui_id, { subgrupo_labor: sg, codigo_labor: null })
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

        {/* Labor */}
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
                jornales_prog: r.modo_jornales === 'AUTO' ? String(Number((haNum * ratioDefNum).toFixed(2))) : r.jornales_prog,
              })
            }}
          >
            <option value="">Selecciona labor...</option>
            {labores
              .filter((l) => !r.subgrupo_labor || String(l.subgrupo ?? '').trim() === r.subgrupo_labor)
              .map((l) => (
                <option key={l.codigo} value={l.codigo}>
                  {l.codigo} - {l.nombre}
                </option>
              ))}
          </select>
        </td>

        {/* Ubicación */}
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
              onChange={(e) => updateFila(fecha, r.ui_id, { red_id: e.target.value, sector_id: '' })}
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
              onChange={(e) => {
                const sector_id = e.target.value
                const key = `${r.lote_id}__${r.red_id}__${sector_id}`
                const haSector = sectorHA.get(key) ?? 0

                updateFila(fecha, r.ui_id, {
                  sector_id,
                  ha_prog: sector_id ? String(haSector || 0) : r.ha_prog,
                  jornales_prog:
                    r.modo_jornales === 'AUTO'
                      ? String(Number(((sector_id ? haSector : toNumber(r.ha_prog)) * toNumber(r.ratio)).toFixed(2)))
                      : r.jornales_prog,
                })
              }}
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

        {/* HA */}
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

        {/* Ratio */}
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

        {/* Jornales */}
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

        {/* Modo */}
        <td className={tableTd}>
          <select
            className={`${selectCls} w-full text-xs`}
            value={r.modo_jornales}
            onChange={(e) => {
              const modo = e.target.value as 'AUTO' | 'MANUAL'
              const ha = toNumber(r.ha_prog)
              const ratioNum = toNumber(r.ratio)
              updateFila(fecha, r.ui_id, {
                modo_jornales: modo,
                jornales_prog: modo === 'AUTO' ? String(Number((ha * ratioNum).toFixed(2))) : r.jornales_prog,
              })
            }}
          >
            <option value="MANUAL">Manual</option>
            <option value="AUTO">Auto</option>
          </select>
        </td>

        {/* Acciones */}
        <td className={tableTd}>
          <div className="flex items-center gap-3 whitespace-nowrap">
            <button className="text-xs font-semibold text-green-800 underline" onClick={() => duplicarFila(fecha, r.ui_id)}>
              Duplicar
            </button>

            <button className="text-xs font-semibold text-gray-700 underline" onClick={() => updateFila(fecha, r.ui_id, { obs_open: !r.obs_open })}>
              {r.obs_open ? 'Ocultar Obs' : 'Obs'}
            </button>

            <button className="text-xs font-semibold text-red-600 underline" onClick={() => quitarFila(fecha, r.ui_id)}>
              Quitar
            </button>
          </div>
        </td>
      </tr>

      {r.obs_open ? (
        <tr>
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
    </Fragment>
  )
}
