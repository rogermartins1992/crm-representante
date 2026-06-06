'use client'

import { useState, useEffect } from 'react'
import { Clock, Pencil, X, Check, AlertTriangle, CalendarCheck } from 'lucide-react'
import Link from 'next/link'
import { getVisitas, updateVisita } from '@/lib/db'
import type { Visita } from '@/lib/supabase'
import { format, parseISO, addDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Filtro = 'todos' | 'hoje' | 'atrasados' | 'proximos7'

function EditModal({ visita, onClose, onSaved }: {
  visita: Visita
  onClose: () => void
  onSaved: (updates: Partial<Visita>) => void
}) {
  const [form, setForm] = useState({
    proximo_passo: visita.proximo_passo || '',
    data_followup: visita.data_followup || '',
    hora_visita: visita.hora_visita ? visita.hora_visita.substring(0, 5) : '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.data_followup) return
    setSaving(true)
    try {
      await updateVisita(visita.id, {
        proximo_passo: form.proximo_passo || undefined,
        data_followup: form.data_followup,
        hora_visita: form.hora_visita || undefined,
      })
      onSaved({
        proximo_passo: form.proximo_passo || undefined,
        data_followup: form.data_followup,
        hora_visita: form.hora_visita || undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Editar Follow-up</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {visita.clientes?.empresa || visita.clientes?.nome || ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Próximo Passo / Tarefa</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: Enviar proposta, Ligar para confirmar..."
              value={form.proximo_passo}
              onChange={e => setForm(f => ({ ...f, proximo_passo: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.data_followup}
                onChange={e => setForm(f => ({ ...f, data_followup: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
              <input
                type="time"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.hora_visita}
                onChange={e => setForm(f => ({ ...f, hora_visita: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.data_followup}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const filtros: { key: Filtro; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'atrasados', label: 'Atrasados' },
  { key: 'proximos7', label: 'Próximos 7 dias' },
]

export default function FollowUpsPage() {
  const [todos, setTodos] = useState<Visita[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [editando, setEditando] = useState<Visita | null>(null)
  const [concluindo, setConcluindo] = useState<string | null>(null)

  const hoje = startOfDay(new Date())
  const hojeStr = format(hoje, 'yyyy-MM-dd')
  const proximos7Str = format(addDays(hoje, 7), 'yyyy-MM-dd')

  useEffect(() => {
    getVisitas().then(visitas => {
      setTodos(
        visitas
          .filter(v => v.data_followup && !v.followup_enviado)
          .sort((a, b) => a.data_followup!.localeCompare(b.data_followup!))
      )
      setLoading(false)
    })
  }, [])

  async function concluir(id: string) {
    setConcluindo(id)
    try {
      await updateVisita(id, { followup_enviado: true })
      setTodos(prev => prev.filter(v => v.id !== id))
    } finally {
      setConcluindo(null)
    }
  }

  function aplicarFiltro(lista: Visita[]): Visita[] {
    switch (filtro) {
      case 'hoje':
        return lista.filter(v => v.data_followup === hojeStr)
      case 'atrasados':
        return lista.filter(v => v.data_followup! < hojeStr)
      case 'proximos7':
        return lista.filter(v => v.data_followup! >= hojeStr && v.data_followup! <= proximos7Str)
      default:
        return lista
    }
  }

  const contadores: Record<Filtro, number> = {
    todos: todos.length,
    hoje: todos.filter(v => v.data_followup === hojeStr).length,
    atrasados: todos.filter(v => v.data_followup! < hojeStr).length,
    proximos7: todos.filter(v => v.data_followup! >= hojeStr && v.data_followup! <= proximos7Str).length,
  }

  const filtrados = aplicarFiltro(todos)

  function formatarDataHora(data: string, hora?: string | null) {
    const dataStr = data === hojeStr
      ? 'Hoje'
      : format(parseISO(data), "dd/MM", { locale: ptBR })
    return hora ? `${dataStr} às ${hora.substring(0, 5)}` : dataStr
  }

  function tagAtrasado(data: string) {
    return data < hojeStr
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Follow-ups Pendentes</h2>
        <p className="text-gray-500 text-sm mt-1">
          {todos.length} pendente{todos.length !== 1 ? 's' : ''}
          {contadores.atrasados > 0 && (
            <span className="ml-2 text-orange-600 font-medium">
              · {contadores.atrasados} atrasado{contadores.atrasados !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filtros.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filtro === f.key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            {f.label}
            {contadores[f.key] > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                filtro === f.key ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {contadores[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CalendarCheck size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400">
            {filtro === 'todos' ? 'Nenhum follow-up pendente' : 'Nenhum follow-up neste filtro'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(v => {
            const atrasado = tagAtrasado(v.data_followup!)
            const ehHoje = v.data_followup === hojeStr
            return (
              <div
                key={v.id}
                className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-4 hover:shadow-sm transition-shadow ${
                  atrasado ? 'border-orange-200' : 'border-gray-200'
                }`}
              >
                <div className={`shrink-0 w-1 self-stretch rounded-full ${
                  atrasado ? 'bg-orange-400' : ehHoje ? 'bg-blue-400' : 'bg-gray-200'
                }`} />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {v.proximo_passo || v.objetivo || '—'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Link
                      href={`/clientes?id=${v.cliente_id}`}
                      className="text-xs text-blue-600 hover:underline font-medium"
                      onClick={e => e.stopPropagation()}
                    >
                      {v.clientes?.empresa || v.clientes?.nome || 'Cliente'}
                    </Link>
                    {v.clientes?.nome && v.clientes.empresa && (
                      <span className="text-xs text-gray-400">{v.clientes.nome}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {atrasado && (
                    <AlertTriangle size={13} className="text-orange-500" />
                  )}
                  <span className={`text-xs font-medium ${
                    atrasado ? 'text-orange-600' : ehHoje ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {formatarDataHora(v.data_followup!, v.hora_visita)}
                  </span>
                </div>

                <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => setEditando(v)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => concluir(v.id)}
                    disabled={concluindo === v.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                    title="Concluir"
                  >
                    <Check size={12} />
                    {concluindo === v.id ? '...' : 'Concluir'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editando && (
        <EditModal
          visita={editando}
          onClose={() => setEditando(null)}
          onSaved={updates => {
            setTodos(prev => prev.map(v => v.id === editando.id ? { ...v, ...updates } : v))
            setEditando(null)
          }}
        />
      )}
    </div>
  )
}
