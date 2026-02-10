'use client'

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
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

  const [customOptions, setCustomOptions] = useState<Option[]>([])

  const slugify = (s: string) =>
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/[\s_-]+/g, '_')
      .replace(/^_+|_+$/g, '')

  const allOptions = useMemo<Option[]>(() => {
    // Evita duplicados por key
    const map = new Map<string, Option>()
    for (const o of extrasOptions) map.set(String(o.key), o)
    for (const o of customOptions) map.set(String(o.key), o)
    return Array.from(map.values())
  }, [extrasOptions, customOptions])

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
    <div className="mt-3 space-y-2 relative">
      {/* ===== Columnas extra (lista) ===== */}
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        {/* Selector */}
        <div className="w-full md:max-w-[260px]">
          <div className="text-xs font-semibold text-gray-700">Columnas extra</div>
          <select
            className={inputCls + ' w-full'}
            value={extraToAdd}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as ExtraKey | '')}
          >
            <option value="">— Seleccionar —</option>
            {allOptions.map((o) => (
              <option key={String(o.key)} value={String(o.key)}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Botones (misma altura) */}
        <div className="flex items-center gap-2">
          <button className={btnGhost} type="button" onClick={onAdd} disabled={!extraToAdd}>
            Agregar
          </button>

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            onClick={() => setShowCustom((v) => !v)}
            title={showCustom ? 'Ocultar columna' : 'Agregar columna'}
            aria-label="Columna"
          >
            {showCustom ? '−' : '+'}
          </button>
        </div>
      </div>

      {/* ===== Panel desplegable (overlay) ===== */}
      {showCustom && (
        <div className="absolute z-20 right-0 top-full mt-2 w-full md:w-[560px] rounded-xl border border-gray-200 bg-white shadow-lg p-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
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
                className={btnGhost + ' px-2 py-1 text-xs h-8'}
                onClick={() => {
                  const label = String(customLocal ?? '').trim()
                  if (!label) return

                  const slug = slugify(label)
                  const key = (`custom_${slug || Date.now()}`) as ExtraKey

                  // 1) agrega a lista local (para que aparezca en el select)
                  setCustomOptions((prev) => {
                    if (prev.some((p) => String(p.key) === String(key))) return prev
                    return [...prev, { key, label }]
                  })

                  // 2) notifica al padre si existe (por si quiere persistir)
                  onAddCustom?.(label)

                  // 3) selecciona la nueva columna y la agrega automáticamente
                  onChange(key)
                  setShowCustom(false)

                  // Espera un tick para que el padre procese `onChange` antes de `onAdd`
                  setTimeout(() => {
                    onAdd()
                  }, 0)

                  // 4) limpia input
                  setCustomLocal('')
                  setCustomLabel?.('')
                }}
                disabled={!String(customLocal ?? '').trim()}
                title="Agregar columna"
              >
                Agregar columna
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}