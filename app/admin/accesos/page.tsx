'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// Nota: en accesos usamos USUARIO/JEFE; dejamos ADMIN por si la vista/tabla lo permite en el futuro
type RolDepto = 'ADMIN' | 'JEFE' | 'USUARIO'

type Depto = {
  id: string
  departamento: string
  cultivo: string | null
  fundo: string | null
}

type AccesoRow = {
  id?: number
  user_id?: string | null
  email: string
  depto_id: string
  rol: RolDepto
  jefe: boolean
  activo: boolean
}

export default function AdminAccesosPage() {
  const searchParams = useSearchParams()
  const emailParam = (searchParams.get('email') || '').trim().toLowerCase()

  const normEmail = useCallback((v: string) => (v || '').trim().toLowerCase(), [])

  // Email que el usuario escribe (no dispara carga automática)
  const [emailInput, setEmailInput] = useState<string>(() => normEmail(emailParam))
  // Email “confirmado” para cargar/guardar (sí dispara carga)
  const [emailSel, setEmailSel] = useState<string>(() => normEmail(emailParam))

  const [deptos, setDeptos] = useState<Depto[]>([])
  const [accesos, setAccesos] = useState<AccesoRow[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  // Evita warnings de React por setState disparado sincrónicamente desde useEffect
  // (usamos setTimeout para sacar el setState del mismo tick del effect)
  const defer = useCallback((fn: () => void) => {
    setTimeout(fn, 0)
  }, [])

  // Si llega email por querystring, lo tomamos y cargamos
  useEffect(() => {
    const e = normEmail(emailParam)
    defer(() => {
      setEmailInput(prev => (prev === e ? prev : e))
      setEmailSel(prev => (prev === e ? prev : e))
    })
  }, [emailParam, normEmail, defer])

  const labelDepto = useCallback((d: Depto) => {
    const parts: string[] = []
    if (d.cultivo) parts.push(d.cultivo)
    if (d.fundo) parts.push(d.fundo)
    const suf = parts.length ? ` (${parts.join(' - ')})` : ''
    return `${d.departamento}${suf}`
  }, [])

  const cargarDeptos = useCallback(async () => {
    const { data, error } = await supabase
      .from('deptos')
      .select('id, departamento, cultivo, fundo')
      .eq('activo', true)
      // No mostrar registros “técnicos” de fertirriego (causan duplicados en la UI)
      .not('id', 'ilike', '%FERTIRRIEGO%')
      .neq('id', 'FERTIRRIEGO_PALTA')
      .neq('id', 'FERTIRRIEGO_ARANDANO')
      .order('departamento')
      .order('cultivo', { ascending: true, nullsFirst: true })
      .order('fundo', { ascending: true, nullsFirst: true })
      .order('id')

    if (error) {
      console.error('cargarDeptos error:', error)
      setMsg(`❌ Error cargando departamentos: ${error.code ?? ''} ${error.message}`)
      return
    }

    // Defensa adicional (por si cambian ids o llega data cacheada)
    // 1) quitar cualquier registro técnico de FERTIRRIEGO y normalizar la deduplicación
    const cleaned = (data ?? []).filter(d => {
      const id = String(d.id ?? '').trim().toUpperCase()
      const depto = String(d.departamento ?? '').trim().toUpperCase()
      // Excluir cualquier fila técnica de fertirriego aunque venga con departamento=FERTILIZACION
      if (id.includes('FERTIRRIEGO')) return false
      if (id === 'FERTIRRIEGO_PALTA' || id === 'FERTIRRIEGO_ARANDANO') return false
      // Defensa extra por si algún id no contiene FERTIRRIEGO pero el depto sí es técnico
      if (depto === 'FERTIRRIEGO') return false
      return true
    })

    // Deduplicar por lo que VE la UI (departamento + cultivo + fundo), normalizado
    const norm = (v: unknown) => String(v ?? '').trim().toUpperCase()
    const byKey = new Map<string, Depto>()
    for (const d of cleaned) {
      const key = `${norm(d.departamento)}|${norm(d.cultivo)}|${norm(d.fundo)}`
      if (!byKey.has(key)) {
        byKey.set(key, d)
        continue
      }

      // Si existiera duplicado, conservar el que tenga un id “más simple” (no técnico)
      const prev = byKey.get(key)!
      const prevId = norm(prev.id)
      const curId = norm(d.id)
      const prevIsTech = prevId.includes('FERTIRRIEGO')
      const curIsTech = curId.includes('FERTIRRIEGO')
      if (prevIsTech && !curIsTech) byKey.set(key, d)
    }

    setDeptos(Array.from(byKey.values()))
  }, [])

  const cargarAccesos = useCallback(
    async (emailToLoad: string) => {
      const emailN = normEmail(emailToLoad)

      if (!emailN) {
        setAccesos([])
        setMsg('⚠️ Ingresa un email para cargar accesos')
        return
      }

      setLoading(true)
      setMsg(null)

      const { data, error } = await supabase
        .from('jefes_acceso_v2')
        .select('id, user_id, email, depto_id, rol, jefe, activo')
        .eq('email', emailN)
        .order('depto_id')

      if (error) {
        console.error('cargarAccesos error:', error)
        setAccesos([])
        setMsg(`❌ Error cargando accesos: ${error.code ?? ''} ${error.message}`)
      } else {
        setAccesos((data ?? []) as AccesoRow[])
        setMsg('✅ Accesos cargados')
      }

      setLoading(false)
    },
    [normEmail]
  )

  const obtenerUserIdPorEmail = useCallback(
    async (emailToFind: string): Promise<string | null> => {
      const emailN = normEmail(emailToFind)
      if (!emailN) return null

      // El user_id viene de profiles.id (FK a auth.users.id)
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', emailN)
        .maybeSingle()

      if (error) {
        console.error('obtenerUserIdPorEmail error:', error)
        setMsg(`❌ Error buscando perfil: ${error.code ?? ''} ${error.message}`)
        return null
      }

      return (data?.id as string | undefined) ?? null
    },
    [normEmail]
  )

  const guardarAcceso = useCallback(
    async (row: AccesoRow) => {
      setLoading(true)
      setMsg(null)

      const emailN = normEmail(row.email)
      const userId = row.user_id ?? (await obtenerUserIdPorEmail(emailN))

      if (!userId) {
        setLoading(false)
        setMsg(
          '⚠️ No se encontró el perfil del usuario. Primero crea/verifica el perfil en /admin/usuarios (o crea el usuario en Supabase Auth y su perfil) y luego vuelve a asignar accesos.'
        )
        return
      }

      const { error } = await supabase
        .from('jefes_acceso_v2')
        .upsert(
          {
            user_id: userId,
            email: emailN,
            depto_id: row.depto_id,
            rol: row.rol,
            jefe: row.jefe,
            activo: row.activo,
          },
          { onConflict: 'email,depto_id' }
        )

      if (error) {
        console.error('guardarAcceso error:', error)
        setMsg(`❌ Error guardando acceso: ${error.code ?? ''} ${error.message}`)
      } else {
        setMsg('✅ Acceso guardado')
        void cargarAccesos(emailSel)
      }

      setLoading(false)
    },
    [cargarAccesos, emailSel, normEmail, obtenerUserIdPorEmail]
  )

  const eliminarAcceso = useCallback(
    async (row: AccesoRow) => {
      if (!confirm('¿Eliminar acceso?')) return

      setLoading(true)
      setMsg(null)

      const { error } = await supabase
        .from('jefes_acceso_v2')
        .delete()
        .eq('email', normEmail(row.email))
        .eq('depto_id', row.depto_id)

      if (error) {
        console.error('eliminarAcceso error:', error)
        setMsg(`❌ Error eliminando acceso: ${error.code ?? ''} ${error.message}`)
      } else {
        setMsg('🗑️ Acceso eliminado')
        void cargarAccesos(emailSel)
      }

      setLoading(false)
    },
    [cargarAccesos, emailSel, normEmail]
  )

  // Cargar departamentos solo 1 vez
  useEffect(() => {
    defer(() => {
      void cargarDeptos()
    })
  }, [cargarDeptos, defer])

  // Cargar accesos solo cuando cambie el email “confirmado” (no al tipear)
  useEffect(() => {
    const e = normEmail(emailSel)
    if (!e) return
    // Defer para que los setState dentro de cargarAccesos no ocurran en el mismo tick del effect
    defer(() => {
      void cargarAccesos(e)
    })
  }, [emailSel, cargarAccesos, normEmail, defer])

  const deptosDisponibles = useMemo(() => {
    const usados = new Set(accesos.map(a => a.depto_id))
    return deptos.filter(d => !usados.has(d.id))
  }, [deptos, accesos])

  function agregarDepto(deptoId: string) {
    const emailN = normEmail(emailSel || emailInput)
    if (!emailN) {
      setMsg('⚠️ Ingresa un email antes de agregar departamentos')
      return
    }

    const nuevo: AccesoRow = {
      user_id: null,
      email: emailN,
      depto_id: deptoId,
      rol: 'USUARIO',
      jefe: false,
      activo: true,
    }
    setAccesos(prev => [...prev, nuevo])
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Administración de Accesos</h1>
        <Link
          href="/admin/usuarios"
          className="border px-3 py-2 rounded hover:bg-gray-50"
        >
          ← Volver a Usuarios
        </Link>
      </div>

      <div className="flex gap-4 items-end">
        <div>
          <label className="text-sm">Email usuario</label>
          <input
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            className="border px-2 py-1 rounded w-72"
            placeholder="usuario@empresa.com"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const e = normEmail(emailInput)
            setEmailSel(e)
          }}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Cargando…' : 'Cargar'}
        </button>
      </div>

      {msg && <div className="text-sm">{msg}</div>}

      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Departamento</th>
              <th className="p-2">Rol</th>
              <th className="p-2">Jefe</th>
              <th className="p-2">Activo</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {accesos.map(a => {
              const d = deptos.find(x => x.id === a.depto_id)
              return (
                <tr key={a.depto_id} className="border-t">
                  <td className="p-2">
                    {d ? labelDepto(d) : a.depto_id}
                  </td>
                  <td className="p-2 text-center">
                    <select
                      value={a.rol}
                      onChange={e =>
                        setAccesos(prev =>
                          prev.map(x =>
                            x.depto_id === a.depto_id
                              ? { ...x, rol: e.target.value as RolDepto }
                              : x
                          )
                        )
                      }
                    >
                      <option value="USUARIO">USUARIO</option>
                      <option value="JEFE">JEFE</option>
                    </select>
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={a.jefe}
                      onChange={e =>
                        setAccesos(prev =>
                          prev.map(x =>
                            x.depto_id === a.depto_id
                              ? { ...x, jefe: e.target.checked }
                              : x
                          )
                        )
                      }
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="checkbox"
                      checked={a.activo}
                      onChange={e =>
                        setAccesos(prev =>
                          prev.map(x =>
                            x.depto_id === a.depto_id
                              ? { ...x, activo: e.target.checked }
                              : x
                          )
                        )
                      }
                    />
                  </td>
                  <td className="p-2 text-center space-x-2">
                    <button
                      type="button"
                      onClick={() => guardarAcceso(a)}
                      disabled={loading}
                      className="px-2 py-1 bg-green-600 text-white rounded disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarAcceso(a)}
                      disabled={loading}
                      className="px-2 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              )
            })}
            {accesos.length === 0 && (
              <tr>
                <td className="p-3 text-center text-gray-500" colSpan={5}>
                  No hay accesos para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border rounded p-4 space-y-2">
        <h2 className="font-semibold">Agregar departamento</h2>
        <select
          onChange={e => {
            const v = e.target.value
            if (v) agregarDepto(v)
            e.target.value = ''
          }}
          className="border px-2 py-1 rounded"
        >
          <option value="">-- seleccionar --</option>
          {deptosDisponibles.map(d => (
            <option key={d.id} value={d.id}>
              {labelDepto(d)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}