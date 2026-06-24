import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { normalizeCnpj } from '@/lib/format'
import { verifyWebhookSecret } from '@/lib/verify-webhook-secret'

export const maxDuration = 60

type DadosDanfe = {
  nf_numero: string
  nf_chave_acesso: string
  nf_data_emissao: string
  cnpj_destinatario: string
  razao_social_destinatario: string
  valor_total: number
  transportadora: string
}

async function extrairDadosDoPdf(pdfBase64: string): Promise<DadosDanfe> {
  const prompt = `Extraia os dados desta DANFE (Documento Auxiliar da Nota Fiscal Eletrônica) e retorne um JSON com exatamente estes campos:
{
  "nf_numero": "Número da nota fiscal",
  "nf_chave_acesso": "Chave de acesso da NF-e, somente os 44 dígitos",
  "nf_data_emissao": "Data e hora de emissão no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss)",
  "cnpj_destinatario": "CNPJ do destinatário, somente dígitos ou formatado",
  "razao_social_destinatario": "Razão social do destinatário",
  "valor_total": 0,
  "transportadora": "Nome da transportadora indicada na DANFE"
}
valor_total deve ser um número. Retorne apenas o JSON, sem explicações.`

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'danfe.pdf',
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

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${errorText}`)
  }

  const json = await response.json()
  const text: string | undefined = json.choices?.[0]?.message?.content
  if (!text) throw new Error('O OpenRouter não retornou os dados extraídos da DANFE.')

  return JSON.parse(text) as DadosDanfe
}

async function uploadPdf(buffer: Buffer): Promise<string | null> {
  const fileName = `${Date.now()}-${randomUUID()}.pdf`
  const { error } = await getSupabaseServer().storage
    .from('danfes')
    .upload(fileName, buffer, { contentType: 'application/pdf' })
  if (error) {
    console.error('[processar-danfe] erro ao subir PDF no storage:', error)
    return null
  }
  const { data } = getSupabaseServer().storage.from('danfes').getPublicUrl(fileName)
  return data.publicUrl
}

async function buscarPedidoSugerido(cnpj: string): Promise<string | null> {
  if (!cnpj) return null

  const { data, error } = await getSupabaseServer()
    .from('pedidos')
    .select('id')
    .eq('cnpj', cnpj)
    .neq('status', 'cancelado')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`[${error.code}] ${error.message}`)
  return data?.id ?? null
}

export async function POST(request: NextRequest) {
  const authError = verifyWebhookSecret(request)
  if (authError) return authError

  let buffer: Buffer
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

    buffer = Buffer.from(await file.arrayBuffer())
    pdfBase64 = buffer.toString('base64')
  } catch {
    return NextResponse.json({ error: 'Erro ao processar o arquivo enviado.' }, { status: 400 })
  }

  try {
    const [dados, pdfUrl] = await Promise.all([
      extrairDadosDoPdf(pdfBase64),
      uploadPdf(buffer),
    ])
    const cnpj = normalizeCnpj(dados.cnpj_destinatario)
    const pedidoSugeridoId = await buscarPedidoSugerido(cnpj)

    const { data: danfe, error: insertError } = await getSupabaseServer()
      .from('danfes_pendentes')
      .insert({
        nf_numero: dados.nf_numero,
        nf_chave_acesso: dados.nf_chave_acesso,
        nf_data_emissao: dados.nf_data_emissao,
        cnpj,
        razao_social: dados.razao_social_destinatario,
        valor_total: dados.valor_total,
        transportadora: dados.transportadora,
        pdf_url: pdfUrl,
        pedido_sugerido_id: pedidoSugeridoId,
        status: 'aguardando_confirmacao',
      })
      .select('*, pedidos:pedido_sugerido_id(*)')
      .single()
    if (insertError) {
      throw new Error(`[${insertError.code}] ${insertError.message}${insertError.details ? ' — ' + insertError.details : ''}`)
    }

    return NextResponse.json({ success: true, danfe }, { status: 201 })
  } catch (err) {
    console.error('[processar-danfe] erro:', err)
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao processar a DANFE.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
