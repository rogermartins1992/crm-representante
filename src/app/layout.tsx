import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#1d4ed8',
}

export const metadata: Metadata = {
  title: 'CRM EPI - Representante Comercial',
  description: 'Sistema de gestão para representante comercial de EPI',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CRM EPI',
  },
  icons: {
    apple: '/icon-192.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.className} h-full bg-gray-50`}>
        <div className="flex h-full">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="p-6 lg:p-8 max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
