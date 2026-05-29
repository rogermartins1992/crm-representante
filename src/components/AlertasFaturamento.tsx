'use client'

import { AlertTriangle } from 'lucide-react'
import type { Pedido } from '@/lib/supabase'
import { differenceInDays, parseISO } from 'date-fns'
import Link from 'next/link'

interface Props {
  pedidos: Pedido[]
}

export default function AlertasFaturamento({ pedidos }: Props) {
  const hoje = new Date()

  const alertas = pedidos.filter(p => {
    if (!['aprovado', 'em_producao'].includes(p.status)) return false
    const diasDesde = differenceInDays(hoje, parseISO(p.data_pedido))
    return diasDesde >= 4 && !p.lembrete_faturamento_enviado
  })

  if (alertas.length === 0) return null

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={18} className="text-orange-600" />
        <h3 className="font-semibold text-orange-800">
          Lembretes de Faturamento ({alertas.length})
        </h3>
      </div>
      <div className="space-y-2">
        {alertas.map(p => {
          const dias = differenceInDays(hoje, parseISO(p.data_pedido))
          return (
            <Link
              key={p.id}
              href={`/pedidos/${p.id}`}
              className="flex items-center justify-between bg-white border border-orange-100 rounded-lg px-3 py-2 hover:border-orange-300 transition-colors"
            >
              <div>
                <span className="font-medium text-sm text-gray-800">{p.numero}</span>
                <span className="text-gray-500 text-xs ml-2">— {p.clientes?.empresa}</span>
              </div>
              <div className="text-right">
                <span className="text-orange-600 font-semibold text-sm">
                  {dias} dias sem faturar
                </span>
                <div className="text-gray-500 text-xs">
                  R$ {p.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
