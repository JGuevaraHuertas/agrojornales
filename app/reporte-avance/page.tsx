'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Row = {
  id: string
  encargado_nombre: string
  labor: string
  ha: number
  jornales: number
  cantidad: number
  kg: number
  extras?: Record<string, unknown>
  created_at?: string
  fecha?: string
  bloque_id?: string
  encargado_codigo?: string
  labor_id?: string
  detalle_id_origen?: string
  obs?: string
}

type DetalleGroup = {
  id: string
  titulo: string
  encargado: string
  rows: Row[]
}

function toNum(v: unknown): number {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v).trim()
  if (!s) return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function toStr(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

function toExtras(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const kk = String(k ?? '').trim()
    if (!kk) continue
    out[kk] = val
  }
  return out
}

// Columnas fijas de extras (cuando NO vienen dentro de extras/extras_meta)
function fixedExtrasFromRow(r: Record<string, unknown>): Record<string, unknown> {
  const pick = (a: unknown, b: unknown) => (a !== undefined && a !== null ? a : b)

  const fixed: Record<string, unknown> = {
    // KG
    yaramilaKg: pick(r.yaramila_kg, r.yaramilaKg),
    templeFertKg: pick(r.temple_fert_kg, r.templeFertKg),
    templeKg: pick(r.temple_kg, r.templeKg),
    calmaxKg: pick(r.calmax_kg, r.calmaxKg),

    // Litros
    adherenteLit: pick(r.adherente_lit, r.adherenteLit),
    herbicidaLit: pick(r.herbicida_lit, r.herbicidaLit),
    herbosatoLit: pick(r.herbosato_lit, r.herbosatoLit),

    // Unidades
    grapasUni: pick(r.grapas_uni, r.grapasUni),
    papelUni: pick(r.papel_uni, r.papelUni),

    // Otros
    variedad: pick(r.variedad, r.variedad_texto),
    puntos: pick(r.puntos, r.puntos_valor),
  }

  // Limpiamos keys vacíos / null (pero mantenemos 0 si viene explícito)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fixed)) {
    if (v === undefined || v === null || String(k).trim() === '') continue
    out[k] = v
  }
  return out
}

// Normaliza distintos nombres de columnas posibles desde Supabase
function normalizeRow(r: Record<string, unknown>): Row {
  const encargadoCodigo = toStr(r.encargado_codigo ?? r.encargadoCodigo ?? '')
  const laborId = toStr(r.labor_id ?? r.laborId ?? r.codigo_labor ?? r.codigoLabor ?? '')
  const detalleOrigen = toStr(r.detalle_id_origen ?? r.detalle_origen_id ?? r.detalleOrigenId ?? '')

  return {
    id: toStr(r.id ?? r.uuid ?? r.detalle_id ?? crypto.randomUUID()),
    encargado_codigo: encargadoCodigo,
    labor_id: laborId,
    detalle_id_origen: detalleOrigen,

    // En esta etapa solo guardamos lo que venga del row; luego lo resolveremos con catálogos (encargados/labores)
    encargado_nombre: toStr(
      r.encargado_nombre ??
        r.encargado ??
        r.encargadoName ??
        r.encargado_nombre_texto ??
        r.encargado_texto ??
        ''
    ),

    // Guardamos lo que venga; luego lo resolveremos contra la tabla labores
    labor: toStr(r.labor ?? r.labor_texto ?? r.labor_nombre ?? r.laborName ?? ''),

    ha: toNum(r.hectareas ?? r.ha ?? r.ha_real ?? r.ha_avance ?? r.ha_total ?? 0),
    jornales: toNum(r.jornales ?? r.jor_real ?? r.jor_prog ?? r.jor ?? 0),
    cantidad: toNum(r.cantidad ?? r.total_dia ?? r.total ?? 0),
    kg: toNum(r.kilos_kg ?? r.kg ?? r.kilos ?? r.kilos_total ?? 0),

    extras: {
      ...fixedExtrasFromRow(r),
      ...toExtras(r.extras ?? r.extras_meta ?? r.extras_json ?? r.extra ?? {}),
    },

    bloque_id: toStr(r.bloque_id ?? r.bloqueId ?? r.reporte_bloque_id ?? r.reporteBloqueId ?? ''),
    created_at: toStr(r.created_at ?? r.createdAt ?? ''),
    fecha: toStr(r.fecha ?? r.dia ?? r.fecha_registro ?? ''),
    obs: toStr(r.observacion ?? r.obs ?? ''),
  }
}

function ratio(num?: number, den?: number): string {
  const n = toNum(num)
  const d = toNum(den)
  if (d <= 0) return '0.00'
  return (n / d).toFixed(2)
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function escapeCSV(v: unknown): string {
  const s = String(v ?? '')
  // Si tiene comas, comillas o saltos, se encierra entre comillas y se escapan comillas
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function ReporteAvancePage() {
  const [user, setUser] = useState<string>('')
  const [detalles, setDetalles] = useState<DetalleGroup[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [fechaSel, setFechaSel] = useState<string>(() => {
    const d = new Date()
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 10)
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: u } = await supabase.auth.getUser()
      const email = u?.user?.email ?? ''
      setUser(email)

      const { data: rowsRaw, error: errRows } = await supabase
        .from('avance_labor_diario')
        .select('*')
        .eq('fecha', fechaSel)
        .eq('email', email)
        .order('created_at', { ascending: false })

      if (errRows) {
        console.error('[reporte-avance] supabase error avance_labor_diario', errRows)
        setDetalles([])
        setLoading(false)
        return
      }

      const normalized: Row[] = Array.isArray(rowsRaw)
        ? (rowsRaw as Record<string, unknown>[]).map((r0) => normalizeRow(r0))
        : []

      // --- Resolver nombres desde catálogos (sin relaciones FK) ---
      const encCodes = Array.from(
        new Set(
          normalized
            .map((r) => (r.encargado_codigo ?? '').trim())
            .filter((x) => x.length > 0)
        )
      )

      // labor_id puede venir como texto; convertimos a number cuando sea posible (tabla labores.codigo es int)
      const laborCodesNum = Array.from(
        new Set(
          normalized
            .map((r) => (r.labor_id ?? '').trim())
            .map((x) => Number(x))
            .filter((n) => Number.isFinite(n))
        )
      ) as number[]

      const encMap = new Map<string, string>()
      if (encCodes.length > 0) {
        const { data: encData, error: encErr } = await supabase
          .from('encargados')
          .select('codigo,nombres')
          .in('codigo', encCodes)
        if (encErr) console.warn('[reporte-avance] lookup encargados', encErr)
        for (const e of encData ?? []) {
          const c = toStr((e as Record<string, unknown>).codigo)
          const n = toStr((e as Record<string, unknown>).nombres)
          if (c) encMap.set(c, n)
        }
      }

      const laborMap = new Map<string, string>()
      if (laborCodesNum.length > 0) {
        const { data: labData, error: labErr } = await supabase
          .from('labores')
          .select('codigo,nombre')
          .in('codigo', laborCodesNum)
        if (labErr) console.warn('[reporte-avance] lookup labores', labErr)
        for (const l of labData ?? []) {
          const c = toStr((l as Record<string, unknown>).codigo)
          const n = toStr((l as Record<string, unknown>).nombre)
          if (c) laborMap.set(c, n)
        }
      }

      // Aplicamos los nombres resueltos
      const resolved: Row[] = normalized.map((r) => {
        const encCodigo = (r.encargado_codigo ?? '').trim()
        const labCodigo = (r.labor_id ?? '').trim()
        const encNombre = r.encargado_nombre?.trim() ? r.encargado_nombre : encMap.get(encCodigo) ?? ''
        const labNombre = r.labor?.trim() ? r.labor : laborMap.get(labCodigo) ?? ''
        return {
          ...r,
          encargado_nombre: encNombre || (encCodigo ? encCodigo : ''),
          labor: labNombre || (labCodigo ? labCodigo : ''),
        }
      })

      const filtered = resolved.filter((x) => !x.fecha || x.fecha === fechaSel)

      const groupsMap = new Map<string, Row[]>()
      for (const r of filtered) {
        const key =
          (r.detalle_id_origen && r.detalle_id_origen.trim()) ||
          ((r.labor_id || r.labor) + '|' + (r.encargado_codigo || r.encargado_nombre)) ||
          r.id
        const arr = groupsMap.get(key) ?? []
        arr.push(r)
        groupsMap.set(key, arr)
      }

      const groupsSorted = Array.from(groupsMap.entries())
        .map(([id, rows]) => {
          const maxCreated = rows
            .map((x) => (x.created_at ? new Date(x.created_at).getTime() : 0))
            .reduce((a, b) => Math.max(a, b), 0)
          return { id, rows, maxCreated }
        })
        .sort((a, b) => b.maxCreated - a.maxCreated)

      const detallesList: DetalleGroup[] = groupsSorted.map((g, idx) => {
        const encargado = g.rows.find((x) => x.encargado_nombre)?.encargado_nombre ?? ''
        return {
          id: g.id,
          titulo: `Detalle ${idx + 1}`,
          encargado,
          rows: g.rows,
        }
      })

      setDetalles(detallesList)
      setLoading(false)
    }

    load()
  }, [fechaSel])

  const allExtraKeys = useMemo(() => {
    const set = new Set<string>()
    for (const d of detalles) {
      for (const r of d.rows) {
        for (const k of Object.keys(r.extras ?? {})) set.add(k)
      }
    }
    return Array.from(set)
  }, [detalles])

  const onDownloadCSV = () => {
    // Columnas base + extras (flatten)
    const headers = [
      'usuario',
      'created_at',
      'encargado',
      'labor',
      'ha',
      'jornales',
      'cantidad',
      'kg',
      ...allExtraKeys.map((k) => `extra_${k}`),
      'ratio_jornales_ha',
      'ratio_cantidad_ha',
      'ratio_kg_ha',
    ]

    const lines: string[] = []
    lines.push(headers.map(escapeCSV).join(','))

    for (const d of detalles) {
      for (const r of d.rows) {
        const base = [
          user,
          r.created_at ?? '',
          r.encargado_nombre || r.encargado_codigo || '',
          r.labor || r.labor_id || '',
          r.ha,
          r.jornales,
          r.cantidad,
          r.kg,
        ]

        const extras = allExtraKeys.map((k) => (r.extras?.[k] ?? ''))

        const ratios = [ratio(r.jornales, r.ha), ratio(r.cantidad, r.ha), ratio(r.kg, r.ha)]

        lines.push([...base, ...extras, ...ratios].map(escapeCSV).join(','))
      }
    }

    downloadCSV(`reporte-avance_${fechaSel}.csv`, lines.join('\n'))
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">Reporte Avance Diario</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Fecha</span>
          <input
            type="date"
            value={fechaSel}
            onChange={(e) => setFechaSel(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/avance-diario"
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Volver
          </Link>
          <button
            type="button"
            onClick={onDownloadCSV}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Descargar CSV
          </button>
        </div>
      </div>

      {/* Usuario header and "Mostrando registros de:" removed */}

      {loading ? (
        <div className="text-sm text-gray-600">Cargando…</div>
      ) : detalles.length === 0 ? (
        <div className="text-sm text-gray-600">No hay registros para mostrar.</div>
      ) : (
        detalles.map((d) => {
          const haTotal = d.rows.reduce((acc, r) => acc + toNum(r.ha), 0)
          const jorTotal = d.rows.reduce((acc, r) => acc + toNum(r.jornales), 0)
          const cantTotal = d.rows.reduce((acc, r) => acc + toNum(r.cantidad), 0)
          const kgTotal = d.rows.reduce((acc, r) => acc + toNum(r.kg), 0)

          // Average ratios (only rows with ha > 0)
          const rowsWithHa = d.rows.filter((r) => toNum(r.ha) > 0)
          const avgJorHa =
            rowsWithHa.length > 0
              ? (rowsWithHa.reduce((acc, r) => acc + toNum(r.jornales) / toNum(r.ha), 0) / rowsWithHa.length).toFixed(2)
              : '0.00'
          const avgCantHa =
            rowsWithHa.length > 0
              ? (rowsWithHa.reduce((acc, r) => acc + toNum(r.cantidad) / toNum(r.ha), 0) / rowsWithHa.length).toFixed(2)
              : '0.00'
          const avgKgHa =
            rowsWithHa.length > 0
              ? (rowsWithHa.reduce((acc, r) => acc + toNum(r.kg) / toNum(r.ha), 0) / rowsWithHa.length).toFixed(2)
              : '0.00'

          return (
            <div key={d.id} className="mb-8 border rounded p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h2 className="font-semibold">{d.titulo}</h2>
              </div>

              <table className="w-full border text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2">Encargado</th>
                    <th className="border p-2">Labor</th>
                    <th className="border p-2">HA</th>
                    <th className="border p-2">Jornales</th>
                    <th className="border p-2">Cantidad</th>
                    <th className="border p-2">KG</th>
                    <th className="border p-2">Jornales/HA</th>
                    <th className="border p-2">Cantidad/HA</th>
                    <th className="border p-2">KG/HA</th>
                    {allExtraKeys.map((k) => (
                      <th key={k} className="border p-2">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {d.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="border p-2">{r.encargado_nombre || r.encargado_codigo || ''}</td>
                      <td className="border p-2">{r.labor || r.labor_id || ''}</td>
                      <td className="border p-2">{r.ha}</td>
                      <td className="border p-2">{r.jornales}</td>
                      <td className="border p-2">{r.cantidad}</td>
                      <td className="border p-2">{r.kg}</td>
                      <td className="border p-2">{ratio(r.jornales, r.ha)}</td>
                      <td className="border p-2">{ratio(r.cantidad, r.ha)}</td>
                      <td className="border p-2">{ratio(r.kg, r.ha)}</td>
                      {allExtraKeys.map((k) => (
                        <td key={k} className="border p-2">{String(r.extras?.[k] ?? '')}</td>
                      ))}
                    </tr>
                  ))}

                  <tr className="bg-gray-50 font-medium">
                    <td className="border p-2" colSpan={2}>
                      Totales
                    </td>
                    <td className="border p-2">{haTotal}</td>
                    <td className="border p-2">{jorTotal}</td>
                    <td className="border p-2">{cantTotal}</td>
                    <td className="border p-2">{kgTotal}</td>
                    {/* Promedio SOLO para ratios */}
                    <td className="border p-2">{avgJorHa}</td>
                    <td className="border p-2">{avgCantHa}</td>
                    <td className="border p-2">{avgKgHa}</td>
                    {allExtraKeys.map((k) => {
                      const exTotal = d.rows.reduce((acc, r) => acc + toNum(r.extras?.[k]), 0)
                      // Si todos son no-numéricos, el total quedará 0 (ok).
                      return (
                        <td key={k} className="border p-2">
                          {String(exTotal)}
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </div>
  )
}