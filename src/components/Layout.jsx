import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Search, TrendingUp, Settings, Plus, ChevronDown, ChevronRight, LogOut, Menu, Wallet, PiggyBank, CreditCard, Ticket } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'

const TYPES = {
  courant: ['Comptes Courants', Wallet],
  epargne: ['Épargne', PiggyBank],
  cheques_repas: ['Chèques Repas', CreditCard],
  titres_services: ['Titres Services', Ticket],
  autre: ['Autres', Wallet],
}
const SETTINGS = [['categories', 'Catégories'], ['tiers', 'Tiers'], ['recurrences', 'Récurrences'], ['comptes', 'Comptes']]
const linkCls = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`

export default function Layout({ children }) {
  const { comptes, openTransactionModal } = useApp()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const close = () => setMobileOpen(false)
  const link = (to, label, icon) => (
    <NavLink key={to} to={to} end={to === '/'} onClick={close} className={linkCls}>{icon}<span className="truncate">{label}</span></NavLink>
  )

  // JSX (et non composant imbriqué) : un composant défini dans Layout serait remonté à chaque rendu.
  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-slate-700">
        <span className="text-white font-bold text-lg">💰 Suivi Comptes</span>
      </div>
      <div className="px-3 py-3 border-b border-slate-700">
        <button onClick={() => { openTransactionModal(); close() }}
          className="w-full flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors">
          <Plus size={16} /> Ajouter une transaction
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {link('/', 'Tableau de bord', <LayoutDashboard size={16} />)}
        {link('/recherche', 'Recherche', <Search size={16} />)}
        {link('/projection', 'Projection', <TrendingUp size={16} />)}
        <div className="pt-3 pb-1 px-2"><span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Comptes</span></div>
        {Object.entries(TYPES).map(([type, [label, Icon]]) => {
          const list = comptes.filter(c => c.type === type)
          return list.length > 0 && (
            <div key={type}>
              <div className="px-2 py-1 text-xs text-slate-400 font-medium mt-2">{label}</div>
              {list.map(c => link(`/compte/${c.id}`, c.nom, <Icon size={14} className="shrink-0" />))}
            </div>
          )
        })}
        <div className="pt-3">
          <button onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors">
            <Settings size={16} />
            <span className="flex-1 text-left">Paramètres</span>
            {settingsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {settingsOpen && <div className="ml-4 mt-1 space-y-1">{SETTINGS.map(([p, label]) => link(`/parametres/${p}`, label))}</div>}
        </div>
      </nav>
      <div className="px-3 py-3 border-t border-slate-700">
        <button onClick={() => supabase.auth.signOut()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
          <LogOut size={16} /> Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:flex flex-col w-64 bg-slate-800 shrink-0">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <aside className="relative z-10 flex flex-col w-64 h-full bg-slate-800">{sidebar}</aside>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setMobileOpen(true)} className="text-gray-600 mr-3"><Menu size={22} /></button>
          <span className="font-bold text-gray-900">💰 Suivi Comptes</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
      <button onClick={() => openTransactionModal()} title="Ajouter une transaction"
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-40">
        <Plus size={24} />
      </button>
    </div>
  )
}
