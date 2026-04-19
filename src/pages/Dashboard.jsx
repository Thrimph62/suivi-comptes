import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function Dashboard() {
  const { comptes } = useApp()
  const [balances, setBalances] = useState({})
  const [recentTxns, setRecentTxns] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [projection3m, setProjection3m] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!comptes.length) return
    loadData()
  }, [comptes])

  async function loadData() {
    setLoading(true)
    const ids = comptes.map(c => c.id)

    // All transactions for balance
    const { data: allTxns } = await supabase
      .from('transactions')
      .select('compte_id, montant, pointee')
      .in('compte_id', ids)

    // Compute balances
    const bal = {}
    for (const c of comptes) {
      const txns = (allTxns || []).filter(t => t.compte_id === c.id)
      const total = txns.reduce((s, t) => s + parseFloat(t.montant), 0)
      const pointed = txns.filter(t => t.pointee).reduce((s, t) => s + parseFloat(t.montant), 0)
      bal[c.id] = {
        solde: parseFloat(c.solde_initial) + total,
        pointe: parseFloat(c.solde_initial) + pointed,
      }
    }
    setBalances(bal)

    // Recent transactions (last 10)
    const { data: recent } = await supabase
      .from('transactions')
      .select('*, comptes(nom), categories(parent, sous_categorie)')
      .in('compte_id', ids)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10)
    setRecentTxns(recent || [])

    // Spending by category this month
    const mStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const mEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const { data: monthTxns } = await supabase
      .from('transactions')
      .select('montant, categories(parent)')
      .in('compte_id', ids)
      .gte('date', mStart)
      .lte('date', mEnd)
      .lt('montant', 0)

    const byCategory = {}
    for (const t of (monthTxns || [])) {
      const cat = t.categories?.parent || 'Non catégorisé'
      byCategory[cat] = (byCategory[cat] || 0) + Math.abs(parseFloat(t.montant))
    }
    const chart = Object.entries(byCategory)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
    setChartData(chart)

    // 3-month projection: sum all transactions up to 90 days from now
    const in90days = format(addDays(new Date(), 90), 'yyyy-MM-dd')
    const { data: futureTxns } = await supabase
      .from('transactions')
      .select('compte_id, montant')
      .in('compte_id', ids)
      .lte('date', in90days)
    const proj = {}
    for (const c of comptes) {
      const txns = (futureTxns || []).filter(t => t.compte_id === c.id)
      proj[c.id] = parseFloat(c.solde_initial) + txns.reduce((s, t) => s + parseFloat(t.montant), 0)
    }
    setProjection3m(proj)

    setLoading(false)
  }

  const totalGlobal = comptes.reduce((s, c) => s + (balances[c.id]?.solde || 0), 0)
  const totalPointe = comptes.reduce((s, c) => s + (balances[c.id]?.pointe || 0), 0)
  const totalProjection3m = projection3m ? comptes.reduce((s, c) => s + (projection3m[c.id] || 0), 0) : null

  const COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316']

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <span className="text-sm text-gray-500">{format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}</span>
      </div>

      {/* Hero card */}
      <div className="card bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-emerald-100 text-sm font-medium uppercase tracking-wide">Total pointé</p>
            <p className="text-5xl font-bold mt-1">{fmt(totalPointe)}</p>
            <p className="text-emerald-200 text-sm mt-2">
              Théorique : <span className="font-semibold text-white">{fmt(totalGlobal)}</span>
              {Math.abs(totalGlobal - totalPointe) > 0.01 && (
                <span className="ml-2 text-emerald-300">
                  ({totalGlobal - totalPointe > 0 ? '+' : ''}{fmt(totalGlobal - totalPointe)} non pointé)
                </span>
              )}
            </p>
          </div>
          {totalProjection3m !== null && (
            <div className="sm:text-right bg-emerald-700/50 rounded-xl px-4 py-3 shrink-0">
              <p className="text-emerald-200 text-xs font-medium uppercase tracking-wide">Projection à 3 mois</p>
              <p className="text-2xl font-bold text-white mt-0.5">{fmt(totalProjection3m)}</p>
              <p className={`text-xs mt-0.5 ${totalProjection3m - totalGlobal >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {totalProjection3m - totalGlobal >= 0 ? '+' : ''}{fmt(totalProjection3m - totalGlobal)} vs aujourd'hui
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Account cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Soldes des comptes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {comptes.map(c => {
            const solde = balances[c.id]?.solde ?? 0
            const pointe = balances[c.id]?.pointe ?? 0
            const diff = solde - pointe
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/compte/${c.id}`)}
                className="card text-left hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{c.nom}</p>
                    <p className="text-xs text-gray-400">{c.banque || c.type}</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-emerald-500 transition-colors mt-1 shrink-0" />
                </div>
                <p className={`text-2xl font-bold mt-2 ${solde >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                  {fmt(solde)}
                </p>
                {Math.abs(diff) > 0.01 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Pointé : <span className="font-medium">{fmt(pointe)}</span>
                    <span className="ml-1 text-amber-500">({diff > 0 ? '+' : ''}{fmt(diff)} non pointé)</span>
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Dernières transactions</h2>
          {loading ? (
            <p className="text-gray-400 text-sm">Chargement…</p>
          ) : recentTxns.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune transaction.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentTxns.map(t => (
                <li key={t.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.tiers_nom || '—'}</p>
                    <p className="text-xs text-gray-400">
                      {t.comptes?.nom} · {format(new Date(t.date), 'd MMM', { locale: fr })}
                    </p>
                  </div>
                  <span className={parseFloat(t.montant) >= 0 ? 'montant-positif text-sm' : 'montant-negatif text-sm'}>
                    {fmt(t.montant)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Spending by category */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Dépenses du mois — {format(new Date(), 'MMMM yyyy', { locale: fr })}
          </h2>
          {chartData.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune dépense ce mois.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" tickFormatter={v => `${v}€`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={v => fmt(v)} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
