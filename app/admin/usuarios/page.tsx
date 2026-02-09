'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'

type RolGlobal = 'ADMIN' | 'JEFE' | 'USUARIO'

type Perfil = {
  id: string
  email: string
  nombre: string | null
  rol: RolGlobal
  activo: boolean
  created_at: string
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [form, setForm] = useState({
    uid: '', // UID de Supabase Auth (Authentication → Users)
    email: '',
    nombre: '',
    rol: 'USUARIO' as RolGlobal,
    activo: true,
  })

  // 1. Memorizamos la función para que no cambie en cada render
  const cargarUsuarios = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, nombre, rol, activo, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setMsg(`❌ Error cargando usuarios: ${error.code ?? ''} ${error.message}`)
      return
    }

    setUsuarios((data ?? []) as Perfil[])
  }, [])

  // 2. El efecto ahora es seguro y no causará bucles infinitos
  useEffect(() => {
    void cargarUsuarios()
  }, [cargarUsuarios])

  const verificarOCrearPerfil = async () => {
    if (!form.email) {
      setMsg('⚠️ Email requerido')
      return
    }

    const emailNorm = form.email.trim().toLowerCase()
    const uidNorm = form.uid.trim()
    const rolSel = form.rol

    setLoading(true)
    setMsg(null)

    try {
      // 1) ¿Ya existe en profiles por EMAIL?
      const { data: existenteEmail, error: errEmail } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', emailNorm)
        .maybeSingle()

      if (errEmail) {
        setMsg(`❌ Error consultando profiles por email: ${errEmail.code ?? ''} ${errEmail.message}`)
        return
      }

      if (existenteEmail?.id) {
        setMsg('✅ El usuario ya existe en profiles (por email). Puedes editarlo abajo y asignarle accesos en “Gestionar”.')
        return
      }

      // 2) Si el usuario fue creado en Supabase Auth, a veces un trigger ya crea el perfil por UID.
      //    Verificamos también por ID (UID) para evitar 23505 duplicate key.
      if (uidNorm) {
        const { data: existenteId, error: errId } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('id', uidNorm)
          .maybeSingle()

        if (errId) {
          setMsg(`❌ Error consultando profiles por UID: ${errId.code ?? ''} ${errId.message}`)
          return
        }

        if (existenteId?.id) {
          // Ya existe el perfil con ese UID → actualizamos sus datos (email/nombre/rol/activo)
          const { error: errUpd } = await supabase
            .from('profiles')
            .update({
              email: emailNorm,
              nombre: form.nombre?.trim() || null,
              rol: rolSel,
              activo: form.activo,
            })
            .eq('id', uidNorm)

          if (errUpd) {
            const hint =
              errUpd.code === '42501'
                ? ' (RLS: falta policy UPDATE para ADMIN en profiles)'
                : errUpd.code === '23514'
                  ? ' (CHECK: el rol no coincide con el constraint; revisa profiles_rol_check)'
                  : errUpd.code === '23505'
                    ? ' (UNIQUE: el email ya está usado por otro perfil)'
                    : ''

            setMsg(`❌ El perfil ya existía por UID, pero no se pudo actualizar: ${errUpd.code ?? ''} ${errUpd.message}${hint}`)
            return
          }

          setMsg('✅ El perfil ya existía por UID (trigger). Se actualizó y ya puedes asignarle accesos en “Gestionar”.')
          await cargarUsuarios()
          return
        }
      }

      // 2) No existe en profiles → necesitamos UID de Auth para crear el perfil (FK profiles.id → auth.users.id)
      if (!uidNorm) {
        setMsg(
          'ℹ️ No existe en profiles todavía. Si ya lo creaste en Supabase Auth, copia su **UID** (Authentication → Users) y pégalo aquí para crear su perfil. ' +
            'Si aún no lo creaste en Auth, primero invítalo/crealo y luego pega el UID.'
        )
        return
      }

      // 3) Intentar crear perfil (requiere policy RLS que permita INSERT a ADMIN)
      const { error: errIns } = await supabase.from('profiles').insert({
        id: uidNorm,
        email: emailNorm,
        nombre: form.nombre?.trim() || null,
        rol: rolSel,
        activo: form.activo,
      })

      if (errIns) {
        // Si ya existe por UID (race/trigger), hacemos UPDATE como fallback
        if (errIns.code === '23505') {
          const { error: errUpd2 } = await supabase
            .from('profiles')
            .update({
              email: emailNorm,
              nombre: form.nombre?.trim() || null,
              rol: rolSel,
              activo: form.activo,
            })
            .eq('id', uidNorm)

          if (!errUpd2) {
            setMsg('✅ El perfil ya existía (duplicate key). Se actualizó correctamente.')
            setForm({ uid: '', email: '', nombre: '', rol: 'USUARIO', activo: true })
            await cargarUsuarios()
            return
          }
        }

        // Mensaje con pistas comunes
        const hint =
          errIns.code === '42501'
            ? ' (RLS: falta policy INSERT para ADMIN en profiles)'
            : errIns.code === '23514'
              ? ' (CHECK: el rol no coincide con el constraint; revisa profiles_rol_check)'
              : errIns.code === '23503'
                ? ' (FK: el UID no existe en auth.users)'
                : errIns.code === '23505'
                  ? ' (DUPLICATE: ya existe un perfil con ese UID)'
                  : ''

        setMsg(`❌ No se pudo crear el perfil: ${errIns.code ?? ''} ${errIns.message}${hint}`)
        return
      }

      setMsg('✅ Perfil creado/actualizado en profiles. Ya puedes editarlo y asignarle accesos.')
      // Limpia formulario para evitar reintentos con el mismo UID
      setForm({ uid: '', email: '', nombre: '', rol: 'USUARIO', activo: true })
      await cargarUsuarios()
    } catch {
      setMsg('❌ Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const actualizarUsuario = async (u: Perfil, cambios: Partial<Perfil>) => {
    setLoading(true)
    setMsg(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update(cambios)
        .eq('id', u.id)

      if (error) {
        const hint =
          error.code === '42501'
            ? ' (RLS: falta policy UPDATE para ADMIN en profiles)'
            : error.code === '23514'
              ? ' (CHECK: el rol no coincide con el constraint; revisa profiles_rol_check)'
              : error.code === '23505'
                ? ' (UNIQUE: email duplicado)'
                : ''

        setMsg(`❌ Error actualizando usuario: ${error.code ?? ''} ${error.message}${hint}`)
      } else {
        setMsg('✅ Usuario actualizado')
        await cargarUsuarios()
      }
    } catch (err) {
      setMsg('❌ Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Administración de Usuarios</h1>

      {msg && (
        <div
          className={`text-sm p-2 rounded ${
            msg.includes('✅')
              ? 'bg-green-100 text-green-800'
              : msg.includes('ℹ️') || msg.includes('⚠️')
                ? 'bg-yellow-100 text-yellow-900'
                : 'bg-red-100 text-red-800'
          }`}
        >
          {msg}
        </div>
      )}

      {/* Formulario Crear usuario */}
      <div className="border rounded p-4 space-y-3 bg-white shadow-sm">
        <h2 className="font-semibold">Crear / verificar perfil (profiles)</h2>
        <div className="flex flex-wrap gap-3">
          <input
            className="border px-2 py-1 rounded w-64"
            placeholder="UID de Auth (Authentication → Users)"
            value={form.uid}
            onChange={e => setForm({ ...form, uid: e.target.value })}
          />
          <input
            className="border px-2 py-1 rounded w-64"
            placeholder="email@empresa.com"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="border px-2 py-1 rounded w-64"
            placeholder="Nombre"
            value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
          />
          <select
            className="border px-2 py-1 rounded"
            value={form.rol}
            onChange={e => setForm({ ...form, rol: e.target.value as RolGlobal })}
          >
            {/* Nota: si tu BD tiene profiles_rol_check solo (ADMIN, JEFE), agrega USUARIO al constraint o quita esta opción */}
            <option value="USUARIO">USUARIO</option>
            <option value="JEFE">JEFE</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={e => setForm({ ...form, activo: e.target.checked })}
            />
            Activo
          </label>
          <button
            onClick={verificarOCrearPerfil}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Verificar / Crear perfil'}
          </button>
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="border rounded overflow-hidden bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-left border-b">Email</th>
              <th className="p-3 text-left border-b">Nombre</th>
              <th className="p-3 text-center border-b">Rol</th>
              <th className="p-3 text-center border-b">Activo</th>
              <th className="p-3 text-center border-b">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id} className="border-t hover:bg-gray-50">
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <input
                    className="border px-2 py-1 rounded w-full"
                    defaultValue={u.nombre ?? ''}
                    onBlur={e => {
                      const nuevo = e.target.value.trim()
                      if (nuevo !== (u.nombre ?? '')) {
                        actualizarUsuario(u, { nombre: nuevo || null })
                      }
                    }}
                  />
                </td>
                <td className="p-3 text-center">
                  <select
                    className="border rounded px-1"
                    value={u.rol}
                    onChange={e => actualizarUsuario(u, { rol: e.target.value as RolGlobal })}
                  >
                    <option value="USUARIO">USUARIO</option>
                    <option value="JEFE">JEFE</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={u.activo}
                    onChange={e => actualizarUsuario(u, { activo: e.target.checked })}
                  />
                </td>
                <td className="p-3 text-center">
                  <Link
                    href={`/admin/accesos?email=${u.email}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Gestionar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}