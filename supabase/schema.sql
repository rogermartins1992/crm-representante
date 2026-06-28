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
  -- campos fluxo Delta Plus
  numero_orcamento text,
  razao_social text,
  nome_fantasia text,
  cnpj text,
  transportadora text,
  condicao_pagamento text,
  tipo_frete text,
  data_orcamento date,
  status_delta text check (status_delta in ('aguardando', 'confirmado', 'atrasado', 'faturado')),
  numero_nf text,
  data_faturamento_prevista date,
  data_faturamento_real date,
  thread_id_gmail text,
  prazo_alerta_horas integer default 48,
  -- campos captura automática DANFE/NF-e
  nf_numero text,
  nf_chave_acesso text,
  nf_data_emissao timestamptz,
  nf_status text default 'pendente' check (nf_status in ('pendente', 'capturada', 'erro')),
  nf_pdf_url text,
  -- campos pendência de GNRE (recolhimento de imposto na liberação da mercadoria)
  gnre_status text default 'nao_aplica' check (gnre_status in ('nao_aplica', 'aguardando_resposta', 'cliente_paga', 'liberado_sem_pagar')),
  gnre_perguntado_em timestamptz,
  gnre_respondido_em timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists itens_pedido (
  id uuid default gen_random_uuid() primary key,
  pedido_id uuid references pedidos(id) on delete cascade,
  codigo text,
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

create table if not exists lembretes (
  id uuid default gen_random_uuid() primary key,
  cliente_id uuid references clientes(id) on delete cascade,
  visita_id uuid references visitas(id) on delete set null,
  texto text not null,
  data_lembrete date not null,
  hora_lembrete time,
  concluido boolean default false,
  created_at timestamptz default now()
);

create table if not exists danfes_pendentes (
  id uuid default gen_random_uuid() primary key,
  nf_numero text,
  nf_chave_acesso text,
  nf_data_emissao timestamptz,
  cnpj text,
  razao_social text,
  valor_total numeric(12,2),
  transportadora text,
  pdf_url text,
  pedido_sugerido_id uuid references pedidos(id) on delete set null,
  status text default 'aguardando_confirmacao' check (status in ('aguardando_confirmacao', 'confirmada', 'rejeitada')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Storage: bucket público para os PDFs de DANFE ─────────
insert into storage.buckets (id, name, public)
values ('danfes', 'danfes', true)
on conflict (id) do nothing;

-- ── Desabilitar RLS (CRM pessoal, sem autenticação) ──────
-- Permite que a publishable key leia e grave dados

alter table clientes disable row level security;
alter table visitas disable row level security;
alter table pedidos disable row level security;
alter table itens_pedido disable row level security;
alter table metas disable row level security;
alter table lembretes disable row level security;
alter table danfes_pendentes disable row level security;

-- ── Permissões para a role anon ───────────────────────────
grant all on clientes to anon;
grant all on visitas to anon;
grant all on pedidos to anon;
grant all on itens_pedido to anon;
grant all on metas to anon;
grant all on lembretes to anon;
grant all on danfes_pendentes to anon;

-- ── Índices ───────────────────────────────────────────────
create index if not exists idx_visitas_cliente on visitas(cliente_id);
create index if not exists idx_visitas_data on visitas(data_visita);
create index if not exists idx_visitas_followup on visitas(data_followup) where followup_enviado = false;
create index if not exists idx_pedidos_cliente on pedidos(cliente_id);
create index if not exists idx_pedidos_status on pedidos(status);
create index if not exists idx_pedidos_faturamento on pedidos(data_pedido) where lembrete_faturamento_enviado = false;
create index if not exists idx_lembretes_cliente on lembretes(cliente_id);
create index if not exists idx_lembretes_data on lembretes(data_lembrete) where concluido = false;
create index if not exists idx_pedidos_nf_status on pedidos(nf_status) where nf_status = 'pendente';
create unique index if not exists idx_pedidos_nf_chave_acesso on pedidos(nf_chave_acesso) where nf_chave_acesso is not null;
create index if not exists idx_danfes_pendentes_cnpj on danfes_pendentes(cnpj);
create index if not exists idx_danfes_pendentes_status on danfes_pendentes(status) where status = 'aguardando_confirmacao';
create index if not exists idx_danfes_pendentes_pedido_sugerido on danfes_pendentes(pedido_sugerido_id);

-- ── Migração: adicionar hora_lembrete se a tabela já existe ──
-- Execute este bloco se a tabela lembretes já existia antes:
-- ALTER TABLE lembretes ADD COLUMN IF NOT EXISTS hora_lembrete time;

-- ── Migração: campos de orçamento Delta Plus em pedidos ──────
-- Execute este bloco se a tabela pedidos já existia antes:
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS razao_social text;
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nome_fantasia text;
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cnpj text;
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_frete text;
-- ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_orcamento date;

-- ── Migração: captura automática de DANFE/NF-e em pedidos ────
-- Execute este bloco no SQL Editor do Supabase para tabelas já existentes:
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nf_numero text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nf_chave_acesso text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nf_data_emissao timestamptz;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nf_status text default 'pendente';
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_nf_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_nf_status_check check (nf_status in ('pendente', 'capturada', 'erro'));
CREATE INDEX IF NOT EXISTS idx_pedidos_nf_status ON pedidos(nf_status) WHERE nf_status = 'pendente';
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_nf_chave_acesso ON pedidos(nf_chave_acesso) WHERE nf_chave_acesso IS NOT NULL;

-- ── Migração: tabela danfes_pendentes (DANFEs aguardando confirmação manual) ──
-- Execute este bloco no SQL Editor do Supabase:
CREATE TABLE IF NOT EXISTS danfes_pendentes (
  id uuid default gen_random_uuid() primary key,
  nf_numero text,
  nf_chave_acesso text,
  nf_data_emissao timestamptz,
  cnpj text,
  razao_social text,
  valor_total numeric(12,2),
  transportadora text,
  pdf_url text,
  pedido_sugerido_id uuid references pedidos(id) on delete set null,
  status text default 'aguardando_confirmacao' check (status in ('aguardando_confirmacao', 'confirmada', 'rejeitada')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
ALTER TABLE danfes_pendentes DISABLE ROW LEVEL SECURITY;
GRANT ALL ON danfes_pendentes TO anon;
CREATE INDEX IF NOT EXISTS idx_danfes_pendentes_cnpj ON danfes_pendentes(cnpj);
CREATE INDEX IF NOT EXISTS idx_danfes_pendentes_status ON danfes_pendentes(status) WHERE status = 'aguardando_confirmacao';
CREATE INDEX IF NOT EXISTS idx_danfes_pendentes_pedido_sugerido ON danfes_pendentes(pedido_sugerido_id);

-- ── Migração: PDF da DANFE (storage + colunas de URL) ────────
-- Execute este bloco no SQL Editor do Supabase:
ALTER TABLE danfes_pendentes ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nf_pdf_url text;
INSERT INTO storage.buckets (id, name, public)
VALUES ('danfes', 'danfes', true)
ON CONFLICT (id) DO NOTHING;

-- ── Migração: pendência de GNRE (recolhimento de imposto) ────
-- Execute este bloco no SQL Editor do Supabase:
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS gnre_status text default 'nao_aplica';
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_gnre_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_gnre_status_check check (gnre_status in ('nao_aplica', 'aguardando_resposta', 'cliente_paga', 'liberado_sem_pagar'));
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS gnre_perguntado_em timestamptz;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS gnre_respondido_em timestamptz;
CREATE INDEX IF NOT EXISTS idx_pedidos_gnre_aguardando ON pedidos(gnre_perguntado_em) WHERE gnre_status = 'aguardando_resposta';

-- ── Migração: simplifica GNRE para Sim/Não/Talvez ────────────
-- Execute este bloco no SQL Editor do Supabase:
UPDATE pedidos SET gnre_status = 'sim' WHERE gnre_status = 'cliente_paga';
UPDATE pedidos SET gnre_status = 'nao' WHERE gnre_status = 'liberado_sem_pagar';
UPDATE pedidos SET gnre_status = 'nao_aplica' WHERE gnre_status = 'aguardando_resposta';
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_gnre_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_gnre_status_check check (gnre_status in ('nao_aplica', 'sim', 'nao', 'talvez'));

-- ── Migração: código do item no pedido ───────────────────────
-- Execute este bloco no SQL Editor do Supabase:
ALTER TABLE itens_pedido ADD COLUMN IF NOT EXISTS codigo text;
