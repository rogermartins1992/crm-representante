import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export function verifyWebhookSecret(request: NextRequest): NextResponse | null {
  const secret = process.env.MAKE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'MAKE_WEBHOOK_SECRET não configurado no servidor.' }, { status: 500 })
  }
  if (request.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }
  return null
}

// Aceita a chamada se vier do Make.com (chave secreta) OU de um usuário
// logado no app (sessão Supabase via cookies) — usado em rotas chamadas
// tanto pelo automation externo quanto por um botão dentro do CRM.
export async function verifyWebhookOrSession(request: NextRequest): Promise<NextResponse | null> {
  const secret = process.env.MAKE_WEBHOOK_SECRET
  if (secret && request.headers.get('x-webhook-secret') === secret) {
    return null
  }

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // Route handler não precisa atualizar cookies de resposta aqui.
        },
      },
    }
  )
  const { data: { user } } = await client.auth.getUser()
  if (user) return null

  return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
}
