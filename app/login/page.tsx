import { Suspense } from 'react'
import LoginClient from './LoginClient'

// Evita que Vercel intente prerenderizar /login como estático
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  )
}