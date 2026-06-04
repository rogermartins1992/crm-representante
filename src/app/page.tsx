'use client'

import { useState, useEffect } from 'react'
import { Users, CalendarCheck, ShoppingCart, Clock, AlertTriangle, Bell } from 'lucide-react'
import Link from 'next/link'
import MetaProgress from '@/components/MetaProgress'
import AlertasFaturamento from '@/components/AlertasFaturamento'
import StatusBadge from '@/components/StatusBadge'
import { getClientes, getVisitas, getPedidos, getMeta, getVendasMes, getLembretes, concluirLembrete } from '@/lib/db'
import type { Cliente, Visita, Pedido, Meta } from '@/lib/supabase'

type Lembrete = {
  id: string
  texto: string
  data_lembrete: string
  concluido: boolean
  clientes?: { nome: string; empresa: string } | null
}
import { format, parseISO, isToday, isTomorrow, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Dashboard() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [visitas, setVisitas] = useState<Visita[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [lembretes, setLembretes] = useState<Lembrete[]>([])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [realizado, setRealizado] = useState(0)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const hoje = new Date()
  const mes = hoje.getMonth() + 1
  const ano = hoje.getFullYear()

  useEffect(() => {
    Promise.all([
      getClientes(),
      getVisitas(),
      getPedidos(),
      getMeta(mes, ano),
      getVendasMes(mes, ano),
      getLembretes(),
    ])
      .then(([c, v, p, m, r, l]) => {
        setClientes(c)
        setVisitas(v)
        setPedidos(p)
        setMeta(m)
        setRealizado(r)
        setLembretes(l as Lembrete[])
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [mes, ano])

  const proximasVisitas = visitas
    .filter(v => v.status === 'agendada')
    .sort((a, b) => a.data_visita.localeCompare(b.data_visita))
    .slice(0, 4)

  const followupsPendentes = visitas.filter(v => {
    if (!v.data_followup || v.followup_enviado) return false
    return differenceInDays(hoje, parseISO(v.data_followup)) >= 0
  })

  const pedidosRecentes = pedidos
    .sort((a, b) => b.data_pedido.localeCompare(a.data_pedido))
    .slice(0, 5)

  const lembretesHoje = lembretes.filter(
    l => isToday(parseISO(l.data_lembrete))
  )

  async function concluirItem(id: string) {
    await concluirLembrete(id)
    setLembretes(prev => prev.filter(l => l.id !== id))
  }

  function formatarData(d: string) {
    const dt = parseISO(d)
    if (isToday(dt)) return 'Hoje'
    if (isTomorrow(dt)) return 'Amanhã'
    return format(dt, "dd 'de' MMM", { locale: ptBR })
  }

  const stats = [
    { label: 'Clientes', value: clientes.length, icon: Users, cor: 'bg-blue-500', href: '/clientes' },
    { label: 'Visitas Agendadas', value: visitas.filter(v => v.status === 'agendada').length, icon: CalendarCheck, cor: 'bg-indigo-500', href: '/visitas' },
    { label: 'Pedidos Ativos', value: pedidos.filter(p => !['entregue', 'cancelado'].includes(p.status)).length, icon: ShoppingCart, cor: 'bg-purple-500', href: '/pedidos' },
    { label: 'Follow-ups Pendentes', value: followupsPendentes.length, icon: Clock, cor: followupsPendentes.length > 0 ? 'bg-orange-500' : 'bg-green-500', href: '/visitas' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (erro) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-2xl">
        <h3 className="font-semibold text-red-800 mb-2">Erro ao conectar ao banco de dados</h3>
        <p className="text-red-600 text-sm font-mono">{erro}</p>
        <p className="text-gray-600 text-sm mt-3">
          As tabelas podem não ter sido criadas ainda. Execute o SQL em:{' '}
          <a
            href="https://supabase.com/dashboard/project/fplbyngnykagnodcvdjg/sql/new"
            target="_blank"
            rel="noreferrer"
            className="text-blue-600 underline"
          >
            Supabase SQL Editor
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm mt-1">
          {format(hoje, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Link
            key={s.label}
            href={s.href}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 ${s.cor} rounded-lg flex items-center justify-center mb-3`}>
              <s.icon size={20} className="text-white" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {meta ? (
          <MetaProgress meta={meta.valor_meta} realizado={realizado} mes={meta.mes} ano={meta.ano} />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-center">
            <Link href="/metas" className="text-blue-600 hover:underline text-sm">
              + Definir meta do mês
            </Link>
          </div>
        )}
        <AlertasFaturamento pedidos={pedidos} />
      </div>

      {followupsPendentes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-orange-600" />
            <h3 className="font-semibold text-orange-800">
              Follow-ups Pendentes ({followupsPendentes.length})
            </h3>
          </div>
          <div className="space-y-2">
            {followupsPendentes.map(v => (
              <Link
                key={v.id}
                href="/visitas"
                className="flex items-center justify-between bg-white border border-orange-100 rounded-lg px-3 py-2 hover:border-orange-300 transition-colors"
              >
                <div>
                  <span className="font-medium text-sm text-gray-800">{v.clientes?.empresa}</span>
                  <p className="text-xs text-gray-500">{v.proximo_passo || v.objetivo}</p>
                </div>
                <span className="text-orange-600 text-xs font-medium">
                  {formatarData(v.data_followup!)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={18} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800">Lembretes de Hoje</h3>
        </div>
        {lembretesHoje.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-2">Nenhum lembrete para hoje</p>
        ) : (
          <div className="space-y-2">
            {lembretesHoje.map(l => (
              <div key={l.id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm text-gray-800">{l.texto}</p>
                  {l.clientes && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {l.clientes.nome || l.clientes.empresa}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => concluirItem(l.id)}
                  className="ml-3 shrink-0 text-xs bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-3 py-1 rounded-lg"
                >
                  Concluir
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Próximas Visitas</h3>
            <Link href="/visitas" className="text-blue-600 text-sm hover:underline">Ver todas</Link>
          </div>
          {proximasVisitas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Nenhuma visita agendada</p>
          ) : (
            <div className="space-y-3">
              {proximasVisitas.map(v => (
                <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="text-center min-w-[40px]">
                    <p className="text-xs text-gray-400">
                      {format(parseISO(v.data_visita), 'MMM', { locale: ptBR }).toUpperCase()}
                    </p>
                    <p className="text-lg font-bold text-blue-600">
                      {format(parseISO(v.data_visita), 'dd')}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">{v.clientes?.empresa}</p>
                    <p className="text-xs text-gray-500 truncate">{v.objetivo}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-blue-600 font-medium truncate">{v.clientes?.nome}</span>
                      {v.clientes?.cidade && (
                        <span className="text-xs text-gray-400 truncate">· {v.clientes.cidade}</span>
                      )}
                    </div>
                    <div className="flex gap-1 mt-1 items-center">
                      <StatusBadge status={v.tipo} />
                      {v.hora_visita && <span className="text-xs text-gray-400 ml-1">— {v.hora_visita}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Pedidos Recentes</h3>
            <Link href="/pedidos" className="text-blue-600 text-sm hover:underline">Ver todos</Link>
          </div>
          {pedidosRecentes.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Nenhum pedido ainda</p>
          ) : (
            <div className="space-y-3">
              {pedidosRecentes.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-gray-800">{p.numero}</p>
                    <p className="text-xs text-gray-500 truncate">{p.clientes?.empresa}</p>
                  </div>
                  <div className="ml-3 text-right">
                    <StatusBadge status={p.status} />
                    <p className="text-xs text-gray-600 mt-1">
                      R$ {p.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
