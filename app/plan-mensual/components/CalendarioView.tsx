'use client'

import { colorByGrupo, fmt2 } from '../utils/planUtils'

type Item = { codigo: number; nombre: string; grupo: string; jornales: number; ha: number }

type Props = {
  anio: number
  mes: number
  weeks: Array<Array<{ ymd: string | null; day: number | null }>>
  today: string
  resumenDia: Map<string, { count: number; items: Item[] }>
  totalesDia: Map<string, { ha: number; jornales: number }>
  scrollToFecha: (ymd: string) => void
}

export default function CalendarioView({ weeks, today, resumenDia, totalesDia, scrollToFecha }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 shadow-sm bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-base font-bold text-gray-800">Calendario (Lun–Dom)</div>
          <div className="text-xs text-gray-500 mt-1">
            Click en un día para ir a editarlo · Hoy: <b className="text-gray-800">{today}</b>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm bg-green-100 border border-green-200" />
            Hoy resaltado
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-auto">
        <div className="min-w-[980px]">
          <div className="grid grid-cols-7 border border-gray-200 rounded-t-lg overflow-hidden bg-gray-50">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="px-3 py-2 text-sm font-semibold text-gray-700 border-r last:border-r-0 border-gray-200">
                {d}
              </div>
            ))}
          </div>

          <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
            {weeks.map((w, idx) => (
              <div key={idx} className="grid grid-cols-7">
                {w.map((cell, j) => {
                  const ymd = cell.ymd
                  const isToday = ymd && ymd === today
                  const sum = ymd ? resumenDia.get(ymd) : undefined
                  const tot = ymd ? totalesDia.get(ymd) : undefined

                  return (
                    <div
                      key={j}
                      className={`min-h-[130px] border-t border-r last:border-r-0 border-gray-200 p-2 ${isToday ? 'bg-green-50' : 'bg-white'}`}
                    >
                      {ymd ? (
                        <button className="w-full text-left h-full" onClick={() => scrollToFecha(ymd)} title="Ir a editar este día">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col">
                              <div className={`text-sm font-bold ${isToday ? 'text-green-800' : 'text-gray-800'}`}>{cell.day}</div>

                              <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-600">
                                <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200">
                                  HA: <b className="text-gray-800">{fmt2(tot?.ha ?? 0)}</b>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200">
                                  J: <b className="text-gray-800">{fmt2(tot?.jornales ?? 0)}</b>
                                </span>
                              </div>
                            </div>

                            <div className="text-[11px] text-gray-500">{sum?.count ? `${sum.count} lab.` : ''}</div>
                          </div>

                          <div className="mt-2 space-y-1">
                            {(sum?.items ?? []).slice(0, 3).map((it, k) => (
                              <div
                                key={`${it.codigo}-${k}`}
                                className={`text-[11px] border rounded px-2 py-1 truncate ${colorByGrupo(it.grupo)}`}
                                title={`${it.codigo} - ${it.nombre}`}
                              >
                                <span className="font-semibold">{it.codigo}</span> {it.nombre}
                              </div>
                            ))}

                            {sum?.items && sum.items.length > 3 ? <div className="text-[11px] text-gray-500">+ {sum.items.length - 3} más…</div> : null}

                            {(!sum?.items || sum.items.length === 0) && ((tot?.ha ?? 0) > 0 || (tot?.jornales ?? 0) > 0) ? (
                              <div className="text-[11px] text-gray-500 italic">Sin labor seleccionada</div>
                            ) : null}
                          </div>
                        </button>
                      ) : (
                        <div className="h-full" />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        * Se muestra el total de <b>HA</b> y <b>Jornales</b> por día. Los colores se basan en <b>grupo</b>.
      </div>
    </div>
  )
}
