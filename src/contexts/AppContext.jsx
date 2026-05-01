import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext({})

export function AppProvider({ children }) {
  const [comptes, setComptes] = useState([])
  const [categories, setCategories] = useState([])
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)

  const [transactionModal, setTransactionModal] = useState({
    open: false, transaction: null, defaultCompteId: null,
  })

  const loadComptes = useCallback(async () => {
    const { data } = await supabase.from('suivi_comptes_comptes').select('*').order('ordre')
    if (data) setComptes(data)
  }, [])

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('suivi_comptes_categories').select('*').order('parent').order('sous_categorie')
    if (data) setCategories(data)
  }, [])

  const loadTiers = useCallback(async () => {
    const { data } = await supabase
      .from('suivi_comptes_tiers')
      .select('*, suivi_comptes_categories(parent, sous_categorie)')
      .order('nom')
    if (data) setTiers(data)
  }, [])

  useEffect(() => {
    async function init() {
      await Promise.all([loadComptes(), loadCategories(), loadTiers()])
      setLoading(false)
    }
    init()
  }, [loadComptes, loadCategories, loadTiers])

  function openTransactionModal(defaultCompteId = null, transaction = null) {
    setTransactionModal({ open: true, transaction, defaultCompteId })
  }

  function closeTransactionModal() {
    setTransactionModal({ open: false, transaction: null, defaultCompteId: null })
  }

  return (
    <AppContext.Provider value={{
      comptes, loadComptes,
      categories, loadCategories,
      tiers, loadTiers,
      loading,
      transactionModal, openTransactionModal, closeTransactionModal,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
