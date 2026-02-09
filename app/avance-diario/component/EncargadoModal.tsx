'use client'

import type { Dispatch, SetStateAction } from 'react'

export type EncargadoItem = {
  codigo: string
  nombre?: string | null
  nombres?: string | null
  activo?: boolean | null
}

type Props = {
  open: boolean

  // classnames
  btn: string
  btnGhost: string
  inputCls: string
  label: string

  // state
  working: boolean
  search: string
  setSearch: Dispatch<SetStateAction<string>>

  // actions
  onClose: () => void
  onAddOpen: () => void

  // form add/edit
  formOpen: boolean
  formMode: 'ADD' | 'EDIT'
  formCodigo: string
  setFormCodigo: Dispatch<SetStateAction<string>>
  formNombre: string
  setFormNombre: Dispatch<SetStateAction<string>>
  onFormClose: () => void
  onFormSave: () => void

  // list
  filtrados: EncargadoItem[]
  onSeleccionar: (codigo: string | number) => void
  onEditar: (codigo: string | number, nombre: string) => void
  onQuitar: (codigo: string | number) => void
}

export default function EncargadoModal(props: Props) {
  const {
    open,
    btn,
    btnGhost,
    inputCls,
    label,
    working,
    search,
    setSearch,
    onClose,
    onAddOpen,
    formOpen,
    formMode,
    formCodigo,
    setFormCodigo,
    formNombre,
    setFormNombre,
    onFormClose,
    onFormSave,
    filtrados,
    onSeleccionar,
    onEditar,
    onQuitar,
  } = props

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Buscar encargado</h3>
          <button className={btnGhost} onClick={onClose} type="button">
            Cerrar
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <div className={label}>Buscar</div>
            <input
              className={inputCls + ' w-full'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Código o nombre…"
            />
          </div>
          <div className="flex items-end gap-2">
            <button className={btnGhost} type="button" onClick={onAddOpen} disabled={working}>
              + Agregar
            </button>
          </div>
        </div>

        {/* FORM */}
        {formOpen && (
          <div className="mt-4 rounded-lg border border-gray-200 p-3">
            <div className="text-sm font-semibold">{formMode === 'ADD' ? 'Nuevo encargado' : 'Editar encargado'}</div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className={label}>Código</div>
                <input className={inputCls + ' w-full'} value={formCodigo} onChange={(e) => setFormCodigo(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <div className={label}>Nombre</div>
                <input className={inputCls + ' w-full'} value={formNombre} onChange={(e) => setFormNombre(e.target.value)} />
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button className={btnGhost} type="button" onClick={onFormClose} disabled={working}>
                Cancelar
              </button>
              <button className={btn} type="button" onClick={onFormSave} disabled={working}>
                Guardar
              </button>
            </div>
          </div>
        )}

        {/* LISTA */}
        <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Código</th>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-right px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => {
                const displayName = String(e.nombre ?? e.nombres ?? '').trim()
                return (
                  <tr key={e.codigo} className="border-t">
                    <td className="px-3 py-2">{e.codigo}</td>
                    <td className="px-3 py-2">{displayName}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button className={btn} type="button" onClick={() => onSeleccionar(e.codigo)} disabled={working}>
                          Seleccionar
                        </button>
                        <button
                          className={btnGhost}
                          type="button"
                          onClick={() => onEditar(e.codigo, displayName)}
                          disabled={working}
                        >
                          Editar
                        </button>
                        <button className={btnGhost} type="button" onClick={() => onQuitar(e.codigo)} disabled={working}>
                          Quitar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-gray-500" colSpan={3}>
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}