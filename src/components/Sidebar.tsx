'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  ShoppingCart,
  Target,
  HardHat,
  Menu,
  X,
  Clock,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/visitas', label: 'Visitas', icon: CalendarCheck },
  { href: '/follow-ups', label: 'Follow-ups', icon: Clock },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingCart },
  { href: '/metas', label: 'Meta Mensal', icon: Target },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-blue-700 text-white p-2 rounded-lg shadow-lg"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-blue-900 text-white z-40 transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex lg:flex-col`}
      >
        <div className="p-6 border-b border-blue-700">
          <div className="flex items-center gap-3">
            <HardHat size={28} className="text-yellow-400" />
            <div>
              <h1 className="font-bold text-lg leading-tight">CRM EPI</h1>
              <p className="text-blue-300 text-xs">Representante Comercial</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium
                  ${active
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                  }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-blue-700 space-y-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-blue-200 hover:bg-blue-800 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
          <p className="text-blue-400 text-xs text-center">© 2026 CRM EPI v1.0</p>
        </div>
      </aside>
    </>
  )
}
