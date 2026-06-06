const configs: Record<string, { label: string; cls: string }> = {
  // Visitas
  agendada:    { label: 'Agendada',           cls: 'bg-blue-100 text-blue-700' },
  realizada:   { label: 'Realizada',          cls: 'bg-green-100 text-green-700' },
  cancelada:   { label: 'Cancelada',          cls: 'bg-red-100 text-red-700' },
  // Pedidos
  pendente:    { label: 'Ag. Confirmação',    cls: 'bg-gray-100 text-gray-700' },
  aprovado:    { label: 'Confirmado',         cls: 'bg-blue-100 text-blue-700' },
  em_producao: { label: 'Em Produção',        cls: 'bg-yellow-100 text-yellow-700' },
  faturado:    { label: 'Faturado',           cls: 'bg-purple-100 text-purple-700' },
  entregue:    { label: 'Entregue',           cls: 'bg-green-100 text-green-700' },
  cancelado:   { label: 'Cancelado',          cls: 'bg-red-100 text-red-700' },
  // Tipo visita
  presencial:  { label: 'Presencial',         cls: 'bg-indigo-100 text-indigo-700' },
  remota:      { label: 'Remota',             cls: 'bg-cyan-100 text-cyan-700' },
  telefone:    { label: 'Telefone',           cls: 'bg-orange-100 text-orange-700' },
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg = configs[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
