'use client'

import { useState, useEffect } from 'react'
import {
  Plus, ShoppingCart, X, AlertTriangle, Bell, CheckCircle2, XCircle,
  Package, Clock, Trash2, Pencil, Save, Truck, FileText, Upload, Download,
} from 'lucide-react'
import {
  getPedidos, createPedido, updatePedidoStatus, marcarLembreteEnviado,
  getClientes, getItensPedido, createItensPedido,
  getHistoricoPedido, addHistoricoPedido, updatePedido, getDanfesAguardando,
} from '@/lib/db'
import type { Pedido, Cliente, ItemPedido, HistoricoPedido, DanfePendente } from '@/lib/supabase'
import StatusBadge from '@/components/StatusBadge'
import { formatCnpj, normalizeCnpj } from '@/lib/format'
import { format, parseISO, differenceInDays } from 'date-fns'

// ─── Status Delta Plus ────────────────────────────────────────────────────────

type StatusDelta = NonNullable<Pedido['status_delta']>

const DELTA_CFG: Record<StatusDelta, { label: string; bg: string; text: string; border: string; dot: string }> = {
  aguardando: { label: 'Aguardando', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', dot: 'bg-yellow-400' },
  confirmado:  { label: 'Confirmado', bg: 'bg-green-100',  text: 'text-green-700',  border: 'border-green-300',  dot: 'bg-green-500'  },
  atrasado:    { label: 'Atrasado',   bg: 'bg-red-100',    text: 'text-red-700',    border: 'border-red-300',    dot: 'bg-red-500'    },
  faturado:    { label: 'Faturado',   bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   dot: 'bg-blue-500'   },
}

function StatusDeltaBadge({ status }: { status?: StatusDelta | null }) {
  if (!status) return null
  const c = DELTA_CFG[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ─── Status flow legado ───────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ItemForm = { _key: string; produto: string; quantidade: number; preco_unitario: number }
const mkItem = (): ItemForm => ({ _key: Math.random().toString(36).slice(2), produto: '', quantidade: 1, preco_unitario: 0 })
const fmtDate = (d?: string | null) => (d ? format(parseISO(d), 'dd/MM/yyyy') : '—')

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const inputSmCls = 'w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ─── Seção Delta Plus (leitura/edição inline) ─────────────────────────────────

function SecaoDeltaPlus({ pedido, onSave }: {
  pedido: Pedido
  onSave: (campos: Partial<Pedido>) => Promise<void>
}) {
  const [edit, setEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    numero_orcamento: pedido.numero_orcamento ?? '',
    transportadora: pedido.transportadora ?? '',
    condicao_pagamento: pedido.condicao_pagamento ?? '',
    status_delta: (pedido.status_delta ?? '') as StatusDelta | '',
    numero_nf: pedido.numero_nf ?? '',
    data_faturamento_prevista: pedido.data_faturamento_prevista ?? '',
    data_faturamento_real: pedido.data_faturamento_real ?? '',
  })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function salvar() {
    setSaving(true)
    try {
      await onSave({
        numero_orcamento: form.numero_orcamento || undefined,
        transportadora: form.transportadora || undefined,
        condicao_pagamento: form.condicao_pagamento || undefined,
        status_delta: (form.status_delta || undefined) as StatusDelta | undefined,
        numero_nf: form.numero_nf || undefined,
        data_faturamento_prevista: form.data_faturamento_prevista || undefined,
        data_faturamento_real: form.data_faturamento_real || undefined,
      })
      setEdit(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-blue-100 bg-blue-50/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
          <span className="text-base">△</span> Dados Delta Plus
        </h4>
        {!edit ? (
          <button
            onClick={() => setEdit(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Pencil size={12} /> Editar
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <button onClick={() => setEdit(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
            <button
              onClick={salvar}
              disabled={saving}
              className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={11} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}
      </div>

      {edit ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nº Orçamento</label>
            <input className={inputSmCls} value={form.numero_orcamento} onChange={e => set('numero_orcamento', e.target.value)} placeholder="ORC-2026-001" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status Delta</label>
            <select className={inputSmCls} value={form.status_delta} onChange={e => set('status_delta', e.target.value as StatusDelta | '')}>
              <option value="">— Selecione —</option>
              <option value="aguardando">🟡 Aguardando</option>
              <option value="confirmado">🟢 Confirmado</option>
              <option value="atrasado">🔴 Atrasado</option>
              <option value="faturado">🔵 Faturado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Transportadora</label>
            <input className={inputSmCls} value={form.transportadora} onChange={e => set('transportadora', e.target.value)} placeholder="Ex: Jadlog" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Condição de Pagamento</label>
            <input className={inputSmCls} value={form.condicao_pagamento} onChange={e => set('condicao_pagamento', e.target.value)} placeholder="Ex: 30/60 DDL" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nº NF</label>
            <input className={inputSmCls} value={form.numero_nf} onChange={e => set('numero_nf', e.target.value)} placeholder="Ex: 000123" />
          </div>
          <div />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fat. Previsto</label>
            <input type="date" className={inputSmCls} value={form.data_faturamento_prevista} onChange={e => set('data_faturamento_prevista', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fat. Real</label>
            <input type="date" className={inputSmCls} value={form.data_faturamento_real} onChange={e => set('data_faturamento_real', e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Row label="Nº Orçamento" value={pedido.numero_orcamento} />
          <div>
            <p className="text-xs text-gray-400">Status Delta</p>
            <div className="mt-0.5"><StatusDeltaBadge status={pedido.status_delta} /></div>
            {!pedido.status_delta && <p className="text-sm text-gray-500 mt-0.5">—</p>}
          </div>
          <Row label="Transportadora" value={pedido.transportadora} />
          <Row label="Condição de Pagamento" value={pedido.condicao_pagamento} />
          <Row label="Nº NF" value={pedido.numero_nf} />
          <div />
          <Row label="Fat. Previsto" value={fmtDate(pedido.data_faturamento_prevista)} />
          <Row label="Fat. Real" value={fmtDate(pedido.data_faturamento_real)} />
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5">{value || '—'}</p>
    </div>
  )
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
  // Delta Plus
  const [numero_orcamento, setNumOrc] = useState('')
  const [transportadora, setTransp] = useState('')
  const [condicao_pagamento, setCondPag] = useState('')
  const [status_delta, setStatusDelta] = useState<StatusDelta | ''>('')
  const [numero_nf, setNumNF] = useState('')
  const [data_faturamento_prevista, setFatPrev] = useState('')
  const [data_faturamento_real, setFatReal] = useState('')

  const total = items.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const validItems = items.filter(i => i.produto.trim() && i.preco_unitario > 0)
  const canSave = !!cliente_id && validItems.length > 0

  function updItem(key: string, k: keyof Omit<ItemForm, '_key'>, v: string | number) {
    setItems(prev => prev.map(i => i._key === key ? { ...i, [k]: v } : i))
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        cliente_id, numero, data_pedido,
        valor_total: total,
        status: 'pendente',
        lembrete_faturamento_enviado: false,
        data_entrega_prevista: data_entrega_prevista || undefined,
        observacoes: observacoes || undefined,
        numero_orcamento: numero_orcamento || undefined,
        transportadora: transportadora || undefined,
        condicao_pagamento: condicao_pagamento || undefined,
        status_delta: (status_delta || undefined) as StatusDelta | undefined,
        numero_nf: numero_nf || undefined,
        data_faturamento_prevista: data_faturamento_prevista || undefined,
        data_faturamento_real: data_faturamento_real || undefined,
      }, validItems.map(({ _key: _, ...rest }) => rest))
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white p-6 border-b border-gray-100 flex items-center justify-between z-10">
          <h3 className="text-lg font-semibold text-gray-900">Novo Pedido</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Campos base */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
              <select className={inputCls} value={cliente_id} onChange={e => setClienteId(e.target.value)}>
                <option value="">Selecione o cliente...</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.empresa} — {c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número do Pedido</label>
              <input className={inputCls} value={numero} onChange={e => setNumero(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data do Pedido *</label>
              <input type="date" className={inputCls} value={data_pedido} onChange={e => setDataPedido(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Entrega Prevista</label>
              <input type="date" className={inputCls} value={data_entrega_prevista} onChange={e => setDataEntrega(e.target.value)} />
            </div>
          </div>

          {/* Campos Delta Plus */}
          <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              <span className="text-base">△</span> Dados Delta Plus
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nº Orçamento</label>
                <input className={inputSmCls} value={numero_orcamento} onChange={e => setNumOrc(e.target.value)} placeholder="ORC-2026-001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status Delta</label>
                <select className={inputSmCls} value={status_delta} onChange={e => setStatusDelta(e.target.value as StatusDelta | '')}>
                  <option value="">— Selecione —</option>
                  <option value="aguardando">🟡 Aguardando</option>
                  <option value="confirmado">🟢 Confirmado</option>
                  <option value="atrasado">🔴 Atrasado</option>
                  <option value="faturado">🔵 Faturado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Transportadora</label>
                <input className={inputSmCls} value={transportadora} onChange={e => setTransp(e.target.value)} placeholder="Ex: Jadlog" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Condição de Pagamento</label>
                <input className={inputSmCls} value={condicao_pagamento} onChange={e => setCondPag(e.target.value)} placeholder="Ex: 30/60 DDL" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nº NF</label>
                <input className={inputSmCls} value={numero_nf} onChange={e => setNumNF(e.target.value)} placeholder="Ex: 000123" />
              </div>
              <div />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fat. Previsto</label>
                <input type="date" className={inputSmCls} value={data_faturamento_prevista} onChange={e => setFatPrev(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fat. Real</label>
                <input type="date" className={inputSmCls} value={data_faturamento_real} onChange={e => setFatReal(e.target.value)} />
              </div>
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
                          type="number" min={1}
                          className="w-full outline-none text-center text-sm focus:bg-blue-50 rounded px-1 -mx-1 transition-colors"
                          value={it.quantidade}
                          onChange={e => updItem(it._key, 'quantidade', Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min={0} step="0.01"
                          className="w-full outline-none text-right text-sm focus:bg-blue-50 rounded px-1 -mx-1 transition-colors"
                          placeholder="0,00"
                          value={it.preco_unitario || ''}
                          onChange={e => updItem(it._key, 'preco_unitario', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 font-medium">
                        {(it.quantidade * it.preco_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
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

// ─── Modal Detalhe ────────────────────────────────────────────────────────────

function ModalDetalhe({ pedido: init, onClose, onAvancar, onLembrete, onUpdateDelta }: {
  pedido: Pedido
  onClose: () => void
  onAvancar: (id: string, statusAtual: Pedido['status']) => Promise<void>
  onLembrete: (id: string) => Promise<void>
  onUpdateDelta: (id: string, campos: Partial<Pedido>) => Promise<void>
}) {
  const [pedido, setPedido] = useState(init)
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

  async function handleSaveDelta(campos: Partial<Pedido>) {
    await onUpdateDelta(pedido.id, campos)
    setPedido(p => ({ ...p, ...campos }))
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
              {pedido.numero_orcamento && (
                <span className="text-xs text-gray-400 font-mono">ORC: {pedido.numero_orcamento}</span>
              )}
              <StatusBadge status={pedido.status} />
              <StatusDeltaBadge status={pedido.status_delta} />
              {alertaFaturamento && (
                <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-medium">
                  <AlertTriangle size={11} /> {dias}d sem faturar
                </span>
              )}
            </div>
            <p className="font-semibold text-gray-800 mt-1">{pedido.clientes?.empresa}</p>
            <p className="text-sm text-gray-500">{pedido.clientes?.nome}{pedido.cnpj ? ` · CNPJ: ${formatCnpj(pedido.cnpj)}` : ''}</p>
          </div>
          <button onClick={onClose} className="mt-1">
            <X size={20} className="text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* KPIs resumo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Orçamento</p>
              <p className="font-semibold text-sm text-gray-800 mt-0.5">{fmtDate(pedido.data_orcamento)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">Enviado</p>
              <p className={`font-semibold text-sm mt-0.5 ${pedido.data_pedido ? 'text-gray-800' : 'text-gray-400 italic'}`}>
                {pedido.data_pedido ? fmtDate(pedido.data_pedido) : '--/--/----'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500">
                {pedido.data_faturamento_real ? 'Fat. Real' : pedido.data_faturamento_prevista ? 'Fat. Previsto' : 'Entrega Prev.'}
              </p>
              <p className="font-semibold text-sm text-gray-800 mt-0.5">
                {fmtDate(pedido.data_faturamento_real || pedido.data_faturamento_prevista || pedido.data_entrega_prevista)}
              </p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600">Valor Total</p>
              <p className="font-bold text-sm text-blue-700 mt-0.5">
                {pedido.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          {/* Dados Delta Plus */}
          <SecaoDeltaPlus pedido={pedido} onSave={handleSaveDelta} />

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

// ─── Modal Importar PDF ───────────────────────────────────────────────────────

function ModalImportarPDF({ onClose, onPedidoCriado }: {
  onClose: () => void
  onPedidoCriado: (pedido: Pedido) => void
}) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<Pedido | null>(null)

  async function processar() {
    if (!arquivo) return
    setLoading(true)
    setErro('')
    try {
      const formData = new FormData()
      formData.append('attachment', arquivo)
      const res = await fetch('/api/processar-pedido', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro ao processar PDF')
      setSucesso(data.pedido)
      onPedidoCriado(data.pedido)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Upload size={18} className="text-blue-600" /> Importar PDF Delta Plus
          </h3>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        {sucesso ? (
          <div className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-800">Pedido criado com sucesso!</p>
              <p className="text-sm text-green-700 mt-1 font-mono">{sucesso.numero}</p>
              <p className="text-sm text-green-600 mt-0.5">
                {sucesso.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo PDF</label>
              <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                ${arquivo ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/40'}`}>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={e => { setArquivo(e.target.files?.[0] ?? null); setErro('') }}
                />
                {arquivo ? (
                  <>
                    <FileText size={24} className="text-blue-500 mb-1.5" />
                    <p className="text-sm font-medium text-blue-700 text-center px-4 truncate max-w-full">{arquivo.name}</p>
                    <p className="text-xs text-blue-400 mt-0.5">{(arquivo.size / 1024).toFixed(0)} KB</p>
                  </>
                ) : (
                  <>
                    <Upload size={24} className="text-gray-400 mb-1.5" />
                    <p className="text-sm text-gray-500">Clique para selecionar o PDF</p>
                    <p className="text-xs text-gray-400 mt-0.5">Orçamento Delta Plus</p>
                  </>
                )}
              </label>
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erro}</div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={processar}
                disabled={!arquivo || loading}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processando...</>
                ) : (
                  <><Upload size={15} /> Importar</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Aviso de DANFE pendente ───────────────────────────────────────────────────

function DanfeAviso({ danfe, onConfirmar, onRejeitar }: {
  danfe: DanfePendente
  onConfirmar: () => Promise<void>
  onRejeitar: () => Promise<void>
}) {
  const [acting, setActing] = useState(false)

  async function confirmar(e: React.MouseEvent) {
    e.stopPropagation()
    setActing(true)
    try { await onConfirmar() } finally { setActing(false) }
  }

  async function rejeitar(e: React.MouseEvent) {
    e.stopPropagation()
    setActing(true)
    try { await onRejeitar() } finally { setActing(false) }
  }

  return (
    <div onClick={e => e.stopPropagation()} className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
      <p className="text-xs font-semibold text-yellow-700 flex items-center gap-1.5">
        <FileText size={13} /> DANFE recebida — aguardando confirmação
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-gray-600">
        <span>NF {danfe.nf_numero || '—'}</span>
        <span>{(danfe.valor_total ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        {danfe.transportadora && <span>{danfe.transportadora}</span>}
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={confirmar}
          disabled={acting}
          className="flex items-center gap-1 text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircle2 size={11} /> Confirmar vínculo
        </button>
        <button
          onClick={rejeitar}
          disabled={acting}
          className="flex items-center gap-1 text-xs text-red-600 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 disabled:opacity-50"
        >
          <XCircle size={11} /> Rejeitar
        </button>
      </div>
    </div>
  )
}

// ─── Card de Pedido ───────────────────────────────────────────────────────────

function PedidoCard({ p, danfe, onClick, onConfirmarDanfe, onRejeitarDanfe }: {
  p: Pedido
  danfe?: DanfePendente
  onClick: () => void
  onConfirmarDanfe: (danfeId: string, pedidoId: string) => Promise<void>
  onRejeitarDanfe: (danfeId: string) => Promise<void>
}) {
  const hoje = new Date()
  const dias = differenceInDays(hoje, parseISO(p.data_pedido))
  const alertaFaturamento = ['aprovado', 'em_producao'].includes(p.status) && dias >= 4 && !p.lembrete_faturamento_enviado

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-all group
        ${alertaFaturamento ? 'border-orange-300 bg-orange-50/30' : 'border-gray-200 hover:border-gray-300'}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-blue-700">{p.numero}</span>
            {p.numero_orcamento && (
              <span className="text-xs text-gray-400 font-mono">ORC: {p.numero_orcamento}</span>
            )}
            <StatusBadge status={p.status} />
            <StatusDeltaBadge status={p.status_delta} />
            {alertaFaturamento && (
              <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full font-medium">
                <AlertTriangle size={11} /> {dias}d sem faturar
              </span>
            )}
            {p.lembrete_faturamento_enviado && !alertaFaturamento && (
              <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={11} /> Lembrete
              </span>
            )}
          </div>

          {/* Cliente */}
          <p className="font-semibold text-gray-800 mt-1.5">{p.clientes?.empresa}</p>
          <p className="text-xs text-gray-500">{p.clientes?.nome}{p.cnpj ? ` · CNPJ: ${formatCnpj(p.cnpj)}` : ''}</p>

          {/* Campos Delta inline */}
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-gray-500">
            {p.transportadora && (
              <span className="flex items-center gap-1">
                <Truck size={11} className="text-gray-400" /> {p.transportadora}
              </span>
            )}
            {p.condicao_pagamento && (
              <span>{p.condicao_pagamento}</span>
            )}
            {p.numero_nf && (
              <span className="flex items-center gap-1">
                <FileText size={11} className="text-gray-400" /> NF {p.numero_nf}
              </span>
            )}
          </div>

          {/* Datas */}
          <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
            <span className={p.data_orcamento ? '' : 'italic text-gray-300'}>
              Orçamento: {p.data_orcamento ? fmtDate(p.data_orcamento) : '--/--/----'}
            </span>
            <span className={p.data_pedido ? '' : 'italic text-gray-300'}>
              Enviado: {p.data_pedido ? fmtDate(p.data_pedido) : '--/--/----'}
            </span>
            {p.data_faturamento_prevista && (
              <span>Fat. prev.: {fmtDate(p.data_faturamento_prevista)}</span>
            )}
            {p.data_faturamento_real ? (
              <span className="text-green-600 font-medium">Fat. real: {fmtDate(p.data_faturamento_real)}</span>
            ) : p.data_entrega_prevista && !p.data_faturamento_prevista ? (
              <span>Entrega: {fmtDate(p.data_entrega_prevista)}</span>
            ) : null}
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

      {danfe && (
        <DanfeAviso
          danfe={danfe}
          onConfirmar={() => onConfirmarDanfe(danfe.id, p.id)}
          onRejeitar={() => onRejeitarDanfe(danfe.id)}
        />
      )}

      {p.nf_pdf_url && (
        <a
          href={p.nf_pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium w-fit"
        >
          <Download size={12} /> Baixar DANFE
        </a>
      )}
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [danfesAguardando, setDanfesAguardando] = useState<DanfePendente[]>([])
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroDelta, setFiltroDelta] = useState('todos')
  const [showModal, setShowModal] = useState(false)
  const [showModalImportar, setShowModalImportar] = useState(false)
  const [pedidoAberto, setPedidoAberto] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    Promise.all([getPedidos(), getClientes(), getDanfesAguardando()]).then(([p, c, d]) => {
      setPedidos(p)
      setClientes(c)
      setDanfesAguardando(d)
      setLoading(false)
    })
  }, [])

  function danfeDoPedido(p: Pedido): DanfePendente | undefined {
    const cnpjPedido = normalizeCnpj(p.cnpj)
    if (!cnpjPedido || p.status === 'cancelado') return undefined
    return danfesAguardando.find(d => normalizeCnpj(d.cnpj) === cnpjPedido)
  }

  async function confirmarDanfe(danfeId: string, pedidoId: string) {
    setErro('')
    const res = await fetch(`/api/danfes-pendentes/${danfeId}/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId }),
    })
    const data = await res.json()
    if (!res.ok || data.error) {
      setErro(data.error || 'Erro ao confirmar a DANFE.')
      return
    }
    setDanfesAguardando(prev => prev.filter(d => d.id !== danfeId))
    setPedidos(prev => prev.map(p => p.id === pedidoId ? {
      ...p,
      status_delta: 'faturado',
      nf_numero: data.danfe.nf_numero,
      nf_chave_acesso: data.danfe.nf_chave_acesso,
      nf_data_emissao: data.danfe.nf_data_emissao,
      nf_pdf_url: data.danfe.pdf_url,
      nf_status: 'capturada',
    } : p))
  }

  async function rejeitarDanfe(danfeId: string) {
    setErro('')
    const res = await fetch(`/api/danfes-pendentes/${danfeId}/rejeitar`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok || data.error) {
      setErro(data.error || 'Erro ao rejeitar a DANFE.')
      return
    }
    setDanfesAguardando(prev => prev.filter(d => d.id !== danfeId))
  }

  const filtrados = pedidos
    .filter(p => filtroStatus === 'todos' || p.status === filtroStatus)
    .filter(p => filtroDelta === 'todos' || p.status_delta === filtroDelta)
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
    try { await addHistoricoPedido(novo.id, 'Pedido criado') } catch { /* tabela pode não existir */ }
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
    } catch { /* tabela pode não existir */ }
    setPedidos(prev => prev.map(p =>
      p.id === id ? { ...p, status: next, ...(data_faturamento ? { data_faturamento } : {}) } : p
    ))
  }

  async function lembrete(id: string) {
    await marcarLembreteEnviado(id)
    try { await addHistoricoPedido(id, 'Lembrete de faturamento enviado') } catch { /* tabela pode não existir */ }
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, lembrete_faturamento_enviado: true } : p))
  }

  async function updateDelta(id: string, campos: Partial<Pedido>) {
    await updatePedido(id, campos)
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, ...campos } : p))
    setPedidoAberto(prev => prev?.id === id ? { ...prev, ...campos } : prev)
  }

  const tabsStatus = [
    { key: 'todos',       label: 'Todos' },
    { key: 'pendente',    label: 'Ag. Confirmação' },
    { key: 'aprovado',    label: 'Confirmado' },
    { key: 'em_producao', label: 'Em Produção' },
    { key: 'faturado',    label: 'Faturado' },
    { key: 'entregue',    label: 'Entregue' },
    { key: 'cancelado',   label: 'Cancelado' },
  ]

  const tabsDelta = [
    { key: 'todos',      label: 'Todos',            active: 'bg-gray-800 text-white border-gray-800',       inactive: 'border-gray-200 text-gray-500' },
    { key: 'aguardando', label: 'Aguardando',        active: 'bg-yellow-100 text-yellow-700 border-yellow-300', inactive: 'border-gray-200 text-gray-500' },
    { key: 'confirmado', label: 'Confirmado',        active: 'bg-green-100  text-green-700  border-green-300',  inactive: 'border-gray-200 text-gray-500' },
    { key: 'atrasado',   label: 'Atrasado',          active: 'bg-red-100    text-red-700    border-red-300',    inactive: 'border-gray-200 text-gray-500' },
    { key: 'faturado',   label: 'Faturado (Delta)',  active: 'bg-blue-100   text-blue-700   border-blue-300',   inactive: 'border-gray-200 text-gray-500' },
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
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pedidos</h2>
          <p className="text-gray-500 text-sm mt-1">
            {filtrados.length} pedido{filtrados.length !== 1 ? 's' : ''} ·{' '}
            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowModalImportar(true)}
            className="flex items-center gap-2 bg-white text-blue-600 border border-blue-300 px-4 py-2 rounded-lg hover:bg-blue-50 text-sm font-medium shadow-sm"
          >
            <Upload size={16} /> Importar PDF
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm"
          >
            <Plus size={16} /> Novo Pedido
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{erro}</div>
      )}

      {/* Filtro Status Delta Plus */}
      <div>
        <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
          <span>△</span> Status Delta Plus
        </p>
        <div className="flex gap-2 flex-wrap">
          {tabsDelta.map(t => {
            const count = t.key === 'todos'
              ? pedidos.filter(p => filtroDelta !== 'todos' ? true : true).length
              : pedidos.filter(p => p.status_delta === t.key).length
            const isActive = filtroDelta === t.key
            return (
              <button
                key={t.key}
                onClick={() => setFiltroDelta(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                  ${isActive ? t.active : `bg-white ${t.inactive} hover:border-gray-300`}`}
              >
                {t.label}
                <span className={`text-xs rounded-full px-1.5 py-0.5 tabular-nums font-medium
                  ${isActive ? 'bg-white/30' : 'bg-gray-100 text-gray-500'}`}>
                  {t.key === 'todos' ? pedidos.length : count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtro Status Pedido */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-gray-200">
        {tabsStatus.map(t => {
          const count = t.key === 'todos' ? pedidos.length : pedidos.filter(p => p.status === t.key).length
          return (
            <button
              key={t.key}
              onClick={() => setFiltroStatus(t.key)}
              className={`pb-3 px-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5
                ${filtroStatus === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 tabular-nums
                ${filtroStatus === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {filtrados.map(p => (
          <PedidoCard
            key={p.id}
            p={p}
            danfe={danfeDoPedido(p)}
            onClick={() => setPedidoAberto(p)}
            onConfirmarDanfe={confirmarDanfe}
            onRejeitarDanfe={rejeitarDanfe}
          />
        ))}
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
      {showModalImportar && (
        <ModalImportarPDF
          onClose={() => setShowModalImportar(false)}
          onPedidoCriado={p => setPedidos(prev => [p, ...prev])}
        />
      )}
      {pedidoAberto && (
        <ModalDetalhe
          pedido={pedidoAberto}
          onClose={() => setPedidoAberto(null)}
          onAvancar={avancar}
          onLembrete={lembrete}
          onUpdateDelta={updateDelta}
        />
      )}
    </div>
  )
}
