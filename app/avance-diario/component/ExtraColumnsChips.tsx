'use client'

import { useMemo, useState } from 'react'
import { isCustomExtraKey, type ExtraColMeta, type ExtraKey } from './Extras'

type Props = {
  extrasVisible: ReadonlyArray<ExtraKey>
  onRemove: (k: ExtraKey) => void
  extraColsMeta: ReadonlyArray<ExtraColMeta>

  // ✅ para columnas personalizadas
  onRenameCustom?: (k: `custom_${string}`, label: string) => void
  onDeleteCustom?: (k: `custom_${string}`) => void
}

function labelFor(key: ExtraKey, meta: ReadonlyArray<ExtraColMeta>) {
  return meta.find((m) => m.key === key)?.label ?? String(key)
}

export default function ExtraColumnsChips({
  extrasVisible,
  onRemove,
  extraColsMeta,
  onRenameCustom,
  onDeleteCustom,
}: Props) {
  const [editingKey, setEditingKey] = useState<`custom_${string}` | null>(null)
  const [draft, setDraft] = useState('')

  const ordered = useMemo(() => [...extrasVisible], [extrasVisible])
  if (!ordered.length) return null

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {ordered.map((k) => {
        const isCustom = isCustomExtraKey(k)
        const label = labelFor(k, extraColsMeta)
        const isEditing = isCustom && editingKey === k

        return (
          <div
            key={String(k)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700"
          >
            {!isEditing ? (
              <span className="max-w-[240px] truncate">{label}</span>
            ) : (
              <input
                className="border border-gray-300 rounded px-2 py-0.5 text-xs w-[220px]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
              />
            )}

            {isCustom && !isEditing && (
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800"
                title="Editar nombre"
                onClick={() => {
                  setEditingKey(k)
                  setDraft(label)
                }}
              >
                ✎
              </button>
            )}

            {isCustom && isEditing && (
              <>
                <button
                  type="button"
                  className="text-gray-600 hover:text-gray-900"
                  title="Guardar"
                  onClick={() => {
                    const v = draft.trim()
                    if (!v) return
                    onRenameCustom?.(k, v)
                    setEditingKey(null)
                    setDraft('')
                  }}
                >
                  ✔
                </button>

                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-800"
                  title="Cancelar"
                  onClick={() => {
                    setEditingKey(null)
                    setDraft('')
                  }}
                >
                  ✕
                </button>
              </>
            )}

            {isCustom && !isEditing ? (
              <button
                type="button"
                className="text-red-600 hover:text-red-800"
                title="Eliminar columna personalizada"
                onClick={() => {
                  onRemove(k) // quitar de visibles
                  onDeleteCustom?.(k) // borrar del catálogo
                }}
              >
                🗑
              </button>
            ) : !isCustom ? (
              <button
                type="button"
                className="text-gray-500 hover:text-gray-800"
                title="Quitar columna"
                onClick={() => onRemove(k)}
              >
                ✕
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}