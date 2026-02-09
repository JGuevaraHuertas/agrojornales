'use client'

import { useMemo } from 'react'

export type ExtraKey =
  | 'yaramilaKg'
  | 'templeFertKg'
  | 'templeKg'
  | 'calmaxKg'
  | 'adherenteLit'
  | 'herbicidaLit'
  | 'variedad'
  | 'herbosatoLit'
  | 'grapasUni'
  | 'papelUni'
  | 'puntos'

export type ExtraCol = { key: ExtraKey; label: string; width: string; inputMode?: 'decimal' }

export type AvanceRow = {
  _id: string
  dbId?: string | null
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

type LoteOption = { lote_id: string }
type RedOption = { lote_id: string; red_id: string }
type SectorOption = { lote_id: string; red_id: string; sector_id: string; ha?: number | null; variedad?: string | null }
type EncargadoMini = { nombre?: string | null }

type Props = {
  rows: AvanceRow[]

  // data
  lotes: LoteOption[]
  redes: RedOption[]
  sectores: SectorOption[]
  encargadoByCodigo: Map<string, EncargadoMini>

  // UI
  inputClassName: string
  btnGhostClassName: string

  // extras
  extrasVisible: ExtraKey[]
  extraColsMeta: ExtraCol[]

  // obs toggles
  obsOpenIds: Set<string>
  onToggleObs: (rowId: string) => void

  // actions
  onUpdateRow: (rowId: string, patch: Partial<AvanceRow>) => void
  onOpenEncModal: (rowId: string) => void
  onRemoveRow: (rowId: string) => void
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
  return s.split('_')[0]
}

export default function AvanceTable(props: Props) {
  const {
    rows,
    lotes,
    redes,
    sectores,
    encargadoByCodigo,
    inputClassName,
    btnGhostClassName,
    extrasVisible,
    extraColsMeta,
    obsOpenIds,
    onToggleObs,
    onUpdateRow,
    onOpenEncModal,
    onRemoveRow,
  } = props

  const extrasToRender = useMemo(
    () => extraColsMeta.filter((c) => extrasVisible.includes(c.key)),
    [extraColsMeta, extrasVisible]
  )

  const thBase = 'text-[11px] font-semibold text-gray-700 px-2 py-2 text-left border-b border-gray-200 whitespace-nowrap'
  const tdBase = 'px-2 py-2 border-b border-gray-100 align-top'

  const selectCls = inputClassName + ' w-auto min-w-[120px] whitespace-nowrap'
  const miniInputCls = inputClassName + ' w-[110px]'
  const miniInputSmall = inputClassName + ' w-[90px]'
  const obsBtnCls = btnGhostClassName + ' !py-1 !px-2 text-xs'

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className={thBase}>Encargado</th>
            <th className={thBase}>Lote</th>
            <th className={thBase}>Red</th>
            <th className={thBase}>Sector</th>
            <th className={thBase}>HA</th>
            <th className={thBase}>Jorn</th>
            <th className={thBase}>Cantidad</th>
            <th className={thBase}>KG</th>

            {extrasToRender.map((c) => (
              <th key={c.key} className={thBase + ' ' + c.width}>
                {c.label}
              </th>
            ))}

            <th className={thBase}>Obs</th>
            <th className={thBase}></th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const enc = encargadoByCodigo.get(String(row.encargadoCodigo ?? '').trim())
            const encLabel = row.encargadoCodigo
              ? `${row.encargadoCodigo} ${enc?.nombre ? `- ${enc.nombre}` : ''}`
              : ''

            const redesRow = redes.filter((r) => String(r.lote_id) === String(row.loteId))
            const sectoresRow = sectores.filter(
              (s) => String(s.lote_id) === String(row.loteId) && String(s.red_id) === String(row.redId)
            )

            const obsOpen = obsOpenIds.has(row._id)

            return (
              <tr key={row._id}>
                {/* Encargado */}
                <td className={tdBase}>
                  <div className="flex items-center gap-2">
                    <input
                      className={inputClassName + ' w-[120px]'}
                      value={row.encargadoCodigo}
                      placeholder="Código"
                      onChange={(e) => onUpdateRow(row._id, { encargadoCodigo: e.target.value })}
                    />
                    <button type="button" className={btnGhostClassName} onClick={() => onOpenEncModal(row._id)}>
                      Buscar
                    </button>
                  </div>
                  {encLabel && <div className="mt-1 text-[11px] text-gray-600">{encLabel}</div>}
                </td>

                {/* Lote */}
                <td className={tdBase}>
                  <select
                    className={selectCls}
                    value={row.loteId}
                    onChange={(e) =>
                      onUpdateRow(row._id, {
                        loteId: e.target.value,
                        redId: '',
                        sectorId: '',
                      })
                    }
                  >
                    <option value="">— Lote —</option>
                    {lotes.map((l) => (
                      <option key={l.lote_id} value={l.lote_id}>
                        {shortLoteId(l.lote_id)}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Red */}
                <td className={tdBase}>
                  <select
                    className={selectCls}
                    value={row.redId}
                    onChange={(e) => onUpdateRow(row._id, { redId: e.target.value, sectorId: '' })}
                    disabled={!row.loteId}
                  >
                    <option value="">— Red —</option>
                    {redesRow.map((r) => (
                      <option key={r.red_id} value={r.red_id}>
                        {r.red_id}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Sector */}
                <td className={tdBase}>
                  <select
                    className={selectCls}
                    value={row.sectorId}
                    onChange={(e) => onUpdateRow(row._id, { sectorId: e.target.value })}
                    disabled={!row.loteId || !row.redId}
                  >
                    <option value="">— Sector —</option>
                    {sectoresRow.map((s) => (
                      <option key={s.sector_id} value={s.sector_id}>
                        {shortSectorId(s.sector_id)}
                      </option>
                    ))}
                  </select>
                </td>

                {/* HA */}
                <td className={tdBase}>
                  <input
                    className={miniInputSmall}
                    inputMode="decimal"
                    value={row.hectareas}
                    onChange={(e) => onUpdateRow(row._id, { hectareas: e.target.value })}
                    placeholder="0"
                  />
                </td>

                {/* Jorn */}
                <td className={tdBase}>
                  <input
                    className={miniInputSmall}
                    inputMode="decimal"
                    value={row.jornales}
                    onChange={(e) => onUpdateRow(row._id, { jornales: e.target.value })}
                    placeholder="0"
                  />
                </td>

                {/* Cantidad */}
                <td className={tdBase}>
                  <input
                    className={miniInputCls}
                    inputMode="decimal"
                    value={row.cantidadInsumo}
                    onChange={(e) => onUpdateRow(row._id, { cantidadInsumo: e.target.value })}
                    placeholder="0"
                  />
                </td>

                {/* KG */}
                <td className={tdBase}>
                  <input
                    className={miniInputCls}
                    inputMode="decimal"
                    value={row.kg}
                    onChange={(e) => onUpdateRow(row._id, { kg: e.target.value })}
                    placeholder="0"
                  />
                </td>

                {/* Extras dinámicos */}
                {extrasToRender.map((c) => {
                  const val = row[c.key] ?? ''
                  const cls = inputClassName + ' ' + c.width
                  return (
                    <td key={c.key} className={tdBase}>
                      <input
                        className={cls}
                        inputMode={c.inputMode}
                        value={val}
                        onChange={(e) => onUpdateRow(row._id, { [c.key]: e.target.value } as Partial<AvanceRow>)}
                        placeholder="0"
                      />
                    </td>
                  )
                })}

                {/* Observación */}
                <td className={tdBase}>
                  <button type="button" className={obsBtnCls} onClick={() => onToggleObs(row._id)}>
                    {obsOpen ? 'Ocultar' : 'Obs'}
                  </button>

                  {obsOpen && (
                    <div className="mt-2">
                      <textarea
                        className={inputClassName + ' w-[260px] min-h-[64px]'}
                        value={row.obs}
                        onChange={(e) => onUpdateRow(row._id, { obs: e.target.value })}
                        placeholder="Observación…"
                      />
                    </div>
                  )}
                </td>

                {/* Quitar fila */}
                <td className={tdBase}>
                  <button type="button" className={btnGhostClassName} onClick={() => onRemoveRow(row._id)}>
                    Quitar
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}