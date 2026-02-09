'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import type { ExtraKey } from './Extras'

type Option = { key: ExtraKey; label: string }

type Props = {
  inputCls: string
  btnGhost: string
  extraToAdd: ExtraKey | ''
  extrasOptions: Option[]
  onChange: (v: ExtraKey | '') => void
  onAdd: () => void

  // ✅ opcional: columna personalizada
  customLabel?: string
  setCustomLabel?: (v: string) => void
  onAddCustom?: (label: string) => void
}

export default function ExtraColumnsPicker({
  inputCls,
  btnGhost,
  extraToAdd,
  extrasOptions,
  onChange,
  onAdd,
  customLabel,
  setCustomLabel,
  onAddCustom,
}: Props) {
  const [showCustom, setShowCustom] = useState(false)

  // ✅ Fuente de verdad local (evita que se “congele” si el padre pasa customLabel="" sin actualizarlo)
  const [customLocal, setCustomLocal] = useState<string>(typeof customLabel === 'string' ? customLabel : '')

  // Si el padre cambia el valor (por ejemplo al cargar desde localStorage/BD), sincronizamos.
  useEffect(() => {
    if (typeof customLabel === 'string' && customLabel !== customLocal) {
      setCustomLocal(customLabel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customLabel])

  return (
    <div className="mt-3 space-y-2">
      {/* ===== Columnas extra (lista) ===== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
        <div className="md:col-span-1">
          <div className="text-xs font-semibold text-gray-700">Columnas extra</div>
          <select
            className={inputCls + ' w-full'}
            value={extraToAdd}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as ExtraKey | '')}
          >
            <option value="">— Seleccionar —</option>
            {extrasOptions.map((o) => (
              <option key={String(o.key)} value={String(o.key)}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-1">
          <div className="flex items-center gap-2">
            <button className={btnGhost} type="button" onClick={onAdd} disabled={!extraToAdd}>
              Agregar
            </button>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              onClick={() => setShowCustom((v) => !v)}
              title={showCustom ? 'Ocultar columna personalizada' : 'Agregar columna personalizada'}
              aria-label="Columna personalizada"
            >
              {showCustom ? '−' : '+'}
            </button>
          </div>
        </div>

        <div className="md:col-span-1 text-xs text-gray-500">
          Agrega solo las columnas que necesites para este detalle.
        </div>
      </div>

      {/* ===== Panel desplegable ===== */}
      {showCustom && (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
          <div className="md:col-span-1">
            <div className="text-xs font-semibold text-gray-700">Nombre</div>
            <input
              className={inputCls + ' w-full'}
              value={customLocal}
              onChange={(e) => {
                const v = e.target.value
                setCustomLocal(v)
                setCustomLabel?.(v)
              }}
              placeholder="Ej: Urea (KG)"
            />
          </div>

          <div className="md:col-span-1">
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                const v = String(customLocal ?? '').trim()
                if (!v) return
                onAddCustom?.(v)
                setCustomLocal('')
                setCustomLabel?.('')
              }}
              disabled={!String(customLocal ?? '').trim()}
              title="Agregar columna personalizada"
            >
              Agregar columna personalizada
            </button>
          </div>

          <div className="md:col-span-1 text-xs text-gray-500">Puedes renombrarla o eliminarla luego.</div>
        </div>
      )}
    </div>
  )
}