'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Home() {
  const [msg, setMsg] = useState('Conectando a Supabase...')

  useEffect(() => {
    const test = async () => {
      const { error } = await supabase
        .from('planes')   // 👈 si tu tabla se llama distinto, dime
        .select('id')
        .limit(1)

      if (error) {
        setMsg('❌ Error: ' + error.message)
      } else {
        setMsg('✅ Conexión OK a Supabase')
      }
    }

    test()
  }, [])

  return (
    <main className="p-6">
      <h1 className="text-xl font-bold">Agrojornales</h1>
      <p className="mt-4">{msg}</p>
    </main>
  )
}
