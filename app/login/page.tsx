import { Suspense } from 'react'
import LoginClient from './LoginClient'

// Evita prerender estático de /login en Vercel
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-700">
          Cargando…
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  )
}