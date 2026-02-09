import type React from 'react'

export type BuiltinExtraKey =
  | 'yaramilaKg'
  | 'templeFertKg'
  | 'templeKg'
  | 'calmaxKg'
  | 'adherenteLit'
  | 'herbicidaLit'
  | 'herbosatoLit'
  | 'grapasUni'
  | 'papelUni'
  | 'variedad'
  | 'puntos'

export type CustomExtraKey = `custom_${string}`

export type ExtraKey = BuiltinExtraKey | CustomExtraKey

export function isCustomExtraKey(k: ExtraKey): k is CustomExtraKey {
  return String(k).startsWith('custom_')
}

export type ExtraColMeta = {
  key: ExtraKey
  label: string
  width: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  isCustom?: boolean
}

// Solo columnas “built-in”
export const EXTRA_COLS: ReadonlyArray<ExtraColMeta> = [
  { key: 'yaramilaKg', label: 'Yaramila (KG)', width: 'w-[140px]', inputMode: 'decimal' },
  { key: 'templeFertKg', label: 'Temple Fert (KG)', width: 'w-[150px]', inputMode: 'decimal' },
  { key: 'templeKg', label: 'Temple (KG)', width: 'w-[140px]', inputMode: 'decimal' },
  { key: 'calmaxKg', label: 'Calmax (KG)', width: 'w-[140px]', inputMode: 'decimal' },
  { key: 'adherenteLit', label: 'Adherente (L)', width: 'w-[150px]', inputMode: 'decimal' },
  { key: 'herbicidaLit', label: 'Herbicida (L)', width: 'w-[150px]', inputMode: 'decimal' },
  { key: 'herbosatoLit', label: 'Herbosato (L)', width: 'w-[150px]', inputMode: 'decimal' },
  { key: 'grapasUni', label: 'Grapas (UND)', width: 'w-[150px]', inputMode: 'decimal' },
  { key: 'papelUni', label: 'Papel (UND)', width: 'w-[150px]', inputMode: 'decimal' },
  { key: 'variedad', label: 'Variedad', width: 'w-[160px]', inputMode: 'text' },
  { key: 'puntos', label: 'Puntos', width: 'w-[120px]', inputMode: 'decimal' },
] as const