import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, SchemaType, ObjectSchema } from '@google/generative-ai'
import { getSupabaseServer } from '@/lib/supabase-server'

export const maxDuration = 60

const RESPONSE_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    numero_orcamento: { type: SchemaType.STRING, description: 'Número do orçamento' },
    razao_social: { type: SchemaType.STRING, description: 'Razão social do cliente' },
    nome_fantasia: { type: SchemaType.STRING, description: 'Nome fantasia do cliente' },
    cnpj: { type: SchemaType.STRING, description: 'CNPJ do cliente, somente dígitos ou formatado' },
    valor_total: { type: SchemaType.NUMBER, description: 'Valor total do orçamento, em reais' },
    transportadora: { type: SchemaType.STRING, description: 'Transportadora indicada no orçamento' },
    condicao_pagamento: { type: SchemaType.STRING, description: 'Condição de pagamento (ex: 30/60 DDL)' },
    tipo_frete: { type: SchemaType.STRING, description: 'Tipo de frete (ex: CIF, FOB)' },
    data_orcamento: { type: SchemaType.STRING, description: 'Data do orçamento no formato YYYY-MM-DD' },
  },
  required: [
    'numero_orcamento',
    'razao_social',
    'nome_fantasia',
    'cnpj',
    'valor_total',
    'transportadora',
    'condicao_pagamento',
    'tipo_frete',
    'data_orcamento',
  ],
}

type DadosOrcamento = {
  numero_orcamento: string
  razao_social: string
  nome_fantasia: string
  cnpj: string
  valor_total: number
  transportadora: string
  condicao_pagamento: string
  tipo_frete: string
  data_orcamento: string
}

async function extrairDadosDoPdf(pdfBase64: string): Promise<DadosOrcamento> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  })

  const result = await model.generateContent([
    { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
    { text: 'Extraia os dados deste orçamento da Delta Plus conforme o schema fornecido.' },
  ])

  const text = result.response.text()
  if (!text) throw new Error('O Gemini não retornou os dados extraídos do orçamento.')

  return JSON.parse(text) as DadosOrcamento
}

async function buscarOuCriarCliente(dados: DadosOrcamento): Promise<string | null> {
  if (!dados.cnpj) return null

  const supabaseServer = getSupabaseServer()
  const { data: existente, error: buscaError } = await supabaseServer
    .from('clientes')
    .select('id')
    .eq('cnpj', dados.cnpj)
    .maybeSingle()
  if (buscaError) throw new Error(`[${buscaError.code}] ${buscaError.message}`)
  if (existente) return existente.id

  const { data: novo, error: criaError } = await supabaseServer
    .from('clientes')
    .insert({
      nome: dados.nome_fantasia || dados.razao_social,
      empresa: dados.razao_social,
      cnpj: dados.cnpj,
    })
    .select('id')
    .single()
  if (criaError) throw new Error(`[${criaError.code}] ${criaError.message}`)
  return novo.id
}

export async function POST(request: NextRequest) {
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
      .select('id')
      .single()
    if (insertError) {
      throw new Error(`[${insertError.code}] ${insertError.message}${insertError.details ? ' — ' + insertError.details : ''}`)
    }

    return NextResponse.json({ success: true, pedido_id: pedido.id }, { status: 201 })
  } catch (err) {
    console.error('[processar-pedido] erro:', err)
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao processar o pedido.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
