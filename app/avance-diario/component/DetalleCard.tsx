'use client'

import { Fragment, useMemo } from 'react'
import ExtraColumnsPicker from './ExtraColumnsPicker'
import ExtraColumnsChips from './ExtraColumnsChips'
import { EXTRA_COLS, type ExtraColMeta, type ExtraKey } from './Extras' // ✅ misma carpeta

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

function getTableMinWidthClass(extraCount: number) {
  const px = 1200 + extraCount * 120
  return `min-w-[${px}px]`
}

type DetalleUI = {
  id: string
  selSubgrupo: string
  selLaborCodigo: string
  extrasVisible: ExtraKey[]
  extraToAdd: ExtraKey | ''
}

// ✅ Igual al AvanceRow de page.tsx (sin Record<>)
type AvanceRow = {
  dbId?: string | null
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

type Props = {
  det: DetalleUI
  detIdx: number
  rowsDet: AvanceRow[]

  cardClassName: string
  labelClassName: string
  inputClassName: string
  btnGhostClassName: string

  deptoId: string
  subgruposOptions: string[]
  laboresFiltradasPorDepto: { codigo: number | string; nombre: string; subgrupo?: string | null }[]

  lotesFiltradosPorFundo: { lote_id: string }[]
  redes: { lote_id: string; red_id: string }[]
  sectores: { lote_id: string; red_id: string; sector_id: string }[]

  encargadoByCodigo: Map<string, { nombre?: string | null }>

  obsOpenIds: Set<string>
  onToggleObs: (rowId: string) => void

  onUpdateRow: (rowId: string, patch: Partial<AvanceRow>) => void
  onOpenEncModal: (rowId: string) => void

  onAddRow: () => void
  onRemoveDetalle: () => void

  onSubgrupoChange: (v: string) => void
  onLaborChange: (v: string) => void

  onExtraToAddChange: (v: ExtraKey | '') => void
  onAddExtraCol: () => void
  onRemoveExtraCol: (k: ExtraKey) => void

  onRemoveRow: (rowId: string) => void

  // ===== Columnas personalizadas (opcional) =====
  customColsMeta?: ReadonlyArray<ExtraColMeta>
  customLabel?: string
  onCustomLabelChange?: (v: string) => void
  onAddCustomCol?: (label: string) => void
  onRenameCustomCol?: (k: `custom_${string}`, label: string) => void
  onDeleteCustomCol?: (k: `custom_${string}`) => void
}

export default function DetalleCard(props: Props) {
  const {
    det,
    detIdx,
    rowsDet,
    cardClassName,
    labelClassName,
    inputClassName,
    btnGhostClassName,
    deptoId,
    subgruposOptions,
    laboresFiltradasPorDepto,
    lotesFiltradosPorFundo,
    redes,
    sectores,
    encargadoByCodigo,
    obsOpenIds,
    onToggleObs,
    onUpdateRow,
    onOpenEncModal,
    onAddRow,
    onRemoveDetalle,
    onSubgrupoChange,
    onLaborChange,
    onExtraToAddChange,
    onAddExtraCol,
    onRemoveExtraCol,
    onRemoveRow,
    customColsMeta = [],
    customLabel = '',
    onCustomLabelChange,
    onAddCustomCol,
    onRenameCustomCol,
    onDeleteCustomCol,
  } = props

  const extrasVisible = det.extrasVisible

  const allMeta = useMemo<ExtraColMeta[]>(() => [...EXTRA_COLS, ...customColsMeta], [customColsMeta])

  const extrasOptions = useMemo(() => {
    const visible = new Set<ExtraKey>(extrasVisible)
    return allMeta.filter((c) => !visible.has(c.key))
  }, [extrasVisible, allMeta])

  const BASE_COLS = 9 // #, Ubicación, Encargado, HA, Jornales, Cantidad, KG, Obs, Acción
  const totalCols = BASE_COLS + extrasVisible.length
  const tableMinWidthClass = getTableMinWidthClass(extrasVisible.length)

  return (
    <div className={cardClassName + ' p-4'}>
      <div className="flex items-center justify-between">
        <div className="font-semibold text-gray-800">Detalle {detIdx + 1}</div>
        <div className="flex items-center gap-2">
          <button className={btnGhostClassName} type="button" onClick={onAddRow}>
            + Agregar fila
          </button>
          <button
            className={btnGhostClassName}
            type="button"
            onClick={onRemoveDetalle}
            title="Quitar este detalle (labor)"
          >
            Quitar detalle
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <div className={labelClassName}>Subgrupo</div>
          <select
            className={inputClassName + ' w-full'}
            value={det.selSubgrupo}
            onChange={(e) => onSubgrupoChange(e.target.value)}
            disabled={!deptoId}
          >
            <option value="">— Todos —</option>
            {subgruposOptions.map((sg) => (
              <option key={sg} value={sg}>
                {sg}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className={labelClassName}>Labor</div>
          <select
            className={inputClassName + ' w-full'}
            value={det.selLaborCodigo}
            onChange={(e) => onLaborChange(e.target.value)}
            disabled={!deptoId}
          >
            <option value="">— Seleccionar —</option>
            {(
              !det.selSubgrupo
                ? laboresFiltradasPorDepto
                : laboresFiltradasPorDepto.filter(
                    (l) => String(l.subgrupo ?? '').trim() === det.selSubgrupo
                  )
            ).map((l) => (
              <option key={String(l.codigo)} value={String(l.codigo)}>
                {l.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ExtraColumnsPicker
        inputCls={inputClassName}
        btnGhost={btnGhostClassName}
        extraToAdd={det.extraToAdd}
        extrasOptions={extrasOptions.map((x) => ({ key: x.key, label: x.label }))}
        onChange={onExtraToAddChange}
        onAdd={onAddExtraCol}
        // opcional: columna personalizada
        customLabel={customLabel}
        setCustomLabel={(v: string) => onCustomLabelChange?.(v)}
        onAddCustom={(label: string) => onAddCustomCol?.(label)}
      />

      <ExtraColumnsChips
        extrasVisible={extrasVisible}
        onRemove={onRemoveExtraCol}
        extraColsMeta={allMeta}
        onRenameCustom={onRenameCustomCol}
        onDeleteCustom={onDeleteCustomCol}
      />

      <div className="mt-3 overflow-x-auto">
        <table className={tableMinWidthClass + ' w-full border border-gray-200 rounded-lg'}>
          <thead className="bg-gray-50">
            <tr className="text-xs text-gray-700">
              <th rowSpan={2} className="border px-2 py-2 w-[40px]">#</th>
              <th rowSpan={2} className="border px-2 py-2 w-[260px]">Ubicación</th>
              <th rowSpan={2} className="border px-2 py-2 w-[380px]">Encargado</th>
              <th rowSpan={2} className="border px-2 py-2 w-[90px]">HA</th>
              <th rowSpan={2} className="border px-2 py-2 w-[100px]">Jornales</th>
              <th rowSpan={2} className="border px-2 py-2 w-[120px]">Cantidad</th>
              <th rowSpan={2} className="border px-2 py-2 w-[110px]">KG</th>

              {extrasVisible.map((k) => {
                const c = allMeta.find((x) => x.key === k)
                if (!c) return null
                return (
                  <th key={String(k)} className={`border px-2 py-2 ${c.width}`}>
                    {c.label}
                  </th>
                )
              })}

              <th rowSpan={2} className="border px-2 py-2 w-[70px] text-center">Obs</th>
              <th rowSpan={2} className="border px-2 py-2 w-[110px]">Acción</th>
            </tr>
          </thead>

          <tbody>
            {rowsDet.map((row, idx) => {
              const redesRow = row.loteId ? redes.filter((r) => r.lote_id === row.loteId) : []
              const sectoresRow = !row.loteId
                ? []
                : !row.redId
                  ? sectores.filter((s) => s.lote_id === row.loteId)
                  : sectores.filter((s) => s.lote_id === row.loteId && s.red_id === row.redId)

              return (
                <Fragment key={row._id}>
                  <tr className="text-sm">
                    <td className="border px-2 py-2 text-center">{idx + 1}</td>

                    <td className="border px-2 py-2">
                      <div className="flex gap-2 items-center">
                        <select
                          className={inputClassName + ' w-auto min-w-[70px] whitespace-nowrap'}
                          value={row.loteId}
                          onChange={(e) =>
                            onUpdateRow(row._id, { loteId: e.target.value, redId: '', sectorId: '' })
                          }
                        >
                          <option value="">Lote</option>
                          {lotesFiltradosPorFundo.map((l) => (
                            <option key={l.lote_id} value={l.lote_id}>
                              {shortLoteId(l.lote_id)}
                            </option>
                          ))}
                        </select>

                        <select
                          className={inputClassName + ' w-auto min-w-[70px] whitespace-nowrap'}
                          value={row.redId}
                          onChange={(e) => onUpdateRow(row._id, { redId: e.target.value, sectorId: '' })}
                          disabled={!row.loteId}
                        >
                          <option value="">Red</option>
                          {redesRow.map((r) => (
                            <option key={r.red_id} value={r.red_id}>
                              {r.red_id}
                            </option>
                          ))}
                        </select>

                        <select
                          className={inputClassName + ' w-auto min-w-[70px] whitespace-nowrap'}
                          value={row.sectorId}
                          onChange={(e) => onUpdateRow(row._id, { sectorId: e.target.value })}
                          disabled={!row.loteId}
                        >
                          <option value="">Sec</option>
                          {sectoresRow.map((s) => (
                            <option key={s.sector_id} value={s.sector_id}>
                              {shortSectorId(s.sector_id)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    <td className="border px-2 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          className={inputClassName + ' w-full'}
                          value={(() => {
                            const c = String(row.encargadoCodigo ?? '').trim()
                            if (!c) return ''
                            return encargadoByCodigo.get(c)?.nombre ?? c
                          })()}
                          readOnly
                          placeholder="Seleccionar encargado"
                        />

                        <button
                          type="button"
                          className="shrink-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => onOpenEncModal(row._id)}
                          title="Buscar encargado"
                        >
                          🔍
                        </button>

                        <button
                          type="button"
                          className="shrink-0 text-xs text-gray-500 hover:underline"
                          onClick={() => onUpdateRow(row._id, { encargadoCodigo: '' })}
                          title="Quitar encargado"
                        >
                          Quitar
                        </button>
                      </div>
                    </td>

                    <td className="border px-2 py-2">
                      <input
                        className={inputClassName + ' w-full'}
                        inputMode="decimal"
                        value={row.hectareas}
                        onChange={(e) => onUpdateRow(row._id, { hectareas: e.target.value })}
                        placeholder="0"
                      />
                    </td>

                    <td className="border px-2 py-2">
                      <input
                        className={inputClassName + ' w-full'}
                        inputMode="decimal"
                        value={row.jornales}
                        onChange={(e) => onUpdateRow(row._id, { jornales: e.target.value })}
                        placeholder="0"
                      />
                    </td>

                    <td className="border px-2 py-2">
                      <input
                        className={inputClassName + ' w-full'}
                        inputMode="decimal"
                        value={row.cantidadInsumo}
                        onChange={(e) => onUpdateRow(row._id, { cantidadInsumo: e.target.value })}
                        placeholder="0"
                      />
                    </td>

                    <td className="border px-2 py-2">
                      <input
                        className={inputClassName + ' w-full'}
                        inputMode="decimal"
                        value={row.kg}
                        onChange={(e) => onUpdateRow(row._id, { kg: e.target.value })}
                        placeholder="0"
                      />
                    </td>

                    {extrasVisible.map((k) => {
                      const c = allMeta.find((x) => x.key === k)
                      if (!c) return null

                      const raw = (row as Record<string, unknown>)[k]
                      const val = typeof raw === 'string' ? raw : raw == null ? '' : String(raw)

                      return (
                        <td key={String(k)} className="border px-2 py-2">
                          <input
                            className={inputClassName + ' w-full'}
                            inputMode={c.inputMode}
                            value={val}
                            onChange={(e) => {
                              const patch: Partial<AvanceRow> = {}
                              // asignación dinámica sin `any`
                              ;(patch as Partial<AvanceRow> & Record<string, string>)[String(k)] = e.target.value
                              onUpdateRow(row._id, patch)
                            }}
                          />
                        </td>
                      )
                    })}

                    <td className="border px-2 py-2 text-center">
                      <button
                        type="button"
                        className={
                          'inline-flex items-center justify-center rounded-lg border px-2 py-1 text-sm ' +
                          (obsOpenIds.has(row._id)
                            ? 'border-gray-400 bg-gray-50 text-gray-700 hover:bg-gray-100'
                            : row.obs?.trim()
                              ? 'border-green-600 bg-green-50 text-green-800 hover:bg-green-100'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50')
                        }
                        onClick={() => onToggleObs(row._id)}
                        title={obsOpenIds.has(row._id) ? 'Ocultar observación' : 'Agregar/Ver observación'}
                      >
                        {obsOpenIds.has(row._id) ? '−' : '+'}
                      </button>
                    </td>

                    <td className="border px-2 py-2 text-center">
                      <button
                        className="text-sm text-red-600 hover:underline"
                        type="button"
                        onClick={() => onRemoveRow(row._id)}
                      >
                        Quitar
                      </button>
                    </td>
                  </tr>

                  {obsOpenIds.has(row._id) && (
                    <tr className="text-sm">
                      <td className="border px-2 py-2 bg-gray-50" colSpan={totalCols}>
                        <div className="flex items-start gap-3">
                          <div className="min-w-[110px] text-xs font-semibold text-gray-700 pt-2">
                            Observación
                          </div>
                          <textarea
                            className={inputClassName + ' w-full min-h-[44px]'}
                            value={row.obs}
                            onChange={(e) => onUpdateRow(row._id, { obs: e.target.value })}
                            placeholder="(opcional)"
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        * Encargado es obligatorio por fila. Puedes registrar <b>Cantidad</b> o <b>KG</b> en cualquier labor (se guardará automáticamente la unidad).
        <br />
        * Columnas extra: usa “Agregar” para mostrar solo las unidades que necesites (puedes quitarlas con ✕).
      </div>
    </div>
  )
}