'use client'

import { useMemo } from 'react'

// ---------- Types (exported for ReporteDiaForm) ----------
export type Option = { value: string; label: string }

export type Lote = {
  lote_id: string
  cultivo: string | null
  fundo: string | null
  ha_total: number | null
  activo: boolean | null
}

export type Red = {
  red_ref: string | null
  lote_id: string
  red_id: string
}

export type Labor = {
  codigo: number
  nombre: string
  subgrupo: string | null
}

export type Sector = {
  sector_id: string | null
  lote_id: string
  red_id: string | null
}

export type ReporteDetalle = {
  subgrupo: string | null
  labor_texto: string | null
  sectores: string | null
  comedor: string | null
  jor_prog: number | null
  jor_real: number | null
}

export type ReporteBloque = {
  encargado_nombre: string
  lote_id: string
  red_id: string
  detalles: ReporteDetalle[]
}

type Props = {
  bloqueIndex: number
  bloque: ReporteBloque
  onChange: (next: ReporteBloque) => void
  onRemove: () => void
  lotes: Lote[]
  redesPorLote: Map<string, Red[]>
  subgruposOptions: Option[]
  laboresOptions: Option[]
  laboresPorSubgrupo: Record<string, Option[]>
  sectoresPorLoteRed: Map<string, Sector[]>
  loadingCatalogos: boolean
}

const labelCls = 'text-xs font-medium text-gray-600'
const inputCls =
  'w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-600/20'
const selectCls = inputCls
const btnDanger =
  'inline-flex items-center justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700'
const btnSoft =
  'inline-flex items-center justify-center rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800'

const COMEDORES: Option[] = [
  { value: 'C1', label: 'C1' },
  { value: 'C2', label: 'C2' },
  { value: 'C3', label: 'C3' },
  { value: 'VIVERO', label: 'Vivero' },
]

function toNumOr0(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}

function asStr(v: unknown): string {
  return String(v ?? '').trim()
}

function keyLoteRed(loteId: string, redId: string): string {
  return `${asStr(loteId)}__${asStr(redId)}`
}

function DetalleRow({
  bloque,
  detalle,
  detalleIndex,
  onDetalleChange,
  onRemoveDetalle,
  subgruposOptions,
  laboresPorSubgrupo,
  sectoresPorLoteRed,
}: {
  bloque: ReporteBloque
  detalle: ReporteDetalle
  detalleIndex: number
  onDetalleChange: (next: ReporteDetalle) => void
  onRemoveDetalle: () => void
  subgruposOptions: Option[]
  laboresPorSubgrupo: Record<string, Option[]>
  sectoresPorLoteRed: Map<string, Sector[]>
}) {
  const loteId = asStr(bloque.lote_id)
  const redId = asStr(bloque.red_id)

  const sectoresOptions: Option[] = useMemo(() => {
    if (!loteId) return []
    const key = keyLoteRed(loteId, redId)
    const list = sectoresPorLoteRed.get(key) ?? []
    return list
      .map((s) => asStr(s.sector_id))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((s) => ({ value: s, label: s }))
  }, [loteId, redId, sectoresPorLoteRed])

  const subgrupoVal = asStr(detalle.subgrupo)
  const laborOptions = subgrupoVal ? laboresPorSubgrupo[subgrupoVal] ?? [] : []

  const idSector = `det-${detalleIndex}-sector`
  const idComedor = `det-${detalleIndex}-comedor`
  const idSubg = `det-${detalleIndex}-subg`
  const idLabor = `det-${detalleIndex}-labor`
  const idProg = `det-${detalleIndex}-prog`
  const idReal = `det-${detalleIndex}-real`

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-6">
          <label className={labelCls} htmlFor={idSubg}>
            Subgrupo
          </label>
          <select
            id={idSubg}
            className={selectCls}
            value={asStr(detalle.subgrupo)}
            onChange={(e) =>
              onDetalleChange({
                ...detalle,
                subgrupo: e.target.value || null,
                // al cambiar subgrupo, reiniciamos labor
                labor_texto: null,
              })
            }
          >
            <option value="">Selecciona...</option>
            {subgruposOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-6 flex items-end gap-2">
          <div className="flex-1">
            <label className={labelCls} htmlFor={idLabor}>
              Labor
            </label>
            <select
              id={idLabor}
              className={selectCls}
              value={asStr(detalle.labor_texto)}
              onChange={(e) =>
                onDetalleChange({
                  ...detalle,
                  labor_texto: e.target.value || null,
                })
              }
              disabled={!asStr(detalle.subgrupo)}
            >
              <option value="">{!asStr(detalle.subgrupo) ? 'Selecciona subgrupo...' : 'Selecciona...'}</option>
              {laborOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className={btnDanger} onClick={onRemoveDetalle} title="Eliminar detalle">
            ×
          </button>
        </div>

        <div className="md:col-span-4">
          <label className={labelCls} htmlFor={idSector}>
            Sectores
          </label>
          <select
            id={idSector}
            className={selectCls}
            value={asStr(detalle.sectores)}
            onChange={(e) => onDetalleChange({ ...detalle, sectores: e.target.value || null })}
            disabled={!loteId}
          >
            <option value="">{!loteId ? 'Selecciona lote...' : 'Selecciona...'}</option>
            {sectoresOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <label className={labelCls} htmlFor={idComedor}>
            Comedor
          </label>
          <select
            id={idComedor}
            className={selectCls}
            value={asStr(detalle.comedor)}
            onChange={(e) => onDetalleChange({ ...detalle, comedor: e.target.value || null })}
          >
            <option value="">Selecciona...</option>
            {COMEDORES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className={labelCls} htmlFor={idProg}>
            Jornales Prog.
          </label>
          <input
            id={idProg}
            type="number"
            min={0}
            className={inputCls}
            value={toNumOr0(detalle.jor_prog)}
            onChange={(e) => onDetalleChange({ ...detalle, jor_prog: e.target.value === '' ? 0 : Number(e.target.value) })}
          />
        </div>

        <div className="md:col-span-2">
          <label className={labelCls} htmlFor={idReal}>
            Jornales Real
          </label>
          <input
            id={idReal}
            type="number"
            min={0}
            className={inputCls}
            value={toNumOr0(detalle.jor_real)}
            onChange={(e) => onDetalleChange({ ...detalle, jor_real: e.target.value === '' ? 0 : Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  )
}

export default function BloqueEncargado({
  bloqueIndex,
  bloque,
  onChange,
  onRemove,
  lotes,
  redesPorLote,
  subgruposOptions,
  laboresPorSubgrupo,
  sectoresPorLoteRed,
  loadingCatalogos,
}: Props) {
  const redes = useMemo(() => {
    const list = redesPorLote.get(asStr(bloque.lote_id)) ?? []
    return [...list].sort((a, b) => String(a.red_id ?? '').localeCompare(String(b.red_id ?? '')))
  }, [redesPorLote, bloque.lote_id])

  function setField<K extends keyof ReporteBloque>(k: K, v: ReporteBloque[K]) {
    onChange({ ...bloque, [k]: v })
  }

  function addDetalle() {
    const next: ReporteDetalle = {
      subgrupo: null,
      labor_texto: null,
      sectores: null,
      comedor: null,
      jor_prog: 0,
      jor_real: 0,
    }
    setField('detalles', [...(bloque.detalles ?? []), next])
  }

  function updateDetalle(i: number, next: ReporteDetalle) {
    const arr = [...(bloque.detalles ?? [])]
    arr[i] = next
    setField('detalles', arr)
  }

  function removeDetalle(i: number) {
    const arr = (bloque.detalles ?? []).filter((_, idx) => idx !== i)
    setField('detalles', arr)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-gray-700">Encargado {bloqueIndex + 1}</div>
        <button type="button" className={btnDanger} onClick={onRemove} title="Eliminar encargado">
          ×
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-12">
          <label className={labelCls}>Encargado</label>
          <input
            className={inputCls}
            placeholder="Nombre encargado"
            value={asStr(bloque.encargado_nombre)}
            onChange={(e) => setField('encargado_nombre', e.target.value)}
          />
        </div>

        <div className="md:col-span-6">
          <label className={labelCls}>Lote</label>
          <select
            className={selectCls}
            value={asStr(bloque.lote_id)}
            onChange={(e) => {
              const loteId = e.target.value
              // al cambiar lote, limpiamos red y sectores
              const detalles = (bloque.detalles ?? []).map((d) => ({ ...d, sectores: null }))
              onChange({ ...bloque, lote_id: loteId, red_id: '', detalles })
            }}
            disabled={loadingCatalogos}
          >
            <option value="">Selecciona...</option>
            {lotes.map((l) => (
              <option key={l.lote_id} value={l.lote_id}>
                {l.lote_id}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-6">
          <label className={labelCls}>Red (opcional)</label>
          <select
            className={selectCls}
            value={asStr(bloque.red_id)}
            onChange={(e) => {
              const redId = e.target.value
              const detalles = (bloque.detalles ?? []).map((d) => ({ ...d, sectores: null }))
              onChange({ ...bloque, red_id: redId, detalles })
            }}
            disabled={!asStr(bloque.lote_id) || loadingCatalogos}
          >
            <option value="">(Sin red)</option>
            {redes.map((r) => (
              <option key={`${r.lote_id}-${r.red_id}`} value={r.red_id}>
                {r.red_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {(bloque.detalles ?? []).map((d, i) => (
          <DetalleRow
            key={i}
            bloque={bloque}
            detalle={d}
            detalleIndex={i}
            onDetalleChange={(nd) => updateDetalle(i, nd)}
            onRemoveDetalle={() => removeDetalle(i)}
            subgruposOptions={subgruposOptions}
            laboresPorSubgrupo={laboresPorSubgrupo}
            sectoresPorLoteRed={sectoresPorLoteRed}
          />
        ))}

        <button type="button" className={btnSoft} onClick={addDetalle}>
          + Agregar Detalle
        </button>
      </div>
    </div>
  )
}