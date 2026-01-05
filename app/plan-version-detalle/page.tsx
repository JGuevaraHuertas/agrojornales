import { Suspense } from 'react'
import PlanVersionesDetalleClient from './PlanVersionesDetalleClient'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Cargando…</div>}>
      <PlanVersionesDetalleClient />
    </Suspense>
  )
}
