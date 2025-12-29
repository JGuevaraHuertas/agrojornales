'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'

type UIProfile = {
  nombre: string | null
  email: string | null
  rol: string | null
}

type ProfileRow = {
  nombre: string | null
  email: string | null
  rol: string | null
}

type AccesoRow = {
  rol: string | null
}

function normalizeEmail(v: unknown): string {
  return String(v ?? '').trim().toLowerCase()
}

function normalizeRol(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return s ? s.toUpperCase() : null
}

function pickBestRol(roles: Array<string | null | undefined>): string | null {
  const set = new Set(roles.map((r) => normalizeRol(r)).filter(Boolean) as string[])
  if (set.has('ADMIN')) return 'ADMIN'
  if (set.has('JEFE')) return 'JEFE'
  if (set.has('USUARIO')) return 'USUARIO'
  const first = Array.from(set)[0]
  return first ?? null
}

export default function Header() {
  const pathname = usePathname()
  const hideHeader = useMemo(() => pathname === '/login' || pathname === '/logout', [pathname])

  const [profile, setProfile] = useState<UIProfile | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (hideHeader) return

    const run = async () => {
      const { data: userRes, error: userErr } = await supabase.auth.getUser()
      if (userErr) console.error(userErr)

      const user = userRes?.user
      if (!user?.id) {
        setProfile(null)
        return
      }

      // 1) Perfil
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('nombre, email, rol')
        .eq('id', user.id)
        .maybeSingle<ProfileRow>()

      if (profErr) console.error(profErr)

      const nombre = prof?.nombre ?? null
      const email = prof?.email ?? user.email ?? null
      const emailKey = normalizeEmail(email)

      // 2) Roles desde accesos (prioridad)
      const { data: accesos, error: accErr } = await supabase
        .from('jefes_acceso_v2') // si usas jefes_acceso, cambia aquí
        .select('rol')
        .eq('email', emailKey)
        .eq('activo', true)

      if (accErr) console.error(accErr)

      const rolAccesos = pickBestRol((accesos ?? []).map((x: AccesoRow) => x.rol))
      const rolProfile = normalizeRol(prof?.rol)

      setProfile({
        nombre,
        email,
        rol: rolAccesos ?? rolProfile,
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
          <Image src="/logo-agrojornales.png" alt="AgroJornales" width={38} height={38} priority />
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