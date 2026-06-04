'use client'

import { useState, useEffect } from 'react'
import { Plus, Calendar, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { getVisitas, createVisita, updateVisita, getClientes, createLembrete } from '@/lib/db'
import type { Visita, Cliente } from '@/lib/supabase'
import StatusBadge from '@/components/StatusBadge'
import { format, parseISO, differenceInDays, isToday, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function VisitaModal({ onClose, onSave, clientes }: {
  onClose: () => void
  onSave: (v: Partial<Visita>) => Promise<Visita>
  clientes: Cliente[]
}) {
  const [form, setForm] = useState<Partial<Visita>>({ tipo: 'presencial', status: 'agendada' })
  const [saving, setSaving] = useState(false)
  const [showLembrete, setShowLembrete] = useState(false)
  const [lembreteTexto, setLembreteTexto] = useState('')
  const [lembreteData, setLembreteData] = useState('')
  const [visitaSalvaId, setVisitaSalvaId] = useState<string | null>(null)

  function set(k: keyof Visita, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.cliente_id || !form.data_visita) return
    setSaving(true)
    const visitaSalva = await onSave(form)
    setSaving(false)
    if (visitaSalva?.id) {
      setVisitaSalvaId(visitaSalva.id)
      setShowLembrete(true)
    } else {
      onClose()
    }
  }

  if (showLembrete) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
          <h3 className="text-lg font-semibold mb-2">Criar Lembrete</h3>
          <p className="text-sm text-gray-500 mb-4">Quer criar um lembrete para este cliente?</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">O que precisa fazer?</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Enviar bonificação, Mandar NF..."
                value={lembreteTexto}
                onChange={e => setLembreteTexto(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quando lembrar?</label>
              <input
                type="datetime-local"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={lembreteData}
                onChange={e => setLembreteData(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Pular
            </button>
            <button
              onClick={async () => {
                if (lembreteTexto && lembreteData && visitaSalvaId) {
                  await createLembrete({
                    cliente_id: form.cliente_id!,
                    visita_id: visitaSalvaId ?? undefined,
                    texto: lembreteTexto,
                    data_lembrete: lembreteData,
                  })
                }
                onClose()
              }}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700"
            >
              Salvar Lembrete
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nova Visita</h3>
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
              {[...clientes]
                .sort((a, b) => (a.empresa || a.nome || '').localeCompare(b.empresa || b.nome || '', 'pt-BR'))
                .map(c => (
                  <option key={c.id} value={c.id}>{c.empresa} — {c.nome}</option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.data_visita || ''}
                onChange={e => set('data_visita', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora</label>
              <input
                type="time"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.hora_visita || ''}
                onChange={e => set('hora_visita', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.tipo || 'presencial'}
                onChange={e => set('tipo', e.target.value)}
              >
                <option value="presencial">Presencial</option>
                <option value="remota">Remota</option>
                <option value="telefone">Telefone</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.status || 'agendada'}
                onChange={e => set('status', e.target.value)}
              >
                <option value="agendada">Agendada</option>
                <option value="realizada">Realizada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo da Visita</label>
            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="O que você pretende alcançar nesta visita?"
              value={form.objetivo || ''}
              onChange={e => set('objetivo', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Próximo Passo</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Enviar proposta, Ligar em 3 dias..."
              value={form.proximo_passo || ''}
              onChange={e => set('proximo_passo', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data do Follow-up</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.data_followup || ''}
              onChange={e => set('data_followup', e.target.value)}
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!form.cliente_id || !form.data_visita || saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar Visita'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VisitasPage() {
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtro, setFiltro] = useState<'todas' | 'agendada' | 'realizada' | 'cancelada'>('todas')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getVisitas(), getClientes()]).then(([v, c]) => {
      setVisitas(v)
      setClientes(c)
      setLoading(false)
    })
  }, [])

  const hoje = new Date()

  const filtradas = visitas
    .filter(v => filtro === 'todas' || v.status === filtro)
    .sort((a, b) => b.data_visita.localeCompare(a.data_visita))

  async function salvar(form: Partial<Visita>): Promise<Visita> {
    const cliente = clientes.find(c => c.id === form.cliente_id)
    const nova = await createVisita({
      cliente_id: form.cliente_id!,
      data_visita: form.data_visita!,
      hora_visita: form.hora_visita,
      tipo: (form.tipo as Visita['tipo']) || 'presencial',
      status: (form.status as Visita['status']) || 'agendada',
      objetivo: form.objetivo,
      resultado: form.resultado,
      proximo_passo: form.proximo_passo,
      data_followup: form.data_followup,
      followup_enviado: false,
    })
    setVisitas(prev => [{ ...nova, clientes: cliente }, ...prev])
    return nova
  }

  async function marcarRealizada(id: string) {
    await updateVisita(id, { status: 'realizada' })
    setVisitas(prev => prev.map(v => v.id === id ? { ...v, status: 'realizada' as const } : v))
  }

  async function marcarFollowup(id: string) {
    await updateVisita(id, { followup_enviado: true })
    setVisitas(prev => prev.map(v => v.id === id ? { ...v, followup_enviado: true } : v))
  }

  function followupTag(v: Visita) {
    if (!v.data_followup) return null
    if (v.followup_enviado) {
      return <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={11} />Follow-up feito</span>
    }
    const dt = parseISO(v.data_followup)
    const diff = differenceInDays(dt, hoje)
    if (isPast(dt) && !isToday(dt)) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-500 font-medium flex items-center gap-1">
            <AlertTriangle size={11} />Follow-up atrasado ({format(dt, 'dd/MM')})
          </span>
          <button
            onClick={() => marcarFollowup(v.id)}
            className="text-xs text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-50"
          >
            Marcar feito
          </button>
        </div>
      )
    }
    if (isToday(dt)) return <span className="text-xs text-orange-500 font-medium">Follow-up hoje!</span>
    return <span className="text-xs text-gray-500">Follow-up em {diff}d — {format(dt, 'dd/MM')}</span>
  }

  const tabs: { key: typeof filtro; label: string }[] = [
    { key: 'todas', label: `Todas (${visitas.length})` },
    { key: 'agendada', label: `Agendadas (${visitas.filter(v => v.status === 'agendada').length})` },
    { key: 'realizada', label: `Realizadas (${visitas.filter(v => v.status === 'realizada').length})` },
    { key: 'cancelada', label: `Canceladas (${visitas.filter(v => v.status === 'cancelada').length})` },
  ]

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
          <h2 className="text-2xl font-bold text-gray-900">Visitas</h2>
          <p className="text-gray-500 text-sm mt-1">Gestão de visitas e follow-ups automáticos</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus size={16} />
          Nova Visita
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFiltro(t.key)}
            className={`pb-3 px-3 text-sm font-medium border-b-2 transition-colors
              ${filtro === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtradas.map(v => (
          <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-4">
              <div className="text-center min-w-[52px] bg-blue-50 rounded-lg p-2">
                <p className="text-xs text-blue-500 font-medium">
                  {format(parseISO(v.data_visita), 'MMM', { locale: ptBR }).toUpperCase()}
                </p>
                <p className="text-xl font-bold text-blue-700">
                  {format(parseISO(v.data_visita), 'dd')}
                </p>
                {v.hora_visita && <p className="text-xs text-blue-400">{v.hora_visita}</p>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900">{v.clientes?.empresa}</h3>
                  <StatusBadge status={v.status} />
                  <StatusBadge status={v.tipo} />
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{v.clientes?.nome}</p>
                {v.objetivo && <p className="text-sm text-gray-700 mt-2">{v.objetivo}</p>}
                {v.resultado && (
                  <p className="text-sm text-green-700 mt-1 bg-green-50 px-2 py-1 rounded">
                    Resultado: {v.resultado}
                  </p>
                )}
                {v.proximo_passo && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Próximo passo:</span> {v.proximo_passo}
                  </p>
                )}
                <div className="mt-2">{followupTag(v)}</div>
              </div>
              {v.status === 'agendada' && (
                <button
                  onClick={() => marcarRealizada(v.id)}
                  className="shrink-0 flex items-center gap-1 text-xs text-green-600 border border-green-200 rounded-lg px-2 py-1.5 hover:bg-green-50"
                >
                  <CheckCircle2 size={14} />
                  Realizada
                </button>
              )}
            </div>
          </div>
        ))}
        {filtradas.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Calendar size={40} className="mx-auto mb-3 opacity-40" />
            <p>Nenhuma visita encontrada</p>
          </div>
        )}
      </div>

      {showModal && (
        <VisitaModal
          onClose={() => setShowModal(false)}
          onSave={salvar}
          clientes={clientes}
        />
      )}
    </div>
  )
}
