'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LogoutPage() {
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      // Cierra sesión (local)
      await supabase.auth.signOut()

      // Limpieza extra (por si el token quedó pegado)
      if (typeof window !== 'undefined') {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
          .forEach((k) => localStorage.removeItem(k))
      }

      // Redirige y fuerza refresh
      router.replace('/login')
      router.refresh()
    }

    run()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      Cerrando sesión...
    </div>
  )
}
