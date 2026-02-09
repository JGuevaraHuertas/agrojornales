'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ReporteDiaForm from '@/components/reporte-diario/ReporteDiaForm'

export default function Page() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    let mounted = true

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (!mounted) return

      const email = data.user?.email ?? ''
      if (error || !email) {
        router.replace('/login')
        return
      }

      setUserEmail(email)
      setLoading(false)
    }

    loadUser()

    return () => {
      mounted = false
    }
  }, [router])

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Cargando...</div>
      </div>
    )
  }

  if (!userEmail) return null

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ReporteDiaForm userEmail={userEmail} />
    </div>
  )
}