import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, addMonths, addYears } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}
function fmtDiff(n) { return `${n >= 0 ? '+' : ''}${fmt(n)}` }

export default function Dashboard() {
  const { comptes } = useApp()
  const [balances, setBalances] = useState({})
  const [projections, setProjections] = useState({})
  const [recentTxns, setRecentTxns] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { if (comptes.length) loadData() }, [comptes])

  async function loadData() {
    setLoading(true)
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const in1m  = format(addMonths(new Date(), 1), 'yyyy-MM-dd')
    const in3m  = format(addMonths(new Date(), 3), 'yyyy-MM-dd')
    const in1y  = format(addYears(new Date(), 1),  'yyyy-MM-dd')

    // ── One query per account (no row limit issue) ──────────
    const results = await Promise.all(
      comptes.map(c =>
        supabase
          .from('suivi_comptes_transactions')
          .select('montant, pointee, date')
          .eq('compte_id', c.id)
      )
    )

    const bal = {}
    const proj = {}

    comptes.forEach((c, i) => {
      const txns = results[i].data || []
      const base = parseFloat(c.solde_initial)

      const soldeAujourdhui = base + txns
        .filter(t => t.date <= todayStr)
        .reduce((s, t) => s + parseFloat(t.montant), 0)

      const soldePointe = base + txns
        .filter(t => t.pointee)
        .reduce((s, t) => s + parseFloat(t.montant), 0)

      bal[c.id] = {
        aujourdhui: soldeAujourdhui,
        pointe:     soldePointe,
        nonPointe:  soldeAujourdhui - soldePointe,
      }

      proj[c.id] = {
        m1:  base + txns.filter(t => t.date <= in1m).reduce((s, t) => s + parseFloat(t.montant), 0),
        m3:  base + txns.filter(t => t.date <= in3m).reduce((s, t) => s + parseFloat(t.montant), 0),
        m12: base + txns.filter(t => t.date <= in1y).reduce((s, t)  => s + parseFloat(t.montant), 0),
      }
    })

    setBalances(bal)
    setProjections(proj)

    // ── Recent transactions (last 10) ───────────────────────
    const { data: recent } = await supabase
      .from('suivi_comptes_transactions')
      .select('*, suivi_comptes_comptes(nom), suivi_comptes_categories(parent, sous_categorie)')
      .in('compte_id', comptes.map(c => c.id))
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10)
    setRecentTxns(recent || [])

    // ── Spending by category this month ─────────────────────
    const mStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const mEnd   = format(endOfMonth(new Date()),   'yyyy-MM-dd')
    const { data: monthTxns } = await supabase
      .from('suivi_comptes_transactions')
      .select('montant, suivi_comptes_categories(parent)')
      .in('compte_id', comptes.map(c => c.id))
      .gte('date', mStart).lte('date', mEnd).lt('montant', 0)
    const byCategory = {}
    for (const t of (monthTxns || [])) {
      const cat = t.suivi_comptes_categories?.parent || 'Non catégorisé'
      byCategory[cat] = (byCategory[cat] || 0) + Math.abs(parseFloat(t.montant))
    }
    setChartData(
      Object.entries(byCategory)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value).slice(0, 8)
    )

    setLoading(false)
  }

  // ── Global totals ────────────────────────────────────────
  const totalAujourdhui = comptes.reduce((s, c) => s + (balances[c.id]?.aujourdhui || 0), 0)
  const totalPointe     = comptes.reduce((s, c) => s + (balances[c.id]?.pointe     || 0), 0)
  const totalNonPointe  = totalAujourdhui - totalPointe
  const totalM1         = comptes.reduce((s, c) => s + (projections[c.id]?.m1  || 0), 0)
  const totalM3         = comptes.reduce((s, c) => s + (projections[c.id]?.m3  || 0), 0)
  const totalM12        = comptes.reduce((s, c) => s + (projections[c.id]?.m12 || 0), 0)

  const COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#84cc16','#f97316']

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <span className="text-sm text-gray-500">{format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}</span>
      </div>

      {/* ── Hero KPI ── */}
      <div className="card bg-gradient-to-r from-emerald-600 to-emerald-700 text-white border-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-emerald-100 text-xs font-medium uppercase tracking-wide">Solde à ce jour</p>
            <p className="text-5xl font-bold mt-1">{fmt(totalAujourdhui)}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-emerald-100">
                Pointé : <span className="font-semibold text-white">{fmt(totalPointe)}</span>
              </span>
              <span className={`font-medium ${Math.abs(totalNonPointe) < 0.01 ? 'text-emerald-300' : 'text-amber-300'}`}>
                Non pointé : {fmtDiff(totalNonPointe)}
              </span>
            </div>
          </div>
          <div className="sm:text-right bg-emerald-700/50 rounded-xl px-4 py-3 shrink-0 min-w-[200px]">
            <p className="text-emerald-200 text-xs font-medium uppercase tracking-wide mb-2">Projections</p>
            <div className="space-y-1.5">
              {[
                { label: '1 mois', val: totalM1  },
                { label: '3 mois', val: totalM3  },
                { label: '1 an',   val: totalM12 },
              ].map(({ label, val }) => (
                <div key={label} className="flex sm:justify-end items-center gap-3">
                  <span className="text-emerald-300 text-xs w-12 sm:text-right">{label}</span>
                  <span className="text-white font-semibold text-sm">{fmt(val)}</span>
                  <span className={`text-xs font-medium w-20 text-right ${val - totalAujourdhui >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {fmtDiff(val - totalAujourdhui)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Account cards ── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Soldes des comptes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {comptes.map(c => {
            const bal  = balances[c.id]
            const proj = projections[c.id]
            if (!bal) return null
            return (
              <button key={c.id} onClick={() => navigate(`/compte/${c.id}`)}
                className="card text-left hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{c.nom}</p>
                    <p className="text-xs text-gray-400">{c.banque || c.type}</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-emerald-500 transition-colors mt-1 shrink-0" />
                </div>
                <p className={`text-2xl font-bold mt-2 ${bal.aujourdhui >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                  {fmt(bal.aujourdhui)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Solde à ce jour</p>
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs">
                  <span className="text-gray-500">
                    Pointé : <span className="font-medium text-emerald-600">{fmt(bal.pointe)}</span>
                  </span>
                  {Math.abs(bal.nonPointe) > 0.01 && (
                    <span className="text-amber-500 font-medium">Non pointé : {fmtDiff(bal.nonPointe)}</span>
                  )}
                </div>
                {proj && (
                  <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
                    {[
                      { label: '1 mois', val: proj.m1  },
                      { label: '3 mois', val: proj.m3  },
                      { label: '1 an',   val: proj.m12 },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-gray-700">{fmt(val)}</span>
                          <span className={`text-xs font-medium ${val - bal.aujourdhui >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                            {fmtDiff(val - bal.aujourdhui)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Dernières transactions</h2>
          {loading ? <p className="text-gray-400 text-sm">Chargement…</p> : recentTxns.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune transaction.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentTxns.map(t => (
                <li key={t.id} className="py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.tiers_nom || '—'}</p>
                    <p className="text-xs text-gray-400">
                      {t.suivi_comptes_comptes?.nom} · {format(new Date(t.date), 'd MMM', { locale: fr })}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${parseFloat(t.montant) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmt(t.montant)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Dépenses du mois — {format(new Date(), 'MMMM yyyy', { locale: fr })}
          </h2>
          {chartData.length === 0 ? <p className="text-gray-400 text-sm">Aucune dépense ce mois.</p> : (
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
