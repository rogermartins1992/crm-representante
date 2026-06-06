'use client'

import { useState, useEffect } from 'react'
import {
  Plus, ShoppingCart, X, AlertTriangle, Bell, CheckCircle2,
  Package, Clock, Trash2,
} from 'lucide-react'
import {
  getPedidos, createPedido, updatePedidoStatus, marcarLembreteEnviado,
  getClientes, getItensPedido, createItensPedido,
  getHistoricoPedido, addHistoricoPedido,
} from '@/lib/db'
import type { Pedido, Cliente, ItemPedido, HistoricoPedido } from '@/lib/supabase'
import StatusBadge from '@/components/StatusBadge'
import { format, parseISO, differenceInDays } from 'date-fns'

const STATUS_FLOW: Pedido['status'][] = ['pendente', 'aprovado', 'em_producao', 'faturado', 'entregue']

const STATUS_ACTION: Record<string, string> = {
  pendente: 'Confirmar Pedido',
  aprovado: 'Iniciar Produção',
  em_producao: 'Faturar',
  faturado: 'Marcar Entregue',
}

const STATUS_HISTORICO: Record<string, string> = {
  aprovado: 'Pedido confirmado',
  em_producao: 'Produção iniciada',
  faturado: 'Pedido faturado',
  entregue: 'Pedido entregue',
}

type ItemForm = { _key: string; produto: string; quantidade: number; preco_unitario: number }
function mkItem(): ItemForm {
  return { _key: Math.random().toString(36).slice(2), produto: '', quantidade: 1, preco_unitario: 0 }
}

// ─── Modal Novo Pedido ────────────────────────────────────────────────────────

function ModalNovoPedido({ onClose, onSave, clientes }: {
  onClose: () => void
  onSave: (
    p: Omit<Pedido, 'id' | 'created_at' | 'updated_at' | 'clientes' | 'itens_pedido'>,
    items: Omit<ItemForm, '_key'>[]
  ) => Promise<void>
  clientes: Cliente[]
}) {
  const [cliente_id, setClienteId] = useState('')
  const [data_pedido, setDataPedido] = useState(new Date().toISOString().split('T')[0])
  const [data_entrega_prevista, setDataEntrega] = useState('')
  const [observacoes, setObs] = useState('')
  const [items, setItems] = useState<ItemForm[]>([mkItem()])
  const [saving, setSaving] = useState(false)
  const [numero, setNumero] = useState(`PED-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`)
  const total = items.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const validItems = items.filter(i => i.produto.trim() && i.preco_unitario > 0)
  const canSave = !!cliente_id && validItems.length > 0

  function updItem(key: string, k: 'produto' | 'quantidade' | 'preco_unitario', v: string | number) {
    setItems(prev => prev.map(i => i._key === key ? { ...i, [k]: v } : i))
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        cliente_id,
        numero,
        data_pedido,
        valor_total: total,
        status: 'pendente',
        data_entrega_prevista: data_entrega_prevista || undefined,
        observacoes: observacoes || undefined,
        lembrete_faturamento_enviado: false,
      }, validItems.map(({ _key: _k, ...rest }) => rest))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold">Novo Pedido</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={cliente_id}
                onChange={e => setClienteId(e.target.value)}
              >
                <option value="">Selecione o cliente...</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.empresa} — {c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input
                value={numero}
                onChange={e => setNumero(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data do Pedido *</label>
              <input
                type="date"
                value={data_pedido}
                onChange={e => setDataPedido(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Entrega Prevista</label>
              <input
                type="date"
                value={data_entrega_prevista}
                onChange={e => setDataEntrega(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Itens *</label>
              <button
                onClick={() => setItems(p => [...p, mkItem()])}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
              >
                <Plus size={13} /> Adicionar item
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 font-medium">
                  <tr>
                    <th className="text-left px-3 py-2">Descrição</th>
                    <th className="text-center px-3 py-2 w-16">Qtd</th>
                    <th className="text-right px-3 py-2 w-28">Vl. Unit. (R$)</th>
                    <th className="text-right px-3 py-2 w-28">Subtotal</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(it => (
                    <tr key={it._key}>
                      <td className="px-3 py-2">
                        <input
                          className="w-full outline-none text-sm placeholder:text-gray-300 focus:bg-blue-50 rounded px-1 -mx-1 transition-colors"
                          placeholder="Ex: Capacete CA-12345"
                          value={it.produto}
                          onChange={e => updItem(it._key, 'produto', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          className="w-full outline-none text-center text-sm focus:bg-blue-50 rounded px-1 -mx-1 transition-colors"
                          value={it.quantidade}
                          onChange={e => updItem(it._key, 'quantidade', Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full outline-none text-right text-sm focus:bg-blue-50 rounded px-1 -mx-1 transition-colors"
                          placeholder="0,00"
                          value={it.preco_unitario || ''}
                          onChange={e => updItem(it._key, 'preco_unitario', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 font-medium">
                        {(it.quantidade * it.preco_unitario).toLocaleString('pt-BR', {
                          style: 'currency', currency: 'BRL',
                        })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {items.length > 1 && (
                          <button onClick={() => setItems(p => p.filter(i => i._key !== it._key))}>
                            <Trash2 size={13} className="text-gray-300 hover:text-red-400 transition-colors" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Total</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">
                      {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              value={observacoes}
              onChange={e => setObs(e.target.value)}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white p-6 border-t border-gray-100 flex gap-3 justify-end z-10">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!canSave || saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar Pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Detalhe do Pedido ──────────────────────────────────────────────────

function ModalDetalhe({ pedido, onClose, onAvancar, onLembrete }: {
  pedido: Pedido
  onClose: () => void
  onAvancar: (id: string, statusAtual: Pedido['status']) => Promise<void>
  onLembrete: (id: string) => Promise<void>
}) {
  const [items, setItems] = useState<ItemPedido[]>([])
  const [historico, setHistorico] = useState<HistoricoPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [advancing, setAdvancing] = useState(false)

  useEffect(() => {
    Promise.all([
      getItensPedido(pedido.id),
      getHistoricoPedido(pedido.id).catch(() => [] as HistoricoPedido[]),
    ]).then(([its, hist]) => {
      setItems(its)
      setHistorico(hist)
      setLoading(false)
    })
  }, [pedido.id])

  const idx = STATUS_FLOW.indexOf(pedido.status as Pedido['status'])
  const canAdvance = idx >= 0 && idx < STATUS_FLOW.length - 1 && pedido.status !== 'cancelado'
  const hoje = new Date()
  const dias = differenceInDays(hoje, parseISO(pedido.data_pedido))
  const alertaFaturamento = ['aprovado', 'em_producao'].includes(pedido.status) && dias >= 4 && !pedido.lembrete_faturamento_enviado

  async function handleAvancar() {
    setAdvancing(true)
    await onAvancar(pedido.id, pedido.status as Pedido['status'])
    setAdvancing(false)
    onClose()
  }

  const itemsTotal = items.reduce((s, i) => s + i.subtotal, 0)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex items-start justify-between z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-blue-700">{pedido.numero}</span>
              <StatusBadge status={pedido.status} />
              {alertaFaturamento && (
                <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-medium">
                  <AlertTriangle size={11} /> {dias}d sem faturar
                </span>
              )}
            </div>
            <p className="font-semibold text-gray-800 mt-1">{pedido.clientes?.empresa}</p>
            <p className="text-sm text-gray-500">{pedido.clientes?.nome}</p>
          </div>
          <button onClick={onClose} className="mt-1">
            <X size={20} className="text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Pedido em</p>
              <p className="font-semibold text-sm text-gray-800 mt-0.5">
                {format(parseISO(pedido.data_pedido), 'dd/MM/yyyy')}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">
                {pedido.data_faturamento ? 'Faturado em' : pedido.data_entrega_prevista ? 'Entrega prev.' : 'Status'}
              </p>
              <p className="font-semibold text-sm text-gray-800 mt-0.5">
                {pedido.data_faturamento
                  ? format(parseISO(pedido.data_faturamento), 'dd/MM/yyyy')
                  : pedido.data_entrega_prevista
                  ? format(parseISO(pedido.data_entrega_prevista), 'dd/MM/yyyy')
                  : '—'}
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600">Valor Total</p>
              <p className="font-bold text-sm text-blue-700 mt-0.5">
                {pedido.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          {/* Itens */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package size={15} className="text-gray-500" /> Itens do Pedido
            </h4>
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum item cadastrado</p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 font-medium">
                    <tr>
                      <th className="text-left px-3 py-2">Produto</th>
                      <th className="text-center px-3 py-2 w-14">Qtd</th>
                      <th className="text-right px-3 py-2 w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map(i => (
                      <tr key={i.id}>
                        <td className="px-3 py-2 text-gray-800">{i.produto}</td>
                        <td className="px-3 py-2 text-center text-gray-600">{i.quantidade}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-700">
                          {i.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {items.length > 1 && (
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td colSpan={2} className="px-3 py-2 text-right text-sm font-semibold text-gray-700">Total</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">
                          {itemsTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>

          {/* Observações */}
          {pedido.observacoes && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-xs text-amber-600 font-medium mb-1">Observações</p>
              <p className="text-sm text-gray-700">{pedido.observacoes}</p>
            </div>
          )}

          {/* Histórico */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock size={15} className="text-gray-500" /> Histórico
            </h4>
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : historico.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum histórico registrado</p>
            ) : (
              <ol className="space-y-0">
                {historico.map((h, i) => (
                  <li key={h.id} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0 mt-1" />
                      {i < historico.length - 1 && (
                        <span className="w-px flex-1 bg-gray-200 mt-1 min-h-[16px]" />
                      )}
                    </div>
                    <div className="pb-3">
                      <p className="text-gray-700">{h.descricao}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {format(parseISO(h.created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Footer */}
        {(canAdvance || alertaFaturamento || pedido.lembrete_faturamento_enviado) && (
          <div className="sticky bottom-0 bg-white p-4 border-t border-gray-100 flex flex-wrap gap-2 justify-end z-10">
            {pedido.lembrete_faturamento_enviado && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 px-3 py-2">
                <CheckCircle2 size={14} /> Lembrete enviado
              </span>
            )}
            {alertaFaturamento && !pedido.lembrete_faturamento_enviado && (
              <button
                onClick={async () => { await onLembrete(pedido.id); onClose() }}
                className="flex items-center gap-1.5 text-sm text-orange-600 border border-orange-200 rounded-lg px-3 py-2 hover:bg-orange-50"
              >
                <Bell size={14} /> Marcar lembrete enviado
              </button>
            )}
            {canAdvance && (
              <button
                onClick={handleAvancar}
                disabled={advancing}
                className="flex items-center gap-1.5 text-sm bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {STATUS_ACTION[pedido.status] ?? 'Avançar'} →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtro, setFiltro] = useState('todos')
  const [showModal, setShowModal] = useState(false)
  const [pedidoAberto, setPedidoAberto] = useState<Pedido | null>(null)
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

  async function salvar(
    form: Omit<Pedido, 'id' | 'created_at' | 'updated_at' | 'clientes' | 'itens_pedido'>,
    itemForms: { produto: string; quantidade: number; preco_unitario: number }[]
  ) {
    const cliente = clientes.find(c => c.id === form.cliente_id)
    const novo = await createPedido(form)
    if (itemForms.length > 0) {
      await createItensPedido(itemForms.map(i => ({ pedido_id: novo.id, ...i })))
    }
    try { await addHistoricoPedido(novo.id, 'Pedido criado') } catch { /* tabela pode não existir ainda */ }
    setPedidos(prev => [{ ...novo, clientes: cliente }, ...prev])
  }

  async function avancar(id: string, statusAtual: Pedido['status']) {
    const idx = STATUS_FLOW.indexOf(statusAtual)
    const next = STATUS_FLOW[idx + 1]
    if (!next) return
    await updatePedidoStatus(id, next)
    const data_faturamento = next === 'faturado' ? new Date().toISOString().split('T')[0] : undefined
    try {
      await addHistoricoPedido(id, STATUS_HISTORICO[next] ?? `Status: ${next}`, statusAtual, next)
    } catch { /* tabela pode não existir ainda */ }
    setPedidos(prev => prev.map(p =>
      p.id === id ? { ...p, status: next, ...(data_faturamento ? { data_faturamento } : {}) } : p
    ))
  }

  async function lembrete(id: string) {
    await marcarLembreteEnviado(id)
    try { await addHistoricoPedido(id, 'Lembrete de faturamento enviado') } catch { /* tabela pode não existir ainda */ }
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, lembrete_faturamento_enviado: true } : p))
  }

  const tabs = [
    { key: 'todos',       label: 'Todos' },
    { key: 'pendente',    label: 'Ag. Confirmação' },
    { key: 'aprovado',    label: 'Confirmado' },
    { key: 'em_producao', label: 'Em Produção' },
    { key: 'faturado',    label: 'Faturado' },
    { key: 'entregue',    label: 'Entregue' },
    { key: 'cancelado',   label: 'Cancelado' },
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
            {filtrados.length} pedido{filtrados.length !== 1 ? 's' : ''} · {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} /> Novo Pedido
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-gray-200">
        {tabs.map(t => {
          const count = t.key === 'todos' ? pedidos.length : pedidos.filter(p => p.status === t.key).length
          return (
            <button
              key={t.key}
              onClick={() => setFiltro(t.key)}
              className={`pb-3 px-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5
                ${filtro === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 tabular-nums
                ${filtro === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {filtrados.map(p => {
          const dias = differenceInDays(hoje, parseISO(p.data_pedido))
          const alertaFaturamento = ['aprovado', 'em_producao'].includes(p.status) && dias >= 4 && !p.lembrete_faturamento_enviado

          return (
            <div
              key={p.id}
              onClick={() => setPedidoAberto(p)}
              className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all group
                ${alertaFaturamento ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-blue-700">{p.numero}</span>
                    <StatusBadge status={p.status} />
                    {alertaFaturamento && (
                      <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-medium">
                        <AlertTriangle size={11} /> {dias}d sem faturar
                      </span>
                    )}
                    {p.lembrete_faturamento_enviado && (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={11} /> Lembrete enviado
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-800 mt-1">{p.clientes?.empresa}</p>
                  <p className="text-xs text-gray-500">{p.clientes?.nome}</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                    <span>Pedido: {format(parseISO(p.data_pedido), 'dd/MM/yyyy')}</span>
                    {p.data_entrega_prevista && (
                      <span>Entrega: {format(parseISO(p.data_entrega_prevista), 'dd/MM/yyyy')}</span>
                    )}
                    {p.data_faturamento && (
                      <span>Faturado: {format(parseISO(p.data_faturamento), 'dd/MM/yyyy')}</span>
                    )}
                  </div>
                  {p.observacoes && (
                    <p className="text-xs text-gray-400 mt-1 italic truncate max-w-xs">{p.observacoes}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {p.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 group-hover:text-blue-500 transition-colors">
                    ver detalhes →
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        {filtrados.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum pedido encontrado</p>
          </div>
        )}
      </div>

      {showModal && (
        <ModalNovoPedido
          onClose={() => setShowModal(false)}
          onSave={salvar}
          clientes={clientes}
        />
      )}
      {pedidoAberto && (
        <ModalDetalhe
          pedido={pedidoAberto}
          onClose={() => setPedidoAberto(null)}
          onAvancar={avancar}
          onLembrete={lembrete}
        />
      )}
    </div>
  )
}
