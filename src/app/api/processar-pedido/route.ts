import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

async function fetchGmailAttachment(messageId: string, attachmentId: string): Promise<string> {
  const cookieStore = await cookies()
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { session } } = await supabaseServer.auth.getSession()
  if (!session?.provider_token) {
    throw new Error('Token do Google não disponível — faça login novamente com sua conta Google')
  }

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${session.provider_token}` } }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Gmail API ${res.status}: ${body}`)
  }

  const json = await res.json() as { data: string; size: number }
  // Gmail retorna base64url; Gemini espera base64 padrão
  return json.data.replace(/-/g, '+').replace(/_/g, '/')
}

const PROMPT = `Analise este PDF de pedido/orçamento da Delta Plus e extraia os dados em JSON.
Retorne APENAS o JSON, sem markdown, sem explicações.

Formato esperado:
{
  "numero_orcamento": "string ou null",
  "data_orcamento": "YYYY-MM-DD ou null",
  "data_entrega_prevista": "YYYY-MM-DD ou null",
  "condicao_pagamento": "string ou null",
  "transportadora": "string ou null",
  "valor_total": number,
  "itens": [
    {
      "produto": "referência + descrição completa",
      "quantidade": number,
      "preco_unitario": number
    }
  ],
  "observacoes": "string ou null"
}

Regras:
- Datas sempre no formato YYYY-MM-DD
- Valores monetários como número (ex: 1234.56, sem R$ ou vírgulas)
- Se um campo não existir no PDF, use null
- Inclua todos os itens da tabela de produtos/materiais`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { messageId, attachmentId, cliente_id } = body as {
      messageId?: string
      attachmentId?: string
      cliente_id?: string
    }

    if (!messageId || !attachmentId) {
      return Response.json(
        { error: 'Informe messageId e attachmentId' },
        { status: 400 }
      )
    }

    let pdfData: string
    try {
      pdfData = await fetchGmailAttachment(messageId, attachmentId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return Response.json({ error: msg }, { status: 401 })
    }

    // Chama Gemini com o PDF inline
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
    const result = await model.generateContent([
      PROMPT,
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfData,
        },
      },
    ])

    const raw = result.response.text().trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

    let extraido: {
      numero_orcamento: string | null
      data_orcamento: string | null
      data_entrega_prevista: string | null
      condicao_pagamento: string | null
      transportadora: string | null
      valor_total: number
      itens: { produto: string; quantidade: number; preco_unitario: number }[]
      observacoes: string | null
    }

    try {
      extraido = JSON.parse(raw)
    } catch {
      return Response.json({ error: 'Gemini retornou JSON inválido', raw }, { status: 422 })
    }

    // Sem cliente_id → devolve só a extração para o frontend decidir
    if (!cliente_id) {
      return Response.json({ extraido, pedido: null, aviso: 'cliente_id não informado — pedido não salvo' })
    }

    // Gera número do pedido
    const numero = `PED-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
    const data_pedido = new Date().toISOString().split('T')[0]
    const valor_total = extraido.valor_total || extraido.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)

    // Salva pedido
    const { data: pedido, error: errPedido } = await supabase
      .from('pedidos')
      .insert({
        cliente_id,
        numero,
        data_pedido,
        data_orcamento: extraido.data_orcamento ?? undefined,
        valor_total,
        status: 'pendente',
        lembrete_faturamento_enviado: false,
        numero_orcamento: extraido.numero_orcamento ?? undefined,
        transportadora: extraido.transportadora ?? undefined,
        condicao_pagamento: extraido.condicao_pagamento ?? undefined,
        data_entrega_prevista: extraido.data_entrega_prevista ?? undefined,
        observacoes: extraido.observacoes ?? undefined,
        status_delta: 'aguardando',
      })
      .select('*, clientes(*)')
      .single()

    if (errPedido) {
      return Response.json({ error: errPedido.message, extraido }, { status: 500 })
    }

    // Salva itens
    if (extraido.itens.length > 0) {
      const { error: errItens } = await supabase.from('itens_pedido').insert(
        extraido.itens.map(i => ({
          pedido_id: pedido.id,
          produto: i.produto,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
        })),
      )
      if (errItens) {
        console.error('Erro ao salvar itens:', errItens.message)
      }
    }

    // Histórico
    await supabase.from('historico_pedido').insert({
      pedido_id: pedido.id,
      descricao: 'Pedido criado via leitura de PDF (Gemini)',
    })

    return Response.json({ extraido, pedido })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: msg }, { status: 500 })
  }
}
