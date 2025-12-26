'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Profile = {
  nombre: string | null
  email: string | null
  rol: string | null
}

export default function Header() {
  const pathname = usePathname()
  const hideHeader = pathname === '/login' || pathname === '/logout'

  const [profile, setProfile] = useState<Profile | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (hideHeader) return

    const run = async () => {
      const { data: ses } = await supabase.auth.getSession()
      const userId = ses.session?.user.id
      if (!userId) return

      const { data } = await supabase
        .from('profiles')
        .select('nombre, email, rol')
        .eq('id', userId)
        .single()

      setProfile((data ?? null) as Profile | null)
    }

    run()
  }, [hideHeader])

  const logout = async () => {
    try {
      setClosing(true)

      // 1) cerrar sesión
      await supabase.auth.signOut()

      // 2) limpiar tokens locales (por si queda pegado)
      if (typeof window !== 'undefined') {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
          .forEach((k) => localStorage.removeItem(k))
      }

      // 3) redirect duro (evita estado viejo)
      window.location.assign('/login')
    } finally {
      setClosing(false)
    }
  }

  if (hideHeader) return null

  return (
    <header className="w-full border-b bg-white px-6 py-3 flex items-center justify-between">
      <div className="font-bold text-lg">AgroJornales</div>

      <div className="flex items-center gap-4 text-sm">
        {profile ? (
          <>
            <span>
              Usuario: <b>{profile.nombre ?? profile.email}</b>
            </span>
            <span>
              Rol: <b>{profile.rol ?? '-'}</b>
            </span>
          </>
        ) : (
          <span className="text-gray-500">—</span>
        )}

        <button
          onClick={logout}
          disabled={closing}
          className="border rounded px-3 py-1 hover:bg-red-50 hover:text-red-600 hover:border-red-400 transition disabled:opacity-60"
        >
          {closing ? 'Cerrando...' : 'Cerrar sesión'}
        </button>
      </div>
    </header>
  )
}
