import { NextRequest, NextResponse } from 'next/server'

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
