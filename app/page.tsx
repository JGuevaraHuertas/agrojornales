'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function HomePage() {
  const router = useRouter()
  const [msg, setMsg] = useState('Cargando...')

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      const hasSession = !!data?.session

      setMsg(hasSession ? 'Redirigiendo al plan...' : 'Redirigiendo al login...')
      router.replace(hasSession ? '/plan-mensual' : '/login')
    }

    run()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-sm text-gray-700">
        {msg}
      </div>
    </div>
  )
}