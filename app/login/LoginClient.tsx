'use client'

import Image from 'next/image'
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginClient() {
  const router = useRouter()
  const sp = useSearchParams()
  const nextUrl = sp.get('next') || '/plan-mensual'

  const DOMAIN = '@agrokasa.com.pe'
  const version = 'v1.0.0'

  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Normaliza usuario (sin espacios y en minúsculas)
  const email = useMemo(() => {
    const u = user.trim().toLowerCase()
    if (!u) return ''
    if (u.includes('@')) return `${u.split('@')[0]}${DOMAIN}`
    return `${u}${DOMAIN}`
  }, [user])

  // Si ya hay sesión, redirige
  useEffect(() => {
    let mounted = true

    const run = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!mounted) return
      if (error) return
      if (data.session) router.replace(nextUrl)
    }

    run()

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      // Evita redirects duplicados
      if (session) router.replace(nextUrl)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [router, nextUrl])

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')

    const u = user.trim()
    if (!u || !password) {
      setMsg('Ingrese usuario y contraseña.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      setMsg('Credenciales incorrectas o usuario no habilitado.')
      return
    }

    router.replace(nextUrl)
  }

  const onForgot = async () => {
    setMsg('')

    const u = user.trim()
    if (!u) {
      setMsg('Escribe tu usuario para enviarte el enlace de recuperación.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)

    if (error) {
      setMsg('No se pudo enviar el correo de recuperación.')
      return
    }

    setMsg('Te enviamos un correo para restablecer tu contraseña.')
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Fondo */}
      <div className="absolute inset-0 bg-gray-100">
        <Image src="/bg-login.jpg" alt="Fondo" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-green-900/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-gray-100/60 to-gray-200/80" />
      </div>

      {/* Logo superior */}
      <div className="relative z-10 p-6">
        <Image
          src="/logo-agrokasa.png"
          alt="Agrokasa"
          width={210}
          height={64}
          className="h-12 w-auto"
          style={{ objectFit: 'contain' }}
        />
      </div>

      {/* Card */}
      <div className="relative z-10 min-h-[calc(100vh-120px)] flex items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-[360px] sm:max-w-[400px] md:max-w-[440px] bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-black/10">
          <div className="p-8">
            <div className="flex justify-center mb-8">
              <Image
                src="/logo-agrojornales.png"
                alt="AgroJornales"
                width={300}
                height={180}
                priority
                className="w-[150px] sm:w-[170px] md:w-[190px] h-auto mx-auto drop-shadow-sm"
              />
            </div>

            <form onSubmit={onLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Usuario</label>

                <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-gray-50 overflow-hidden">
                  <input
                    className="w-full bg-transparent px-3 py-2 outline-none"
                    placeholder="jguevara"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    autoComplete="username"
                    inputMode="text"
                  />
                  <div className="px-3 py-2 text-sm text-gray-600 border-l border-gray-300 bg-gray-100 whitespace-nowrap">
                    {DOMAIN}
                  </div>
                </div>

                <div className="text-xs text-gray-500 mt-1">
                  Ingrese solo su usuario (ej: <b>jguevara</b>)
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Contraseña</label>

                <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-gray-50 overflow-hidden">
                  <input
                    className="w-full bg-transparent px-3 py-2 outline-none"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              <div className="text-left">
                <button
                  type="button"
                  onClick={onForgot}
                  disabled={loading || !user.trim()}
                  className="text-sm text-green-700 hover:text-green-800 hover:underline disabled:opacity-60"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              {msg && (
                <div className="text-sm rounded-lg px-3 py-2 border bg-yellow-50 border-yellow-200 text-yellow-900">
                  {msg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg py-2.5 font-semibold text-white border border-green-700 bg-green-700 hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Ingresando…' : 'INGRESAR'}
              </button>

              <div className="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-900">
                Esta plataforma está en fase de construcción. Algunas funciones pueden no estar disponibles.
              </div>

              <div className="mt-3 text-center text-xs text-gray-500">Versión: {version}</div>
            </form>
          </div>
        </div>
      </div>

      <div className="relative z-10 pb-6 text-center text-xs text-gray-600">
        © {new Date().getFullYear()} – AgroJornales
      </div>
    </div>
  )
}