import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext({})
const KEYS = ['avant', 'aujourdhui', 'pointe', 'm1', 'm3', 'm12']

export function AppProvider({ children }) {
  const [comptes, setComptes] = useState([])
  const [categories, setCategories] = useState([])
  const [tiers, setTiers] = useState([])
  const [soldes, setSoldes] = useState({}) // { [compte_id]: {avant, aujourdhui, pointe, m1, m3, m12} } (vue SQL)
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [transactionModal, setTransactionModal] = useState({ open: false, transaction: null, defaultCompteId: null, prefill: null })

  const load = (setter, query) => async () => { const { data } = await query(); if (data) setter(data) }
  const loadComptes = useCallback(load(setComptes, () => supabase.from('suivi_comptes_comptes').select('*').order('ordre')), [])
  const loadCategories = useCallback(load(setCategories, () => supabase.from('suivi_comptes_categories').select('*').order('parent').order('sous_categorie')), [])
  const loadTiers = useCallback(load(setTiers, () => supabase.from('suivi_comptes_tiers').select('*, suivi_comptes_categories(parent, sous_categorie)').order('nom')), [])
  const loadSoldes = useCallback(load(
    d => setSoldes(Object.fromEntries(d.map(r => [r.compte_id, Object.fromEntries(KEYS.map(k => [k, Number(r[k])]))]))),
    () => supabase.from('suivi_comptes_soldes').select('*')), [])

  // À appeler après toute écriture : recharge les soldes et signale aux pages de se recharger.
  const refresh = useCallback(() => { setRefreshTrigger(n => n + 1); loadSoldes() }, [loadSoldes])

  useEffect(() => {
    Promise.all([loadComptes(), loadCategories(), loadTiers(), loadSoldes()]).then(() => setLoading(false))
  }, [loadComptes, loadCategories, loadTiers, loadSoldes])

  const openTransactionModal = (defaultCompteId = null, transaction = null, prefill = null) =>
    setTransactionModal({ open: true, transaction, defaultCompteId, prefill })
  const closeTransactionModal = (saved = false) => {
    setTransactionModal({ open: false, transaction: null, defaultCompteId: null, prefill: null })
    if (saved) refresh()
  }

  return (
    <AppContext.Provider value={{
      comptes, loadComptes, categories, loadCategories, tiers, loadTiers, soldes, refresh, refreshTrigger, loading,
      transactionModal, openTransactionModal, closeTransactionModal,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
