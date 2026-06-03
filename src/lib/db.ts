import { supabase } from './supabase'
import type { Cliente, Visita, Pedido, Meta } from './supabase'

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
  c: Pick<Cliente, 'nome'> & Partial<Omit<Cliente, 'id' | 'nome' | 'created_at' | 'updated_at'>>
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
    .select('*, clientes(*)')
    .order('data_visita', { ascending: false })
  if (error) throw new Error(`[${error.code}] ${error.message}${error.details ? ' — ' + error.details : ''}`)
  return data ?? []
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
    .select('*, clientes(*)')
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
  const { error } = await supabase
    .from('pedidos')
    .update({ status, updated_at: new Date().toISOString() })
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
