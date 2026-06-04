'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, Phone, Mail, Building2, MapPin, Trash2, X, Upload, CheckCircle, AlertCircle } from 'lucide-react'
import { getClientes, createCliente, deleteCliente } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/lib/supabase'

const segmentos = [
  'Construção Civil', 'Metalurgia', 'Agronegócio', 'Química', 'Mineração',
  'Logística', 'Alimentício', 'Saúde', 'Serviços', 'Outro',
]
const estados = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'GO', 'DF', 'ES', 'CE', 'PE', 'MT', 'MS', 'PA', 'AM']

function ClienteModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (c: Partial<Cliente>) => void
}) {
  const [form, setForm] = useState<Partial<Cliente>>({})
  const [saving, setSaving] = useState(false)

  function set(k: keyof Cliente, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSave() {
    if (!form.nome || !form.empresa) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Novo Cliente</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Contato *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: João Silva"
                value={form.nome || ''}
                onChange={e => set('nome', e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa *</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Razão Social"
                value={form.empresa || ''}
                onChange={e => set('empresa', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="00.000.000/0001-00"
                value={form.cnpj || ''}
                onChange={e => set('cnpj', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.segmento || ''}
                onChange={e => set('segmento', e.target.value)}
              >
                <option value="">Selecione...</option>
                {segmentos.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(11) 99999-9999"
                value={form.telefone || ''}
                onChange={e => set('telefone', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="contato@empresa.com.br"
                value={form.email || ''}
                onChange={e => set('email', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.cidade || ''}
                onChange={e => set('cidade', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.estado || ''}
                onChange={e => set('estado', e.target.value)}
              >
                <option value="">UF</option>
                {estados.map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                value={form.observacoes || ''}
                onChange={e => set('observacoes', e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!form.nome || !form.empresa || saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar Cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

type ResultadoImport = { ok: number; erros: number; ultimoErro?: string }

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [busca, setBusca] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImport | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getClientes().then(data => { setClientes(data); setLoading(false) })
  }, [])

  const filtrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.empresa.toLowerCase().includes(busca.toLowerCase()) ||
    (c.segmento || '').toLowerCase().includes(busca.toLowerCase()) ||
    (c.cidade || '').toLowerCase().includes(busca.toLowerCase())
  )

  async function salvar(form: Partial<Cliente>) {
    const novo = await createCliente({
      nome: form.nome!,
      empresa: form.empresa!,
      cnpj: form.cnpj,
      telefone: form.telefone,
      email: form.email,
      endereco: form.endereco,
      cidade: form.cidade,
      estado: form.estado,
      segmento: form.segmento,
      observacoes: form.observacoes,
    })
    setClientes(prev => [novo, ...prev])
  }

  async function remover(id: string) {
    if (!confirm('Remover este cliente?')) return
    await deleteCliente(id)
    setClientes(prev => prev.filter(c => c.id !== id))
  }

  async function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = ''
    if (!file) return

    setImportando(true)
    setResultado(null)

    try {
      // Diagnóstico: ver colunas reais da tabela no Supabase
      const { data: amostra, error: errAmostra } = await supabase.from('clientes').select('*').limit(1)
      console.log('[Import] Colunas da tabela clientes:',
        errAmostra ? `ERRO: ${errAmostra.message}` : Object.keys(amostra?.[0] ?? {}).join(', ') || '(tabela vazia — sem linhas para inspecionar)')

      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      console.log('[Import] Linhas lidas:', rows.length)
      if (rows.length > 0) console.log('[Import] Primeira linha (raw):', rows[0])

      const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
      const str = (v: unknown) => String(v ?? '').trim()

      let ok = 0
      let erros = 0
      let ultimoErro: string | undefined

      for (const row of rows) {
        const col = Object.fromEntries(
          Object.entries(row).map(([k, v]) => [norm(k), str(v)])
        )

        const nome = col['nome']
        if (!nome) { erros++; continue }

        const payload: Parameters<typeof createCliente>[0] = {
          nome,
          ...(col['telefone'] && { telefone: col['telefone'] }),
          ...(col['cidade']   && { cidade:   col['cidade']   }),
          ...(col['segmento'] && { segmento: col['segmento'] }),
        }
        console.log('[Import] Payload:', payload)

        try {
          const novo = await createCliente(payload)
          setClientes(prev => [novo, ...prev])
          ok++
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[Import] Falha ao inserir:', payload, '→', msg)
          ultimoErro = msg
          erros++
        }
      }

      console.log('[Import] Concluído:', { ok, erros, ultimoErro })
      setResultado({ ok, erros, ultimoErro })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Import] Erro fatal:', msg)
      setResultado({ ok: 0, erros: 1, ultimoErro: msg })
    } finally {
      setImportando(false)
      setTimeout(() => setResultado(null), 10000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
          <p className="text-gray-500 text-sm mt-1">
            {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} cadastrado{clientes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportExcel}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importando}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={16} />
            {importando ? 'Importando...' : 'Importar Excel'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} />
            Novo Cliente
          </button>
        </div>
      </div>

      {resultado && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${resultado.ok > 0 && resultado.erros === 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : resultado.erros > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          <div className="flex items-center gap-2 font-medium">
            {resultado.erros === 0
              ? <CheckCircle size={16} className="shrink-0" />
              : <AlertCircle size={16} className="shrink-0" />}
            <span>
              {resultado.ok > 0 && `${resultado.ok} cliente${resultado.ok !== 1 ? 's' : ''} importado${resultado.ok !== 1 ? 's' : ''} com sucesso.`}
              {resultado.erros > 0 && ` ${resultado.erros} linha${resultado.erros !== 1 ? 's' : ''} com erro.`}
            </span>
          </div>
          {resultado.ultimoErro && (
            <p className="mt-1 text-xs opacity-80 font-mono break-all">
              Último erro: {resultado.ultimoErro}
            </p>
          )}
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Buscar por nome, empresa, segmento ou cidade..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtrados.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-700 font-bold text-sm">
                  {(c.nome || '?').charAt(0)}{(c.empresa || '').charAt(0)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {c.segmento && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{c.segmento}</span>
                )}
                <button
                  onClick={() => remover(c.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <h3 className="font-semibold text-gray-900">{c.nome}</h3>
            <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
              <Building2 size={13} className="text-gray-400 shrink-0" />
              {c.empresa}
            </p>
            {c.cnpj && <p className="text-xs text-gray-400 mt-0.5 pl-4">{c.cnpj}</p>}
            <div className="mt-3 space-y-1">
              {c.telefone && (
                <a href={`tel:${c.telefone}`} className="text-sm text-gray-600 flex items-center gap-1.5 hover:text-blue-600">
                  <Phone size={13} className="text-gray-400" />
                  {c.telefone}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="text-sm text-gray-600 flex items-center gap-1.5 hover:text-blue-600 truncate">
                  <Mail size={13} className="text-gray-400 shrink-0" />
                  {c.email}
                </a>
              )}
              {(c.cidade || c.estado) && (
                <p className="text-sm text-gray-600 flex items-center gap-1.5">
                  <MapPin size={13} className="text-gray-400" />
                  {[c.cidade, c.estado].filter(Boolean).join(' — ')}
                </p>
              )}
            </div>
            {c.observacoes && (
              <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-2 line-clamp-2">
                {c.observacoes}
              </p>
            )}
          </div>
        ))}
      </div>

      {filtrados.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-40" />
          <p>{busca ? 'Nenhum cliente encontrado para esta busca' : 'Nenhum cliente cadastrado'}</p>
        </div>
      )}

      {showModal && <ClienteModal onClose={() => setShowModal(false)} onSave={salvar} />}
    </div>
  )
}
