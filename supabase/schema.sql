-- CRM Representante EPI - Schema Supabase
-- Execute no SQL Editor: https://supabase.com/dashboard/project/fplbyngnykagnodcvdjg/sql/new

-- ── Tabelas ───────────────────────────────────────────────

create table if not exists clientes (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  empresa text not null,
  cnpj text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  estado text,
  segmento text,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists visitas (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references clientes(id) on delete cascade,
  data_visita date not null,
  hora_visita time,
  tipo text default 'presencial' check (tipo in ('presencial', 'remota', 'telefone')),
  status text default 'agendada' check (status in ('agendada', 'realizada', 'cancelada')),
  objetivo text,
  resultado text,
  proximo_passo text,
  data_followup date,
  followup_enviado boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists pedidos (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references clientes(id) on delete cascade,
  numero text unique not null,
  data_pedido date default current_date,
  valor_total numeric(12,2) not null default 0,
  status text default 'pendente' check (status in ('pendente', 'aprovado', 'em_producao', 'faturado', 'entregue', 'cancelado')),
  data_entrega_prevista date,
  data_faturamento date,
  lembrete_faturamento_enviado boolean default false,
  observacoes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists itens_pedido (
  id uuid default gen_random_uuid() primary key,
  pedido_id uuid references pedidos(id) on delete cascade,
  produto text not null,
  quantidade integer not null default 1,
  preco_unitario numeric(10,2) not null,
  subtotal numeric(12,2) generated always as (quantidade * preco_unitario) stored
);

create table if not exists metas (
  id uuid default gen_random_uuid() primary key,
  mes integer not null check (mes between 1 and 12),
  ano integer not null,
  valor_meta numeric(12,2) not null,
  created_at timestamptz default now(),
  unique (mes, ano)
);

-- ── Desabilitar RLS (CRM pessoal, sem autenticação) ──────
-- Permite que a publishable key leia e grave dados

alter table clientes disable row level security;
alter table visitas disable row level security;
alter table pedidos disable row level security;
alter table itens_pedido disable row level security;
alter table metas disable row level security;

-- ── Permissões para a role anon ───────────────────────────
grant all on clientes to anon;
grant all on visitas to anon;
grant all on pedidos to anon;
grant all on itens_pedido to anon;
grant all on metas to anon;

-- ── Índices ───────────────────────────────────────────────
create index if not exists idx_visitas_cliente on visitas(cliente_id);
create index if not exists idx_visitas_data on visitas(data_visita);
create index if not exists idx_visitas_followup on visitas(data_followup) where followup_enviado = false;
create index if not exists idx_pedidos_cliente on pedidos(cliente_id);
create index if not exists idx_pedidos_status on pedidos(status);
create index if not exists idx_pedidos_faturamento on pedidos(data_pedido) where lembrete_faturamento_enviado = false;
