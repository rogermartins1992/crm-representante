// Dados mock para desenvolvimento sem Supabase configurado
import type { Cliente, Visita, Pedido, Meta } from './supabase'

export const mockClientes: Cliente[] = [
  {
    id: '1',
    nome: 'João Silva',
    empresa: 'Construções ABC Ltda',
    cnpj: '12.345.678/0001-99',
    telefone: '(11) 99999-1111',
    email: 'joao@abc.com.br',
    cidade: 'São Paulo',
    estado: 'SP',
    segmento: 'Construção Civil',
    observacoes: 'Cliente fiel, compra regularmente capacetes e botas.',
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z',
  },
  {
    id: '2',
    nome: 'Maria Santos',
    empresa: 'Metalúrgica Delta S.A.',
    cnpj: '98.765.432/0001-11',
    telefone: '(11) 98888-2222',
    email: 'maria@delta.com.br',
    cidade: 'Santo André',
    estado: 'SP',
    segmento: 'Metalurgia',
    observacoes: 'Necessita luvas e óculos de proteção mensalmente.',
    created_at: '2025-02-01T10:00:00Z',
    updated_at: '2025-02-01T10:00:00Z',
  },
  {
    id: '3',
    nome: 'Carlos Pereira',
    empresa: 'Agro Segura Fazenda',
    cnpj: '55.444.333/0001-22',
    telefone: '(17) 97777-3333',
    email: 'carlos@agrosegura.com.br',
    cidade: 'Ribeirão Preto',
    estado: 'SP',
    segmento: 'Agronegócio',
    created_at: '2025-03-10T10:00:00Z',
    updated_at: '2025-03-10T10:00:00Z',
  },
]

export const mockVisitas: Visita[] = [
  {
    id: '1',
    cliente_id: '1',
    data_visita: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    hora_visita: '10:00',
    tipo: 'presencial',
    status: 'agendada',
    objetivo: 'Apresentar linha nova de capacetes CA aprovado',
    proximo_passo: 'Enviar proposta de preço',
    data_followup: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    followup_enviado: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    clientes: mockClientes[0],
  },
  {
    id: '2',
    cliente_id: '2',
    data_visita: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    hora_visita: '14:30',
    tipo: 'presencial',
    status: 'realizada',
    objetivo: 'Renovação de contrato anual',
    resultado: 'Cliente aceitou renovar com desconto de 5%',
    proximo_passo: 'Enviar contrato por e-mail',
    data_followup: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    followup_enviado: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    clientes: mockClientes[1],
  },
  {
    id: '3',
    cliente_id: '3',
    data_visita: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    tipo: 'telefone',
    status: 'realizada',
    objetivo: 'Prospecção inicial',
    resultado: 'Interesse em protetores auriculares e luvas',
    data_followup: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    followup_enviado: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    clientes: mockClientes[2],
  },
]

export const mockPedidos: Pedido[] = [
  {
    id: '1',
    cliente_id: '1',
    numero: 'PED-2026-001',
    data_pedido: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    valor_total: 4500.0,
    status: 'aprovado',
    data_entrega_prevista: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    lembrete_faturamento_enviado: false,
    observacoes: 'Urgente para obra em andamento',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    clientes: mockClientes[0],
  },
  {
    id: '2',
    cliente_id: '2',
    numero: 'PED-2026-002',
    data_pedido: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
    valor_total: 12300.5,
    status: 'em_producao',
    data_entrega_prevista: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    lembrete_faturamento_enviado: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    clientes: mockClientes[1],
  },
  {
    id: '3',
    cliente_id: '3',
    numero: 'PED-2026-003',
    data_pedido: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0],
    valor_total: 2800.0,
    status: 'faturado',
    data_faturamento: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    lembrete_faturamento_enviado: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    clientes: mockClientes[2],
  },
  {
    id: '4',
    cliente_id: '1',
    numero: 'PED-2026-004',
    data_pedido: new Date().toISOString().split('T')[0],
    valor_total: 7650.0,
    status: 'pendente',
    lembrete_faturamento_enviado: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    clientes: mockClientes[0],
  },
]

export const mockMeta: Meta = {
  id: '1',
  mes: new Date().getMonth() + 1,
  ano: new Date().getFullYear(),
  valor_meta: 50000,
  created_at: new Date().toISOString(),
}

export const getMockVendasMes = () => {
  const mes = new Date().getMonth() + 1
  const ano = new Date().getFullYear()
  return mockPedidos
    .filter(p => {
      const d = new Date(p.data_pedido)
      return (
        d.getMonth() + 1 === mes &&
        d.getFullYear() === ano &&
        ['aprovado', 'em_producao', 'faturado', 'entregue'].includes(p.status)
      )
    })
    .reduce((sum, p) => sum + p.valor_total, 0)
}
