import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Troca o "code" do OAuth (Google) por uma sessão, gravando os cookies de
// auth na resposta. Sem isso, o login com Google nunca fica "visível" para
// o proxy.ts (que roda no servidor e só lê cookies, não localStorage).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') || '/'

  if (code) {
    const response = NextResponse.redirect(new URL(redirectTo, origin))

    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
          },
        },
      }
    )

    await client.auth.exchangeCodeForSession(code)
    return response
  }

  return NextResponse.redirect(new URL('/login', origin))
}
