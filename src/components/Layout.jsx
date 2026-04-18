import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Search, TrendingUp, Settings, Plus,
  ChevronDown, ChevronRight, LogOut, Menu, X, Wallet,
  PiggyBank, CreditCard, Ticket
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'

const TYPE_ICONS = {
  courant: Wallet,
  epargne: PiggyBank,
  cheques_repas: CreditCard,
  titres_services: Ticket,
  autre: Wallet,
}

const TYPE_LABELS = {
  courant: 'Comptes Courants',
  epargne: 'Épargne',
  cheques_repas: 'Chèques Repas',
  titres_services: 'Titres Services',
  autre: 'Autres',
}

export default function Layout({ children }) {
  const { comptes, openTransactionModal } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  // Group accounts by type
  const grouped = comptes.reduce((acc, c) => {
    if (!acc[c.type]) acc[c.type] = []
    acc[c.type].push(c)
    return acc
  }, {})

  const typeOrder = ['courant', 'epargne', 'cheques_repas', 'titres_services', 'autre']

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-700">
          <span className="text-white font-bold text-lg flex items-center gap-2">
            💰 Suivi Comptes
          </span>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:block text-slate-400 hover:text-white"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Add transaction button */}
        <div className="px-3 py-3 border-b border-slate-700">
          <button
            onClick={() => { openTransactionModal(); setMobileSidebarOpen(false) }}
            className="w-full flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            <Plus size={16} />
            Ajouter une transaction
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          <NavItem to="/" icon={<LayoutDashboard size={16} />} label="Tableau de bord" onClick={() => setMobileSidebarOpen(false)} />
          <NavItem to="/recherche" icon={<Search size={16} />} label="Recherche" onClick={() => setMobileSidebarOpen(false)} />
          <NavItem to="/projection" icon={<TrendingUp size={16} />} label="Projection" onClick={() => setMobileSidebarOpen(false)} />

          <div className="pt-3 pb-1 px-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Comptes</span>
          </div>

          {typeOrder.map(type => {
            const accounts = grouped[type]
            if (!accounts?.length) return null
            const Icon = TYPE_ICONS[type]
            return (
              <div key={type}>
                <div className="px-2 py-1 text-xs text-slate-400 font-medium mt-2">
                  {TYPE_LABELS[type]}
                </div>
                {accounts.map(c => (
                  <NavLink
                    key={c.id}
                    to={`/compte/${c.id}`}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{c.nom}</span>
                  </NavLink>
                ))}
              </div>
            )
          })}

          {/* Settings */}
          <div className="pt-3">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Settings size={16} />
              <span className="flex-1 text-left">Paramètres</span>
              {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {settingsOpen && (
              <div className="ml-4 mt-1 space-y-1">
                <NavItem to="/parametres/categories" label="Catégories" onClick={() => setMobileSidebarOpen(false)} />
                <NavItem to="/parametres/tiers" label="Tiers" onClick={() => setMobileSidebarOpen(false)} />
                <NavItem to="/parametres/recurrences" label="Récurrences" onClick={() => setMobileSidebarOpen(false)} />
                <NavItem to="/parametres/comptes" label="Comptes" onClick={() => setMobileSidebarOpen(false)} />
              </div>
            )}
          </div>
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-800 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative z-10 flex flex-col w-64 h-full bg-slate-800">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setMobileSidebarOpen(true)} className="text-gray-600 mr-3">
            <Menu size={22} />
          </button>
          <span className="font-bold text-gray-900">💰 Suivi Comptes</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Floating + button */}
      <button
        onClick={() => openTransactionModal()}
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-40"
        title="Ajouter une transaction"
      >
        <Plus size={24} />
      </button>
    </div>
  )
}

function NavItem({ to, icon, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-emerald-600 text-white'
            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  )
}
