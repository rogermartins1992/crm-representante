import { supabase } from './supabase'
import type { Cliente, Visita, Pedido, Meta, ItemPedido, HistoricoPedido, DanfePendente } from './supabase'

// ── Clientes ──────────────────────────────────────────────

export async function getClientes(): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('empresa')
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
  return data ?? []
}

export async function createCliente(
  c: Partial<Omit<Cliente, 'id' | 'created_at' | 'updated_at'>>
): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .insert(c)
    .select()
    .single()
  if (error) {
    throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
  }
  return data
}

export async function updateCliente(id: string, c: Partial<Cliente>): Promise<void> {
  const { error } = await supabase
    .from('clientes')
    .update({ ...c, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
}

export async function deleteCliente(id: string): Promise<void> {
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
}

// ── Visitas ───────────────────────────────────────────────

export async function getVisitas(): Promise<Visita[]> {
  const { data, error } = await supabase
    .from('visitas')
    .select('*')
    .order('data_visita', { ascending: false })
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)

  const visitas = (data ?? []) as Omit<Visita, 'clientes'>[]
  const ids = [...new Set(visitas.map(v => v.cliente_id).filter(Boolean))]

  let clientes: { id: string; nome: string; empresa: string }[] = []
  if (ids.length > 0) {
    const { data: cd, error: ce } = await supabase.from('clientes').select('id, nome, empresa').in('id', ids)
    if (ce) throw new Error(`[${ce.code}] ${ce.message}`)
    clientes = cd ?? []
  }

  return visitas.map(v => ({ ...v, clientes: clientes.find(c => c.id === v.cliente_id) as Cliente | undefined }))
}

export async function createVisita(
  v: Omit<Visita, 'id' | 'created_at' | 'updated_at' | 'clientes'>
): Promise<Visita> {
  const { data, error } = await supabase
    .from('visitas')
    .insert(v)
    .select('*, clientes(*)')
    .single()
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
  return data
}

export async function updateVisita(id: string, v: Partial<Visita>): Promise<void> {
  const { error } = await supabase
    .from('visitas')
    .update({ ...v, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
}

// ── Pedidos ───────────────────────────────────────────────

export async function getPedidos(): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*, clientes!left(*)')
    .order('data_pedido', { ascending: false })
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
  return data ?? []
}

export async function createPedido(
  p: Omit<Pedido, 'id' | 'created_at' | 'updated_at' | 'clientes' | 'itens_pedido'>
): Promise<Pedido> {
  const { data, error } = await supabase
    .from('pedidos')
    .insert(p)
    .select('*, clientes(*)')
    .single()
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
  return data
}

export async function updatePedidoStatus(
  id: string,
  status: Pedido['status']
): Promise<void> {
  const update: Record<string, string> = { status, updated_at: new Date().toISOString() }
  if (status === 'faturado') update.data_faturamento = new Date().toISOString().split('T')[0]
  const { error } = await supabase.from('pedidos').update(update).eq('id', id)
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
}

export async function updatePedido(id: string, campos: Partial<Pedido>): Promise<void> {
  const { error } = await supabase
    .from('pedidos')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
}

export async function marcarLembreteEnviado(id: string): Promise<void> {
  const { error } = await supabase
    .from('pedidos')
    .update({ lembrete_faturamento_enviado: true, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
}

// ── Metas ─────────────────────────────────────────────────

export async function getMeta(mes: number, ano: number): Promise<Meta | null> {
  const { data, error } = await supabase
    .from('metas')
    .select('*')
    .eq('mes', mes)
    .eq('ano', ano)
    .maybeSingle()
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
  return data
}

export async function getMetas(): Promise<Meta[]> {
  const { data, error } = await supabase
    .from('metas')
    .select('*')
    .order('ano', { ascending: false })
    .order('mes', { ascending: false })
    .limit(12)
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
  return data ?? []
}

export async function upsertMeta(
  mes: number,
  ano: number,
  valor_meta: number
): Promise<void> {
  const { error } = await supabase
    .from('metas')
    .upsert({ mes, ano, valor_meta }, { onConflict: 'mes,ano' })
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
}

export async function getVendasMes(mes: number, ano: number): Promise<number> {
  const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('pedidos')
    .select('valor_total')
    .gte('data_pedido', inicioMes)
    .lte('data_pedido', fimMes)
    .in('status', ['aprovado', 'em_producao', 'faturado', 'entregue'])

  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
  return (data ?? []).reduce((s, p) => s + p.valor_total, 0)
}
// LEMBRETES
export async function getLembretes() {
  const { data, error } = await supabase
    .from('lembretes')
    .select('*')
    .eq('concluido', false)
    .order('data_lembrete', { ascending: true })
  if (error) throw error

  const lembretes = data ?? []
  const ids = [...new Set(lembretes.map(l => l.cliente_id).filter(Boolean))]

  let clientes: { id: string; nome: string; empresa: string }[] = []
  if (ids.length > 0) {
    const { data: cd, error: ce } = await supabase.from('clientes').select('id, nome, empresa').in('id', ids)
    if (ce) throw ce
    clientes = cd ?? []
  }

  return lembretes.map(l => ({ ...l, clientes: clientes.find(c => c.id === l.cliente_id) || null }))
}

export async function createLembrete(lembrete: {
  cliente_id: string
  visita_id?: string
  texto: string
  data_lembrete: string
  hora_lembrete?: string
}) {
  const { data, error } = await supabase
    .from('lembretes')
    .insert([lembrete])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateLembrete(id: string, data: {
  texto?: string
  data_lembrete?: string
  hora_lembrete?: string
}): Promise<void> {
  const { error } = await supabase
    .from('lembretes')
    .update(data)
    .eq('id', id)
  if (error) throw error
}

export async function deleteLembrete(id: string): Promise<void> {
  const { error } = await supabase
    .from('lembretes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function concluirLembrete(id: string) {
  const { error } = await supabase
    .from('lembretes')
    .update({ concluido: true })
    .eq('id', id)
  if (error) throw error
}

// ── Itens Pedido ──────────────────────────────────────────

export async function getItensPedido(pedido_id: string): Promise<ItemPedido[]> {
  const { data, error } = await supabase
    .from('itens_pedido')
    .select('*')
    .eq('pedido_id', pedido_id)
    .order('id')
  if (error) throw new Error(`[${error.code}] ${error.message}`)
  return data ?? []
}

export async function createItensPedido(
  items: Omit<ItemPedido, 'id' | 'subtotal'>[]
): Promise<void> {
  if (items.length === 0) return
  const { error } = await supabase.from('itens_pedido').insert(items)
  if (error) throw new Error(`[${error.code}] ${error.message}`)
}

// ── Histórico Pedido ──────────────────────────────────────

export async function getHistoricoPedido(pedido_id: string): Promise<HistoricoPedido[]> {
  const { data, error } = await supabase
    .from('historico_pedido')
    .select('*')
    .eq('pedido_id', pedido_id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[${error.code}] ${error.message}`)
  return data ?? []
}

export async function addHistoricoPedido(
  pedido_id: string,
  descricao: string,
  status_anterior?: string,
  status_novo?: string,
): Promise<void> {
  const { error } = await supabase
    .from('historico_pedido')
    .insert({ pedido_id, descricao, status_anterior, status_novo })
  if (error) throw new Error(`[${error.code}] ${error.message}`)
}

// ── DANFEs Pendentes ──────────────────────────────────────

export async function getDanfesPendentes(): Promise<DanfePendente[]> {
  const { data, error } = await supabase
    .from('danfes_pendentes')
    .select('*, pedidos:pedido_sugerido_id(*, clientes(*))')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
  return data ?? []
}
