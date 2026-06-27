import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente usado em Client Components. Guarda a sessão em cookies (em vez de
// localStorage) para que o proxy.ts (server-side) também consiga ler se o
// usuário está autenticado e proteger as rotas.
export const supabase = createBrowserClient(supabaseUrl, supabaseKey)

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
  // campos fluxo Delta Plus
  numero_orcamento?: string
  razao_social?: string
  nome_fantasia?: string
  cnpj?: string
  transportadora?: string
  condicao_pagamento?: string
  tipo_frete?: string
  data_orcamento?: string
  status_delta?: 'aguardando' | 'confirmado' | 'atrasado' | 'faturado'
  numero_nf?: string
  data_faturamento_prevista?: string
  data_faturamento_real?: string
  thread_id_gmail?: string
  prazo_alerta_horas?: number
  // campos captura automática DANFE/NF-e
  nf_numero?: string
  nf_chave_acesso?: string
  nf_data_emissao?: string
  nf_status?: 'pendente' | 'capturada' | 'erro'
  nf_pdf_url?: string
  // campos pendência de GNRE (recolhimento de imposto na liberação da mercadoria)
  gnre_status?: 'nao_aplica' | 'aguardando_resposta' | 'cliente_paga' | 'liberado_sem_pagar'
  gnre_perguntado_em?: string
  gnre_respondido_em?: string
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

export type DanfePendente = {
  id: string
  nf_numero?: string
  nf_chave_acesso?: string
  nf_data_emissao?: string
  cnpj?: string
  razao_social?: string
  valor_total?: number
  transportadora?: string
  pdf_url?: string
  pedido_sugerido_id?: string
  status: 'aguardando_confirmacao' | 'confirmada' | 'rejeitada'
  created_at: string
  updated_at: string
  pedidos?: Pedido
}
