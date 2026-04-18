import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { AppProvider } from './contexts/AppContext'
import Layout from './components/Layout'
import TransactionFormModal from './components/TransactionFormModal'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import AccountPage from './pages/AccountPage'
import SearchPage from './pages/SearchPage'
import ProjectionPage from './pages/ProjectionPage'
import CategoriesSettings from './pages/settings/CategoriesSettings'
import TiersSettings from './pages/settings/TiersSettings'
import RecurrencesSettings from './pages/settings/RecurrencesSettings'
import AccountsSettings from './pages/settings/AccountsSettings'

function AppContent() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/compte/:id" element={<AccountPage />} />
        <Route path="/recherche" element={<SearchPage />} />
        <Route path="/projection" element={<ProjectionPage />} />
        <Route path="/parametres/categories" element={<CategoriesSettings />} />
        <Route path="/parametres/tiers" element={<TiersSettings />} />
        <Route path="/parametres/recurrences" element={<RecurrencesSettings />} />
        <Route path="/parametres/comptes" element={<AccountsSettings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <TransactionFormModal />
    </Layout>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500 text-sm">Chargement…</div>
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <AppProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppProvider>
  )
}
