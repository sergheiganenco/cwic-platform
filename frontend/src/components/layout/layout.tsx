import * as React from 'react'
import { Footer } from './Footer'
import { Header } from './Header'
import { Navigation } from './Navigation'

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = React.useState(false)

  return (
    <div className="flex bg-gray-100">
      <Navigation collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
        <Footer />
      </div>
    </div>
  )
}
