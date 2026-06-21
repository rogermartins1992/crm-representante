import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body = await request.json().catch(() => ({}))
    const pedidoIdManual: string | undefined = body.pedido_id

    const supabaseServer = getSupabaseServer()

    const { data: danfe, error: danfeError } = await supabaseServer
      .from('danfes_pendentes')
      .select('*')
      .eq('id', id)
      .single()
    if (danfeError) throw new Error(`[${danfeError.code}] ${danfeError.message}`)

    const pedidoId = pedidoIdManual || danfe.pedido_sugerido_id
    if (!pedidoId) {
      return NextResponse.json({ error: 'Nenhum pedido vinculado. Informe "pedido_id" para confirmar manualmente.' }, { status: 400 })
    }

    const { error: pedidoError } = await supabaseServer
      .from('pedidos')
      .update({
        nf_numero: danfe.nf_numero,
        nf_chave_acesso: danfe.nf_chave_acesso,
        nf_data_emissao: danfe.nf_data_emissao,
        nf_status: 'capturada',
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedidoId)
    if (pedidoError) throw new Error(`[${pedidoError.code}] ${pedidoError.message}`)

    const { data: danfeAtualizada, error: updateError } = await supabaseServer
      .from('danfes_pendentes')
      .update({
        status: 'confirmada',
        pedido_sugerido_id: pedidoId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, pedidos:pedido_sugerido_id(*, clientes(*))')
      .single()
    if (updateError) throw new Error(`[${updateError.code}] ${updateError.message}`)

    return NextResponse.json({ success: true, danfe: danfeAtualizada })
  } catch (err) {
    console.error('[danfes-pendentes/confirmar] erro:', err)
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao confirmar a DANFE.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
