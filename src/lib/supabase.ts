import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type Cliente = {
  id: string
  nome: string
  empresa: string
  cnpj?: string
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  segmento?: string
  observacoes?: string
  created_at: string
  updated_at: string
}

export type Visita = {
  id: string
  cliente_id: string
  data_visita: string
  hora_visita?: string
  tipo: 'presencial' | 'remota' | 'telefone'
  status: 'agendada' | 'realizada' | 'cancelada'
  objetivo?: string
  resultado?: string
  proximo_passo?: string
  data_followup?: string
  followup_enviado: boolean
  created_at: string
  updated_at: string
  clientes?: Cliente
}

export type Pedido = {
  id: string
  cliente_id: string
  numero: string
  data_pedido: string
  valor_total: number
  status: 'pendente' | 'aprovado' | 'em_producao' | 'faturado' | 'entregue' | 'cancelado'
  data_entrega_prevista?: string
  data_faturamento?: string
  lembrete_faturamento_enviado: boolean
  observacoes?: string
  created_at: string
  updated_at: string
  clientes?: Cliente
  itens_pedido?: ItemPedido[]
}

export type ItemPedido = {
  id: string
  pedido_id: string
  produto: string
  quantidade: number
  preco_unitario: number
  subtotal: number
}

export type HistoricoPedido = {
  id: string
  pedido_id: string
  descricao: string
  status_anterior?: string
  status_novo?: string
  created_at: string
}

export type Meta = {
  id: string
  mes: number
  ano: number
  valor_meta: number
  created_at: string
}
