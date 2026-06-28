import { NextRequest, NextResponse } from 'next/server'
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

async function extrairDadosDoPdf(pdfBase64: string): Promise<DadosOrcamento> {
  const prompt = `Extraia os dados deste orçamento da Delta Plus e retorne um JSON com exatamente estes campos:
{
  "numero_orcamento": "Número do orçamento",
  "razao_social": "Razão social do cliente",
  "nome_fantasia": "Nome fantasia do cliente",
  "cnpj": "CNPJ do cliente, somente dígitos ou formatado",
  "cidade": "Cidade do endereço do cliente/destinatário",
  "estado": "Sigla do estado (UF) do endereço do cliente, ex: SP, MT",
  "valor_total": 0,
  "transportadora": "Nome da transportadora indicada no orçamento. Procure por campos como 'Transportadora', 'Transp.' ou nomes de empresas de transporte/logística no documento. Se realmente não encontrar, retorne string vazia.",
  "condicao_pagamento": "Condição de pagamento (ex: 30/60 DDL)",
  "tipo_frete": "Tipo de frete (ex: CIF, FOB)",
  "data_orcamento": "Data do orçamento no formato YYYY-MM-DD",
  "itens": [
    { "codigo": "Código/referência do produto, se houver no documento (senão string vazia)", "produto": "Descrição/nome do item ou produto", "quantidade": 0, "preco_unitario": 0 }
  ]
}
valor_total deve ser um número. quantidade e preco_unitario devem ser números. Liste em "itens" TODOS os produtos/linhas do orçamento, na ordem em que aparecem.
IMPORTANTE: responda SOMENTE com o objeto JSON acima preenchido. Não transcreva o PDF, não inclua tabelas em texto, markdown ou qualquer explicação — apenas o JSON.`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 50_000)

  let response: Response
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: 'orcamento.pdf',
                  file_data: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('A extração do PDF demorou demais e foi cancelada (modelo gratuito sobrecarregado). Tente novamente em alguns minutos.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${errorText}`)
  }

  const json = await response.json()
  const text: string | undefined = json.choices?.[0]?.message?.content
  if (!text) throw new Error('O OpenRouter não retornou os dados extraídos do orçamento.')

  try {
    return JSON.parse(text) as DadosOrcamento
  } catch {
    // Alguns modelos envolvem o JSON em markdown ou texto extra mesmo com instrução contrária.
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0]) as DadosOrcamento
      } catch {
        // cai no erro abaixo
      }
    }
    throw new Error(`O modelo de IA não retornou um JSON válido. Tente novamente. Início da resposta: ${text.slice(0, 300)}`)
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
