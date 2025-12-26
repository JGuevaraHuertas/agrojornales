'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
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
      const { data, error: userErr } = await supabase.auth.getUser()
      if (userErr) {
        console.error(userErr)
      }

      const user = data?.user
      if (!user?.id) {
        setProfile(null)
        return
      }

      const emailKey = String(user.email ?? '').trim().toLowerCase()

      // 1) Perfil (nombre/email/rol opcional)
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('nombre, email, rol')
        .eq('id', user.id)
        .maybeSingle()

      if (profErr) console.error(profErr)

      const nombre = (prof as any)?.nombre ?? null
      const email = (prof as any)?.email ?? user.email ?? null
      const rolProfile = (prof as any)?.rol ?? null

      // 2) Rol real (desde permisos)
      const { data: accesos, error: accErr } = await supabase
        .from('jefes_acceso_v2')
        .select('rol')
        .eq('email', emailKey)
        .eq('activo', true)
        .limit(1)

      if (accErr) console.error(accErr)

      const rolAcceso = (accesos?.[0] as any)?.rol ?? null

      setProfile({
        nombre,
        email,
        rol: rolAcceso ?? rolProfile, // prioridad: jefes_acceso_v2
      })
    }

    run()
  }, [hideHeader])

  const logout = async () => {
    try {
      setClosing(true)
      await supabase.auth.signOut()
      window.location.href = '/login'
    } finally {
      setClosing(false)
    }
  }

  if (hideHeader) return null

  return (
    <header className="w-full bg-green-800 text-white px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-white rounded-md p-1 flex items-center justify-center">
          <Image
            src="/logo-agrojornales.png"
            alt="AgroJornales"
            width={38}
            height={38}
            priority
          />
        </div>

        <div className="leading-tight">
          <div className="font-bold text-lg">AgroJornales</div>
          <div className="text-xs opacity-90">Gestión y planificación</div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        {profile ? (
          <>
            <span>
              Usuario: <b>{profile.email ?? profile.nombre ?? '—'}</b>
            </span>
            <span>
              Rol: <b>{profile.rol ?? '-'}</b>
            </span>
          </>
        ) : (
          <span className="opacity-80">—</span>
        )}

        <button
          onClick={logout}
          disabled={closing}
          className="border border-white/30 rounded px-3 py-1 hover:bg-white/10 transition disabled:opacity-60"
        >
          {closing ? 'Cerrando...' : 'Cerrar sesión'}
        </button>
      </div>
    </header>
  )
}
