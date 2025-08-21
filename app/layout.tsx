import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'DevMate',
  description: 'A minimal, production-ready AI chat application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
