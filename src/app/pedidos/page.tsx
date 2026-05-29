'use client'

import { useState, useEffect } from 'react'
import { Plus, ShoppingCart, X, AlertTriangle, Bell, CheckCircle2 } from 'lucide-react'
import { getPedidos, createPedido, updatePedidoStatus, marcarLembreteEnviado, getClientes } from '@/lib/db'
import type { Pedido, Cliente } from '@/lib/supabase'
import StatusBadge from '@/components/StatusBadge'
import { format, parseISO, differenceInDays } from 'date-fns'

const STATUS_FLOW: Pedido['status'][] = ['pendente', 'aprovado', 'em_producao', 'faturado', 'entregue']

function PedidoModal({ onClose, onSave, clientes }: {
  onClose: () => void
  onSave: (p: Partial<Pedido> & { numero: string }) => void
  clientes: Cliente[]
}) {
  const [form, setForm] = useState<Partial<Pedido>>({
    status: 'pendente',
    data_pedido: new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)

  const numero = `PED-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`

  function set(k: keyof Pedido, v: string | number) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.cliente_id || !form.valor_total) return
    setSaving(true)
    await onSave({ ...form, numero } as Partial<Pedido> & { numero: string })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Novo Pedido</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.cliente_id || ''}
              onChange={e => set('cliente_id', e.target.value)}
            >
              <option value="">Selecione o cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.empresa} — {c.nome}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input readOnly className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" value={numero} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data do Pedido *</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.data_pedido || ''}
                onChange={e => set('data_pedido', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total (R$) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
                value={form.valor_total || ''}
                onChange={e => set('valor_total', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entrega Prevista</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.data_entrega_prevista || ''}
                onChange={e => set('data_entrega_prevista', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.status}
              onChange={e => set('status', e.target.value)}
            >
              {STATUS_FLOW.map(s => (
                <option key={s} value={s}>
                  {s === 'em_producao' ? 'Em Produção' : s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={form.observacoes || ''}
              onChange={e => set('observacoes', e.target.value)}
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!form.cliente_id || !form.valor_total || saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar Pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtro, setFiltro] = useState('todos')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getPedidos(), getClientes()]).then(([p, c]) => {
      setPedidos(p)
      setClientes(c)
      setLoading(false)
    })
  }, [])

  const hoje = new Date()

  const filtrados = pedidos
    .filter(p => filtro === 'todos' || p.status === filtro)
    .sort((a, b) => b.data_pedido.localeCompare(a.data_pedido))

  async function salvar(form: Partial<Pedido> & { numero: string }) {
    const cliente = clientes.find(c => c.id === form.cliente_id)
    const novo = await createPedido({
      cliente_id: form.cliente_id!,
      numero: form.numero,
      data_pedido: form.data_pedido || new Date().toISOString().split('T')[0],
      valor_total: form.valor_total || 0,
      status: form.status || 'pendente',
      data_entrega_prevista: form.data_entrega_prevista,
      observacoes: form.observacoes,
      lembrete_faturamento_enviado: false,
    })
    if (novo) setPedidos(prev => [{ ...novo, clientes: cliente }, ...prev])
  }

  async function avancar(id: string, statusAtual: Pedido['status']) {
    const idx = STATUS_FLOW.indexOf(statusAtual)
    const next = STATUS_FLOW[idx + 1]
    if (!next) return
    const ok = await updatePedidoStatus(id, next)
    if (ok) setPedidos(prev => prev.map(p => p.id === id ? { ...p, status: next } : p))
  }

  async function lembrete(id: string) {
    const ok = await marcarLembreteEnviado(id)
    if (ok) setPedidos(prev => prev.map(p => p.id === id ? { ...p, lembrete_faturamento_enviado: true } : p))
  }

  const tabCounts: Record<string, number> = {
    todos: pedidos.length,
    pendente: pedidos.filter(p => p.status === 'pendente').length,
    aprovado: pedidos.filter(p => p.status === 'aprovado').length,
    em_producao: pedidos.filter(p => p.status === 'em_producao').length,
    faturado: pedidos.filter(p => p.status === 'faturado').length,
    entregue: pedidos.filter(p => p.status === 'entregue').length,
  }

  const tabs = [
    { key: 'todos', label: 'Todos' },
    { key: 'pendente', label: 'Pendente' },
    { key: 'aprovado', label: 'Aprovado' },
    { key: 'em_producao', label: 'Em Produção' },
    { key: 'faturado', label: 'Faturado' },
    { key: 'entregue', label: 'Entregue' },
  ]

  const valorTotal = filtrados.reduce((s, p) => s + p.valor_total, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pedidos</h2>
          <p className="text-gray-500 text-sm mt-1">
            {filtrados.length} pedido{filtrados.length !== 1 ? 's' : ''} —
            R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} />
          Novo Pedido
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFiltro(t.key)}
            className={`pb-3 px-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
              ${filtro === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label} ({tabCounts[t.key] || 0})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtrados.map(p => {
          const dias = differenceInDays(hoje, parseISO(p.data_pedido))
          const alertaFaturamento = ['aprovado', 'em_producao'].includes(p.status) && dias >= 4 && !p.lembrete_faturamento_enviado
          const canAdvance = STATUS_FLOW.includes(p.status as Pedido['status']) && p.status !== 'entregue'

          return (
            <div
              key={p.id}
              className={`bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow
                ${alertaFaturamento ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-blue-700">{p.numero}</span>
                    <StatusBadge status={p.status} />
                    {alertaFaturamento && (
                      <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-medium">
                        <AlertTriangle size={11} />
                        {dias}d sem faturar
                      </span>
                    )}
                    {p.lembrete_faturamento_enviado && (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={11} />
                        Lembrete enviado
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-800 mt-1">{p.clientes?.empresa}</p>
                  <p className="text-xs text-gray-500">{p.clientes?.nome}</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                    <span>Pedido: {format(parseISO(p.data_pedido), 'dd/MM/yyyy')}</span>
                    {p.data_entrega_prevista && (
                      <span>Entrega: {format(parseISO(p.data_entrega_prevista), 'dd/MM/yyyy')}</span>
                    )}
                    {p.data_faturamento && (
                      <span>Faturado: {format(parseISO(p.data_faturamento), 'dd/MM/yyyy')}</span>
                    )}
                  </div>
                  {p.observacoes && <p className="text-xs text-gray-400 mt-1 italic">{p.observacoes}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold text-gray-900">
                    R$ {p.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="flex flex-col gap-1.5 mt-2">
                    {canAdvance && (
                      <button
                        onClick={() => avancar(p.id, p.status as Pedido['status'])}
                        className="text-xs text-blue-600 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50 whitespace-nowrap"
                      >
                        Avançar →
                      </button>
                    )}
                    {alertaFaturamento && (
                      <button
                        onClick={() => lembrete(p.id)}
                        className="text-xs text-orange-600 border border-orange-200 rounded-lg px-2 py-1 hover:bg-orange-50 flex items-center gap-1 justify-center"
                      >
                        <Bell size={11} />
                        Lembrete OK
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {filtrados.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-40" />
            <p>Nenhum pedido encontrado</p>
          </div>
        )}
      </div>

      {showModal && (
        <PedidoModal
          onClose={() => setShowModal(false)}
          onSave={salvar}
          clientes={clientes}
        />
      )}
    </div>
  )
}
