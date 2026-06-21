import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const { data: danfe, error } = await getSupabaseServer()
      .from('danfes_pendentes')
      .update({ status: 'rejeitada', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(`[${error.code}] ${error.message}`)

    return NextResponse.json({ success: true, danfe })
  } catch (err) {
    console.error('[danfes-pendentes/rejeitar] erro:', err)
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao rejeitar a DANFE.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
