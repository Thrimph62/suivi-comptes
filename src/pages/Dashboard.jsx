import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ArrowRight } from 'lucide-react'
import { supabase, fetchAll } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { fmt, fmtDiff, fdate, TX } from '../lib/format'
import Projections from '../components/Projections'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']
const iso = d => format(d, 'yyyy-MM-dd')

// Tiers les plus fréquents (>= 5 fois en 90 jours, hors virements et récurrences), 8 max, affichés par ordre alphabétique.
// Compte proposé = le plus utilisé pour ce tiers (à égalité : le plus récent). Rows triées de la plus récente à la plus ancienne.
function quickList(rows) {
  const g = {}
  for (const t of rows) {
    const k = t.tiers_nom.trim().toLowerCase()
    if (!k) continue
    const e = (g[k] ??= { last: t, n: 0, byCompte: {} })
    e.n++
    e.byCompte[t.compte_id] = (e.byCompte[t.compte_id] || 0) + 1
  }
  return Object.values(g).filter(e => e.n >= 5)
    .sort((a, b) => b.n - a.n || b.last.date.localeCompare(a.last.date)).slice(0, 8)
    .map(({ last, byCompte }) => ({ ...last, compte_id: Object.keys(byCompte).sort((x, y) => byCompte[y] - byCompte[x])[0] }))
    .sort((a, b) => a.tiers_nom.localeCompare(b.tiers_nom, 'fr', { sensitivity: 'base' }))
}

export default function Dashboard() {
  const { comptes, soldes, refreshTrigger, openTransactionModal } = useApp()
  const [recent, setRecent] = useState([])
  const [chartData, setChartData] = useState([])
  const [quick, setQuick] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    const now = new Date()
    Promise.all([
      supabase.from(TX).select('*, suivi_comptes_comptes(nom)').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(10),
      // dépenses du mois, hors virements internes
      fetchAll(() => supabase.from(TX).select('montant, suivi_comptes_categories(parent)')
        .gte('date', iso(startOfMonth(now))).lte('date', iso(endOfMonth(now))).lt('montant', 0).is('transfer_id', null).order('id')),
      fetchAll(() => supabase.from(TX).select('compte_id, tiers_id, tiers_nom, categorie_id, montant, date')
        .gte('date', iso(subDays(now, 90))).lte('date', iso(now)).is('transfer_id', null).is('recurrence_id', null).not('tiers_nom', 'is', null)
        .order('date', { ascending: false }).order('id')),
    ]).then(([{ data }, month, last90]) => {
      setRecent(data || [])
      setQuick(quickList(last90))
      const byCat = {}
      for (const t of month) {
        const c = t.suivi_comptes_categories?.parent || 'Non catégorisé'
        byCat[c] = (byCat[c] || 0) - Number(t.montant)
      }
      setChartData(Object.entries(byCat).map(([name, v]) => ({ name, value: Math.round(v * 100) / 100 }))
        .sort((a, b) => b.value - a.value).slice(0, 8))
    })
  }, [refreshTrigger])

  const total = Object.fromEntries(['aujourdhui', 'pointe', 'm1', 'm3', 'm12'].map(k =>
    [k, comptes.reduce((s, c) => s + (soldes[c.id]?.[k] || 0), 0)]))
  const nonPointe = total.aujourdhui - total.pointe

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <span className="text-sm text-gray-500">{format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}</span>
      </div>

      <div className="card bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-emerald-100 text-xs font-medium uppercase tracking-wide">Solde théorique</p>
            <p className="text-5xl font-bold mt-1">{fmt(total.aujourdhui)}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-emerald-100">Pointé : <span className="font-semibold text-white">{fmt(total.pointe)}</span></span>
              <span className={`font-medium ${Math.abs(nonPointe) < 0.01 ? 'text-emerald-300' : 'text-amber-300'}`}>Non pointé : {fmtDiff(nonPointe)}</span>
            </div>
          </div>
          <div className="bg-emerald-700/50 rounded-xl px-4 py-3 shrink-0 min-w-[240px]">
            <p className="text-emerald-200 text-xs font-medium uppercase tracking-wide mb-2">Projections</p>
            <div className="space-y-1.5"><Projections s={total} dark /></div>
          </div>
        </div>
      </div>

      {quick.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Saisie rapide</h2>
          <div className="flex flex-wrap gap-2">
            {quick.map(t => (
              <button key={t.tiers_nom} className="card py-2 px-3 text-left hover:shadow-md hover:border-emerald-300 transition"
                onClick={() => openTransactionModal(t.compte_id, null, {
                  compte_id: t.compte_id, tiers_id: t.tiers_id || '', tiers_nom: t.tiers_nom, categorie_id: t.categorie_id || '',
                  montant: Number(t.montant) >= 0 ? '0' : '', // '0' = signe « recette » (champ vide = dépense)
                })}>
                <p className="text-sm font-medium text-gray-900">{t.tiers_nom}</p>
                <p className="text-xs text-gray-400">{comptes.find(c => c.id === t.compte_id)?.nom}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Soldes des comptes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {comptes.map(c => {
            const s = soldes[c.id]
            if (!s) return null
            const np = s.aujourdhui - s.pointe
            return (
              <button key={c.id} onClick={() => navigate(`/compte/${c.id}`)} className="card text-left hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{c.nom}</p>
                    <p className="text-xs text-gray-400">{c.banque || c.type}</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-emerald-500 transition-colors mt-1 shrink-0" />
                </div>
                <p className={`text-2xl font-bold mt-2 ${s.aujourdhui >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{fmt(s.aujourdhui)}</p>
                <p className="text-xs text-gray-400 mt-0.5">Solde théorique</p>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                  <span className="text-gray-500">Pointé : <span className="font-medium text-emerald-600">{fmt(s.pointe)}</span></span>
                  {Math.abs(np) > 0.01 && <span className="text-amber-500 font-medium">Non pointé : {fmtDiff(np)}</span>}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5"><Projections s={s} /></div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Dernières transactions</h2>
          {recent.length === 0 ? <p className="text-gray-400 text-sm">Aucune transaction.</p> : (
            <ul className="divide-y divide-gray-50">
              {recent.map(t => (
                <li key={t.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.tiers_nom || '—'}</p>
                    <p className="text-xs text-gray-400">{t.suivi_comptes_comptes?.nom} · {fdate(t.date, 'd MMM')}</p>
                  </div>
                  <span className={`text-sm font-semibold ${t.montant >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(t.montant)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Dépenses du mois — {format(new Date(), 'MMMM yyyy', { locale: fr })}</h2>
          {chartData.length === 0 ? <p className="text-gray-400 text-sm">Aucune dépense ce mois.</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" tickFormatter={v => `${v}€`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={fmt} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>{chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
