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
      const { data } = await supabase.auth.getUser()
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
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-bold">Admin</h1>
      <p>Sesión OK ✅</p>
      <p><b>Usuario:</b> {email}</p>

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
