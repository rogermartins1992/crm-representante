'use client'

import { useState, useEffect } from 'react'
import { FileText, CheckCircle2, XCircle, Truck, Package, AlertTriangle } from 'lucide-react'
import { getDanfesPendentes, getPedidos } from '@/lib/db'
import type { DanfePendente, Pedido } from '@/lib/supabase'
import StatusBadge from '@/components/StatusBadge'
import { formatCnpj } from '@/lib/format'
import { format, parseISO } from 'date-fns'

const fmtDate = (d?: string | null) => (d ? format(parseISO(d), 'dd/MM/yyyy') : '—')
const fmtMoeda = (v?: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function DanfeCard({ danfe, pedidos, onConfirmar, onRejeitar }: {
  danfe: DanfePendente
  pedidos: Pedido[]
  onConfirmar: (id: string, pedidoId?: string) => Promise<void>
  onRejeitar: (id: string) => Promise<void>
}) {
  const [pedidoEscolhido, setPedidoEscolhido] = useState(danfe.pedido_sugerido_id ?? '')
  const [acting, setActing] = useState(false)
  const pendente = danfe.status === 'aguardando_confirmacao'
  const temSugestao = !!danfe.pedido_sugerido_id

  async function confirmar() {
    if (!pedidoEscolhido) return
    setActing(true)
    try { await onConfirmar(danfe.id, pedidoEscolhido) } finally { setActing(false) }
  }

  async function rejeitar() {
    setActing(true)
    try { await onRejeitar(danfe.id) } finally { setActing(false) }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-blue-700">NF {danfe.nf_numero || '—'}</span>
            <StatusBadge status={danfe.status} />
            {!temSugestao && pendente && (
              <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-medium">
                <AlertTriangle size={11} /> Sem pedido sugerido
              </span>
            )}
          </div>

          <p className="font-semibold text-gray-800 mt-1.5">{danfe.razao_social || '—'}</p>
          <p className="text-xs text-gray-500">CNPJ: {danfe.cnpj ? formatCnpj(danfe.cnpj) : '—'}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-gray-500">
            {danfe.transportadora && (
              <span className="flex items-center gap-1">
                <Truck size={11} className="text-gray-400" /> {danfe.transportadora}
              </span>
            )}
            <span className="font-mono">{danfe.nf_chave_acesso || 'Chave de acesso não extraída'}</span>
            <span>Emissão: {fmtDate(danfe.nf_data_emissao)}</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-gray-900">{fmtMoeda(danfe.valor_total)}</p>
        </div>
      </div>

      {pendente && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Package size={13} />
            <span>Pedido:</span>
          </div>
          <select
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={pedidoEscolhido}
            onChange={e => setPedidoEscolhido(e.target.value)}
          >
            <option value="">— Selecione o pedido —</option>
            {pedidos.map(p => (
              <option key={p.id} value={p.id}>
                {p.numero} — {p.clientes?.empresa ?? 'Cliente desconhecido'}
              </option>
            ))}
          </select>
          <button
            onClick={confirmar}
            disabled={!pedidoEscolhido || acting}
            className="flex items-center gap-1.5 text-sm bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={14} /> Confirmar
          </button>
          <button
            onClick={rejeitar}
            disabled={acting}
            className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle size={14} /> Rejeitar
          </button>
        </div>
      )}

      {!pendente && danfe.pedidos && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          Vinculado ao pedido <span className="font-mono font-medium text-gray-700">{danfe.pedidos.numero}</span>
        </div>
      )}
    </div>
  )
}

export default function DanfesPendentesPage() {
  const [danfes, setDanfes] = useState<DanfePendente[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [filtro, setFiltro] = useState<'aguardando_confirmacao' | 'todos'>('aguardando_confirmacao')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    Promise.all([getDanfesPendentes(), getPedidos()]).then(([d, p]) => {
      setDanfes(d)
      setPedidos(p.filter(pd => pd.status !== 'cancelado'))
      setLoading(false)
    })
  }, [])

  async function confirmar(id: string, pedidoId?: string) {
    setErro('')
    const res = await fetch(`/api/danfes-pendentes/${id}/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      setErro(data.error || 'Erro ao confirmar a DANFE.')
      return
    }
    setDanfes(prev => prev.map(d => d.id === id ? data.danfe : d))
  }

  async function rejeitar(id: string) {
    setErro('')
    const res = await fetch(`/api/danfes-pendentes/${id}/rejeitar`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok || data.error) {
      setErro(data.error || 'Erro ao rejeitar a DANFE.')
      return
    }
    setDanfes(prev => prev.map(d => d.id === id ? { ...d, status: 'rejeitada' } : d))
  }

  const filtradas = danfes.filter(d => filtro === 'todos' || d.status === filtro)
  const pendentesCount = danfes.filter(d => d.status === 'aguardando_confirmacao').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">DANFEs Pendentes</h2>
        <p className="text-gray-500 text-sm mt-1">
          {pendentesCount} aguardando confirmação · {danfes.length} no total
        </p>
      </div>

      <div className="flex gap-0.5 border-b border-gray-200">
        {[
          { key: 'aguardando_confirmacao' as const, label: 'Aguardando Confirmação' },
          { key: 'todos' as const, label: 'Todas' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setFiltro(t.key)}
            className={`pb-3 px-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
              ${filtro === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erro}</div>
      )}

      <div className="space-y-3">
        {filtradas.map(d => (
          <DanfeCard key={d.id} danfe={d} pedidos={pedidos} onConfirmar={confirmar} onRejeitar={rejeitar} />
        ))}
        {filtradas.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <FileText size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhuma DANFE encontrada</p>
          </div>
        )}
      </div>
    </div>
  )
}
