'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function ReporteTable() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      setUserEmail(data?.user?.email ?? '')
    }
    load()
  }, [])

  type Row = {
    labor?: string
    fecha?: string
    fundo?: string
    semana?: string | number
    loteRed?: string
    lider?: string
    jornal?: number
    ha?: number
    cantidad?: number
    kg?: number
    extras?: Record<string, unknown>
  } & Record<string, unknown>

  const [rows, setRows] = useState<Row[]>([])

  const escapeCsv = (value: unknown) => {
    // Normaliza valores a texto
    const s = value == null ? '' : String(value)
    // Escapa comillas dobles
    const escaped = s.replace(/"/g, '""')
    // Si tiene coma, salto de línea o comillas, envolver en comillas
    if (/[",\n\r]/.test(escaped)) return `"${escaped}"`
    return escaped
  }

  const toNum = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const ratio = (num: number, den: number) => {
    if (!den) return 0
    return num / den
  }

  const fmt = (n: number) => {
    // 2 decimales como en el formato
    return Number.isFinite(n) ? n.toFixed(2) : '0.00'
  }

  const groups = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of rows) {
      const k = String(r.labor ?? r['labor'] ?? 'SIN_LABOR')
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(r)
    }
    return Array.from(m.entries()).map(([labor, rs]) => ({ labor, rows: rs }))
  }, [rows])

  const extraKeys = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const ex = (r.extras ?? r['extras']) as Record<string, unknown> | undefined
      if (ex && typeof ex === 'object') Object.keys(ex).forEach(k => set.add(k))
    }
    return Array.from(set)
  }, [rows])

  const handleDownload = () => {
    if (!rows.length) return

    const csvLines: string[] = []

    // Encabezado (similar al formato)
    csvLines.push(escapeCsv('REPORTE DE OPERACIONES AGRICOLAS'))
    csvLines.push(`${escapeCsv('USUARIO:')},${escapeCsv(userEmail)}`)
    csvLines.push('')

    // Columnas base (formato similar a tu excel)
    const baseHeaders = [
      'Lote- Red',
      'Lider',
      'Jornal',
      'Avance 1 (Has)',
      'Ratio 1 (JorxHa)',
      'Avance 2 (Cantidad)',
      'Ratio 2 Cantidad / Ha',
      'Avance 3 (Kilos)',
      'Ratio 3 Kg / Ha',
    ]

    for (const g of groups) {
      csvLines.push(`${escapeCsv('LABOR:')},${escapeCsv(g.labor)}`)

      const headers = [...baseHeaders, ...extraKeys]
      csvLines.push(headers.map(h => escapeCsv(h)).join(','))

      let sumJor = 0
      let sumHa = 0
      let sumCant = 0
      let sumKg = 0

      // Filas
      for (const r of g.rows) {
        const lote = String(r.loteRed ?? r['loteRed'] ?? r['lote_red'] ?? r['lote'] ?? '')
        const lider = String(r.lider ?? r['lider'] ?? r['encargado'] ?? r['lider_nombre'] ?? '')

        const jor = toNum(r.jornal ?? r['jornal'] ?? r['jornales'])
        const ha = toNum(r.ha ?? r['ha'] ?? r['hectareas'])
        const cant = toNum(r.cantidad ?? r['cantidad'])
        const kg = toNum(r.kg ?? r['kg'] ?? r['kilos'])

        sumJor += jor
        sumHa += ha
        sumCant += cant
        sumKg += kg

        const r1 = ratio(jor, ha)
        const r2 = ratio(cant, ha)
        const r3 = ratio(kg, ha)

        const ex = (r.extras ?? r['extras']) as Record<string, unknown> | undefined

        const rowVals: (string | number)[] = [
          lote,
          lider,
          fmt(jor),
          fmt(ha),
          fmt(r1),
          fmt(cant),
          fmt(r2),
          fmt(kg),
          fmt(r3),
        ]

        for (const k of extraKeys) {
          const v = ex && typeof ex === 'object' ? ex[k] : ''
          rowVals.push(v == null ? '' : String(v))
        }

        csvLines.push(rowVals.map(v => escapeCsv(v)).join(','))
      }

      // TOTAL
      const totalR1 = ratio(sumJor, sumHa)
      const totalR2 = ratio(sumCant, sumHa)
      const totalR3 = ratio(sumKg, sumHa)

      const totalVals: (string | number)[] = [
        'TOTAL',
        '',
        fmt(sumJor),
        fmt(sumHa),
        fmt(totalR1),
        fmt(sumCant),
        fmt(totalR2),
        fmt(sumKg),
        fmt(totalR3),
      ]

      // extras vacíos en total (si luego quieres sumarlos, lo hacemos)
      for (const _k of extraKeys) totalVals.push('')

      csvLines.push(totalVals.map(v => escapeCsv(v)).join(','))
      csvLines.push('')
    }

    // UTF-8 con BOM para Excel
    const csvContent = '\uFEFF' + csvLines.join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url

    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')

    a.download = `reporte-avance_${yyyy}-${mm}-${dd}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()

    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="toolbar">
        <button
          type="button"
          onClick={() => router.push('/reporte-avance')}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          📊 Reporte
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-md border border-green-600 bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          ⬇ Descargar reporte
        </button>
        <button
          type="button"
          onClick={() => setRows(prev => [...prev, {}])}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + Agregar fila
        </button>
      </div>
      {/* Rest of the table rendering */}
    </div>
  )
}
