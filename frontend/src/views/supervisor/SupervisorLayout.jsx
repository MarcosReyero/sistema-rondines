import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { logout, getUser } from '../../lib/auth'

const NAV = [
  { to: '/supervisor', label: 'Dashboard', end: true, icon: '▦' },
  { to: '/supervisor/instalaciones', label: 'Instalaciones', icon: '🏢' },
  { to: '/supervisor/qr', label: 'Gestión QR', icon: '⬛' },
  { to: '/supervisor/rondas', label: 'Rondas', icon: '🔄' },
  { to: '/supervisor/registro', label: 'Registro', icon: '📋' },
  { to: '/supervisor/vigilantes', label: 'Vigilantes', icon: '👤' },
]

export default function SupervisorLayout() {
  const navigate = useNavigate()
  const user = getUser()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen bg-dark-300 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-dark-400 border-r border-white/5 flex flex-col transition-all duration-200 shrink-0`}>
        <div className="px-4 py-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0">
            <span className="text-accent text-sm font-bold">R</span>
          </div>
          {sidebarOpen && <span className="font-bold text-white text-sm truncate">Rondines</span>}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1">
          {NAV.map(({ to, label, end, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors
                ${isActive
                  ? 'bg-accent/15 text-accent border border-accent/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'}`
              }
            >
              <span className="text-base shrink-0">{icon}</span>
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-3 border-t border-white/5">
          {sidebarOpen && (
            <div className="px-3 py-2 mb-1">
              <p className="text-white/60 text-xs truncate">{user?.nombre}</p>
              <p className="text-white/30 text-xs">Supervisor</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-white/40 hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <span className="shrink-0">⎋</span>
            {sidebarOpen && 'Salir'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
