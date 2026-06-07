import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

// Cliente com service role — uso restrito a API routes / código server-side.
// Instanciado sob demanda para não falhar a coleta de dados de build do Next.js
// quando as variáveis de ambiente ainda não estão disponíveis.
export function getSupabaseServer(): SupabaseClient {
  if (!client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    client = createClient(supabaseUrl, serviceRoleKey)
  }
  return client
}
