'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) console.error(error)

      if (!data.user) {
        router.replace('/login')
        return
      }

      setEmail(data.user.email ?? null)
      setLoading(false)
    }
    run()
  }, [router])

  if (loading) return <div className="p-6">Cargando…</div>

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="text-sm text-gray-600">Sesión OK ✅</p>
        <p className="text-sm">
          <b>Usuario:</b> {email}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="border px-3 py-2 rounded" onClick={() => router.push('/plan-mensual')}>
          Ir a Plan Mensual
        </button>

        {/* Si luego creas estas rutas, ya te quedan listas */}
        <button className="border px-3 py-2 rounded" onClick={() => router.push('/admin/usuarios')}>
          Usuarios
        </button>

        <button className="border px-3 py-2 rounded" onClick={() => router.push('/admin/accesos')}>
          Accesos (jefes_acceso)
        </button>
      </div>

      <button
        className="border px-3 py-2 rounded"
        onClick={async () => {
          await supabase.auth.signOut()
          router.replace('/login')
        }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}
