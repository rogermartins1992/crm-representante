import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, SchemaType, ObjectSchema } from '@google/generative-ai'
import { getSupabaseServer } from '@/lib/supabase-server'
import { normalizeCnpj } from '@/lib/format'
import { verifyWebhookOrSession } from '@/lib/verify-webhook-secret'

export const maxDuration = 60

type ItemOrcamento = {
  codigo: string
  produto: string
  quantidade: number
  preco_unitario: number
}

type DadosOrcamento = {
  numero_orcamento: string
  razao_social: string
  nome_fantasia: string
  cnpj: string
  cidade: string
  estado: string
  valor_total: number
  transportadora: string
  condicao_pagamento: string
  tipo_frete: string
  data_orcamento: string
  itens: ItemOrcamento[]
}

const ITEM_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    codigo: { type: SchemaType.STRING, description: 'Código/referência do produto, se houver. Senão, string vazia.' },
    produto: { type: SchemaType.STRING, description: 'Descrição/nome do item' },
    quantidade: { type: SchemaType.NUMBER, description: 'Quantidade do item' },
    preco_unitario: { type: SchemaType.NUMBER, description: 'Preço unitário do item, em reais' },
  },
  required: ['produto', 'quantidade', 'preco_unitario'],
}

const RESPONSE_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    numero_orcamento: { type: SchemaType.STRING, description: 'Número do orçamento' },
    razao_social: { type: SchemaType.STRING, description: 'Razão social do cliente' },
    nome_fantasia: { type: SchemaType.STRING, description: 'Nome fantasia do cliente' },
    cnpj: { type: SchemaType.STRING, description: 'CNPJ do cliente, somente dígitos ou formatado' },
    cidade: { type: SchemaType.STRING, description: 'Cidade do endereço do cliente/destinatário' },
    estado: { type: SchemaType.STRING, description: 'Sigla do estado (UF) do endereço do cliente, ex: SP, MT' },
    valor_total: { type: SchemaType.NUMBER, description: 'Valor total do orçamento, em reais' },
    transportadora: { type: SchemaType.STRING, description: 'Nome da transportadora indicada no orçamento' },
    condicao_pagamento: { type: SchemaType.STRING, description: 'Condição de pagamento (ex: 30/60 DDL)' },
    tipo_frete: { type: SchemaType.STRING, description: 'Tipo de frete (ex: CIF, FOB)' },
    data_orcamento: { type: SchemaType.STRING, description: 'Data do orçamento no formato YYYY-MM-DD' },
    itens: { type: SchemaType.ARRAY, items: ITEM_SCHEMA, description: 'Todos os produtos/linhas do orçamento, na ordem em que aparecem' },
  },
  required: [
    'numero_orcamento', 'razao_social', 'nome_fantasia', 'cnpj', 'valor_total',
    'transportadora', 'condicao_pagamento', 'tipo_frete', 'data_orcamento', 'itens',
  ],
}

async function extrairDadosDoPdf(pdfBase64: string): Promise<DadosOrcamento> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  })

  const result = await Promise.race([
    model.generateContent([
      { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
      { text: 'Extraia os dados deste orçamento da Delta Plus conforme o schema fornecido. Procure cuidadosamente por cidade/estado do destinatário e pelo nome da transportadora no documento.' },
    ]),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('A extração do PDF demorou demais e foi cancelada. Tente novamente.')), 50_000)
    ),
  ])

  const text = result.response.text()
  if (!text) throw new Error('O Gemini não retornou os dados extraídos do orçamento.')

  try {
    return JSON.parse(text) as DadosOrcamento
  } catch {
    throw new Error(`O Gemini não retornou um JSON válido. Início da resposta: ${text.slice(0, 300)}`)
  }
}

async function buscarOuCriarCliente(dados: DadosOrcamento): Promise<string | null> {
  if (!dados.cnpj) return null

  const supabaseServer = getSupabaseServer()
  const { data: existente, error: buscaError } = await supabaseServer
    .from('clientes')
    .select('id, cidade, estado')
    .eq('cnpj', dados.cnpj)
    .maybeSingle()
  if (buscaError) throw new Error(`[${buscaError.code}] ${buscaError.message}`)
  if (existente) {
    if (!existente.cidade && (dados.cidade || dados.estado)) {
      await supabaseServer
        .from('clientes')
        .update({ cidade: dados.cidade || undefined, estado: dados.estado || undefined })
        .eq('id', existente.id)
    }
    return existente.id
  }

  const { data: novo, error: criaError } = await supabaseServer
    .from('clientes')
    .insert({
      nome: dados.nome_fantasia || dados.razao_social,
      empresa: dados.razao_social,
      cnpj: dados.cnpj,
      cidade: dados.cidade || undefined,
      estado: dados.estado || undefined,
    })
    .select('id')
    .single()
  if (criaError) throw new Error(`[${criaError.code}] ${criaError.message}`)
  return novo.id
}

export async function POST(request: NextRequest) {
  const authError = await verifyWebhookOrSession(request)
  if (authError) return authError

  let pdfBase64: string

  try {
    const formData = await request.formData()
    const file = formData.get('attachment')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Campo "attachment" com arquivo PDF é obrigatório.' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'O arquivo enviado precisa ser um PDF (application/pdf).' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    pdfBase64 = buffer.toString('base64')
  } catch {
    return NextResponse.json({ error: 'Erro ao processar o arquivo enviado.' }, { status: 400 })
  }

  try {
    const dados = await extrairDadosDoPdf(pdfBase64)
    dados.cnpj = normalizeCnpj(dados.cnpj)
    const clienteId = await buscarOuCriarCliente(dados)

    const { data: pedido, error: insertError } = await getSupabaseServer()
      .from('pedidos')
      .insert({
        cliente_id: clienteId,
        numero: dados.numero_orcamento,
        valor_total: dados.valor_total,
        numero_orcamento: dados.numero_orcamento,
        razao_social: dados.razao_social,
        nome_fantasia: dados.nome_fantasia,
        cnpj: dados.cnpj,
        transportadora: dados.transportadora,
        condicao_pagamento: dados.condicao_pagamento,
        tipo_frete: dados.tipo_frete,
        data_orcamento: dados.data_orcamento,
        status_delta: 'aguardando',
      })
      .select('*, clientes(*)')
      .single()
    if (insertError) {
      throw new Error(`[${insertError.code}] ${insertError.message}${insertError.details ? ' — ' + insertError.details : ''}`)
    }

    const itensValidos = (dados.itens ?? []).filter(i => i.produto?.trim() && i.quantidade > 0)
    if (itensValidos.length > 0) {
      const { error: itensError } = await getSupabaseServer()
        .from('itens_pedido')
        .insert(itensValidos.map(i => ({
          pedido_id: pedido.id,
          codigo: i.codigo || undefined,
          produto: i.produto,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario ?? 0,
        })))
      if (itensError) console.error('[processar-pedido] erro ao gravar itens:', itensError)
    }

    return NextResponse.json({ success: true, pedido }, { status: 201 })
  } catch (err) {
    console.error('[processar-pedido] erro:', err)
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao processar o pedido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
