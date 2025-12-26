// app/login/page.tsx
import { Suspense } from 'react'
import LoginClient from './LoginClient'

// Estas directivas ayudan a que no se intente generar como estático puro
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    // El Suspense DEBE envolver a cualquier componente que use useSearchParams
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-gray-600">
          Cargando...
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  )
}