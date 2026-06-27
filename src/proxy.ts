import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseProxyClient } from '@/lib/supabase-proxy'

// Rotas chamadas server-to-server pelo Make.com (autenticadas por chave
// secreta própria, x-webhook-secret, dentro da própria rota) — não fazem
// parte da sessão de usuário do Supabase, então ficam fora do proxy.
const PUBLIC_PATHS = ['/login', '/auth/callback', '/api/processar-pedido', '/api/processar-danfe']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const { client, response } = createSupabaseProxyClient(request)
  const { data: { user } } = await client.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-).*)'],
}
