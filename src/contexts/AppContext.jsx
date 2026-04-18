import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext({})

export function AppProvider({ children }) {
  const [comptes, setComptes] = useState([])
  const [categories, setCategories] = useState([])
  const [tiers, setTiers] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal transaction
  const [transactionModal, setTransactionModal] = useState({
    open: false,
    transaction: null,     // null = création, objet = édition
    defaultCompteId: null,
  })

  const loadComptes = useCallback(async () => {
    const { data } = await supabase.from('comptes').select('*').order('ordre')
    if (data) setComptes(data)
  }, [])

  const loadCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('parent').order('sous_categorie')
    if (data) setCategories(data)
  }, [])

  const loadTiers = useCallback(async () => {
    const { data } = await supabase.from('tiers').select('*, categories(parent, sous_categorie)').order('nom')
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

  // Calcul du solde d'un compte
  function getSoldeCompte(compteId, transactions, pointeeOnly = false) {
    const compte = comptes.find(c => c.id === compteId)
    if (!compte) return 0
    const filtered = pointeeOnly ? transactions.filter(t => t.pointee) : transactions
    const sum = filtered.reduce((acc, t) => acc + parseFloat(t.montant || 0), 0)
    return parseFloat(compte.solde_initial || 0) + sum
  }

  return (
    <AppContext.Provider value={{
      comptes, loadComptes,
      categories, loadCategories,
      tiers, loadTiers,
      loading,
      transactionModal, openTransactionModal, closeTransactionModal,
      getSoldeCompte,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
