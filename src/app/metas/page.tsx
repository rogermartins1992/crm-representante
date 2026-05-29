'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, TrendingUp } from 'lucide-react'
import { getMetas, upsertMeta, getVendasMes } from '@/lib/db'
import type { Meta } from '@/lib/supabase'
import MetaProgress from '@/components/MetaProgress'

const mesesNomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

type MetaComRealizado = Meta & { realizado: number }

export default function MetasPage() {
  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()

  const [metas, setMetas] = useState<MetaComRealizado[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const [novoMes, setNovoMes] = useState(String(mesAtual))
  const [novoAno, setNovoAno] = useState(String(anoAtual))
  const [novoValor, setNovoValor] = useState('')

  const carregarMetas = useCallback(async () => {
    const raw = await getMetas()
    const comRealizado = await Promise.all(
      raw.map(async m => ({
        ...m,
        realizado: await getVendasMes(m.mes, m.ano),
      }))
    )
    setMetas(comRealizado)
    setLoading(false)
  }, [])

  useEffect(() => { carregarMetas() }, [carregarMetas])

  const metaAtual = metas.find(m => m.mes === mesAtual && m.ano === anoAtual)

  async function handleUpsert(mes: number, ano: number, valor: number) {
    setSaving(true)
    const ok = await upsertMeta(mes, ano, valor)
    if (ok) await carregarMetas()
    setSaving(false)
  }

  async function adicionarMeta() {
    const mes = parseInt(novoMes)
    const ano = parseInt(novoAno)
    const valor = parseFloat(novoValor)
    if (!mes || !ano || isNaN(valor) || valor <= 0) return
    await handleUpsert(mes, ano, valor)
    setNovoValor('')
  }

  async function salvarEdicao(m: MetaComRealizado) {
    const valor = parseFloat(editValor)
    if (!isNaN(valor) && valor > 0) {
      await handleUpsert(m.mes, m.ano, valor)
    }
    setEditando(null)
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
        <h2 className="text-2xl font-bold text-gray-900">Meta Mensal</h2>
        <p className="text-gray-500 text-sm mt-1">Acompanhamento de metas de vendas</p>
      </div>

      {/* Destaque do mês atual */}
      {metaAtual ? (
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={20} className="text-blue-200" />
            <h3 className="font-semibold">Mês Atual — {mesesNomes[mesAtual - 1]} {anoAtual}</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-blue-200 text-xs mb-1">Meta</p>
              <p className="text-2xl font-bold">R$ {(metaAtual.valor_meta / 1000).toFixed(0)}k</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs mb-1">Realizado</p>
              <p className="text-2xl font-bold">R$ {(metaAtual.realizado / 1000).toFixed(1)}k</p>
            </div>
            <div>
              <p className="text-blue-200 text-xs mb-1">Atingimento</p>
              <p className="text-2xl font-bold">
                {metaAtual.valor_meta > 0
                  ? ((metaAtual.realizado / metaAtual.valor_meta) * 100).toFixed(0)
                  : 0}%
              </p>
            </div>
          </div>
          <div className="w-full bg-blue-500/40 rounded-full h-3">
            <div
              className="bg-white rounded-full h-3 transition-all duration-700"
              style={{ width: `${Math.min((metaAtual.realizado / metaAtual.valor_meta) * 100, 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-center text-blue-600">
          Nenhuma meta definida para {mesesNomes[mesAtual - 1]} {anoAtual}. Defina uma abaixo.
        </div>
      )}

      {/* Formulário */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Definir / Atualizar Meta</h3>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mês</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={novoMes}
              onChange={e => setNovoMes(e.target.value)}
            >
              {mesesNomes.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ano</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={novoAno}
              onChange={e => setNovoAno(e.target.value)}
            >
              {[anoAtual - 1, anoAtual, anoAtual + 1].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-gray-500 mb-1">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="1000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 50000"
              value={novoValor}
              onChange={e => setNovoValor(e.target.value)}
            />
          </div>
          <button
            onClick={adicionarMeta}
            disabled={!novoValor || parseFloat(novoValor) <= 0 || saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {saving ? 'Salvando...' : 'Salvar Meta'}
          </button>
        </div>
      </div>

      {/* Histórico */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-800">Histórico de Metas</h3>
        {metas.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">Nenhuma meta cadastrada ainda.</p>
        )}
        {metas
          .sort((a, b) => b.ano - a.ano || b.mes - a.mes)
          .map(m => {
            const pct = m.valor_meta > 0 ? (m.realizado / m.valor_meta) * 100 : 0
            const atingiu = pct >= 100
            const key = `${m.mes}-${m.ano}`

            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {atingiu && <CheckCircle2 size={16} className="text-green-500" />}
                    <h4 className="font-medium text-gray-800">
                      {mesesNomes[m.mes - 1]} {m.ano}
                      {m.mes === mesAtual && m.ano === anoAtual && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">atual</span>
                      )}
                    </h4>
                  </div>
                  {editando === key ? (
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={editValor}
                        onChange={e => setEditValor(e.target.value)}
                        autoFocus
                      />
                      <button
                        onClick={() => salvarEdicao(m)}
                        className="text-xs text-green-600 border border-green-200 rounded px-2 py-1 hover:bg-green-50"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="text-xs text-gray-500 border border-gray-200 rounded px-2 py-1"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditando(key); setEditValor(String(m.valor_meta)) }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                  )}
                </div>
                <MetaProgress meta={m.valor_meta} realizado={m.realizado} mes={m.mes} ano={m.ano} />
              </div>
            )
          })}
      </div>
    </div>
  )
}
