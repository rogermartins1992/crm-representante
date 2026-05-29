'use client'

import { Target } from 'lucide-react'

interface Props {
  meta: number
  realizado: number
  mes: number
  ano: number
}

const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function MetaProgress({ meta, realizado, mes, ano }: Props) {
  const pct = meta > 0 ? Math.min((realizado / meta) * 100, 100) : 0
  const falta = Math.max(meta - realizado, 0)

  const cor =
    pct >= 100 ? 'bg-green-500' :
    pct >= 70  ? 'bg-blue-500' :
    pct >= 40  ? 'bg-yellow-500' :
                 'bg-red-500'

  const corTexto =
    pct >= 100 ? 'text-green-600' :
    pct >= 70  ? 'text-blue-600' :
    pct >= 40  ? 'text-yellow-600' :
                 'text-red-600'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target size={20} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800">
            Meta {meses[mes - 1]}/{ano}
          </h3>
        </div>
        <span className={`text-2xl font-bold ${corTexto}`}>
          {pct.toFixed(0)}%
        </span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-4 mb-4">
        <div
          className={`h-4 rounded-full transition-all duration-500 ${cor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-gray-500 mb-1">Meta</p>
          <p className="font-bold text-gray-800">
            R$ {meta.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Realizado</p>
          <p className={`font-bold ${corTexto}`}>
            R$ {realizado.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Falta</p>
          <p className="font-bold text-gray-700">
            R$ {falta.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>
    </div>
  )
}
