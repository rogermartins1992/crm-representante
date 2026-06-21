function stripToAlnum(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

// Forma canônica para gravar/buscar no banco — CNPJ pode ter letras a partir de 2026 (Receita Federal).
export function normalizeCnpj(value: string | null | undefined): string {
  if (!value) return ''
  return stripToAlnum(value)
}

// Máscara de exibição XX.XXX.XXX/XXXX-XX. Devolve o valor original se não houver 14 caracteres alfanuméricos.
export function formatCnpj(value: string | null | undefined): string {
  if (!value) return ''
  const stripped = stripToAlnum(value)
  if (stripped.length !== 14) return value
  return `${stripped.slice(0, 2)}.${stripped.slice(2, 5)}.${stripped.slice(5, 8)}/${stripped.slice(8, 12)}-${stripped.slice(12, 14)}`
}
