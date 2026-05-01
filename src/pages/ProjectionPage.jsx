import { useState, useEffect } from 'react'
import { format, addDays, parseISO, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

const COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316','#ec4899','#64748b']

export default function ProjectionPage() {
  const { comptes } = useApp()
  const [targetDate, setTargetDate] = useState(format(addDays(new Date(), 90), 'yyyy-MM-dd'))
  const [selectedComptes, setSelectedComptes] = useState([])
  const [chartData, setChartData] = useState([])
  const [projectedBalances, setProjectedBalances] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (comptes.length) setSelectedComptes(comptes.filter(c => c.type === 'courant').map(c => c.id))
  }, [comptes])

  useEffect(() => { if (selectedComptes.length && targetDate) compute() }, [selectedComptes, targetDate])

  async function compute() {
    if (!selectedComptes.length) return
    setLoading(true)
    const today = format(new Date(), 'yyyy-MM-dd')
    const { data: allTxns } = await supabase
      .from('suivi_comptes_transactions')
      .select('compte_id, date, montant')
      .in('compte_id', selectedComptes)
      .lte('date', targetDate)
      .order('date')
    const txns = allTxns || []
    const days = []
    let cursor = new Date()
    const end = parseISO(targetDate)
    while (!isAfter(cursor, end)) { days.push(format(cursor, 'yyyy-MM-dd')); cursor = addDays(cursor, 1) }

    const filteredComptes = comptes.filter(c => selectedComptes.includes(c.id))
    const runningBalances = {}
    for (const c of filteredComptes) {
      const pastTxns = txns.filter(t => t.compte_id === c.id && t.date < today)
      runningBalances[c.id] = { base: parseFloat(c.solde_initial) + pastTxns.reduce((s, t) => s + parseFloat(t.montant), 0) }
    }

    const chart = days.map(day => {
      const point = { date: format(parseISO(day), 'd MMM', { locale: fr }) }
      let total = 0
      for (const c of filteredComptes) {
        const dayTxns = txns.filter(t => t.compte_id === c.id && t.date === day)
        runningBalances[c.id].base += dayTxns.reduce((s, t) => s + parseFloat(t.montant), 0)
        point[c.nom] = Math.round(runningBalances[c.id].base * 100) / 100
        total += runningBalances[c.id].base
      }
      if (filteredComptes.length > 1) point['Total'] = Math.round(total * 100) / 100
      return point
    })
    setChartData(chart)

    const finalBal = {}
    for (const c of filteredComptes) { finalBal[c.id] = runningBalances[c.id].base }
    setProjectedBalances(finalBal)
    setLoading(false)
  }

  function toggleCompte(id) {
    setSelectedComptes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const allLines = [
    ...comptes.filter(c => selectedComptes.includes(c.id)).map(c => c.nom),
    ...(selectedComptes.length > 1 ? ['Total'] : [])
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Projection</h1>
      <div className="card space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Date cible</label>
            <input type="date" className="input w-auto" value={targetDate}
              min={format(addDays(new Date(), 1), 'yyyy-MM-dd')} onChange={e => setTargetDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['30','90','180','365'].map(d => (
              <button key={d} type="button" onClick={() => setTargetDate(format(addDays(new Date(), parseInt(d)), 'yyyy-MM-dd'))}
                className="btn-secondary text-xs px-3 py-1">+{d}j</button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Comptes à afficher</label>
          <div className="flex flex-wrap gap-2">
            {comptes.map((c, i) => (
              <button key={c.id} type="button" onClick={() => toggleCompte(c.id)}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${selectedComptes.includes(c.id) ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                style={selectedComptes.includes(c.id) ? { backgroundColor: COLORS[i % COLORS.length], borderColor: COLORS[i % COLORS.length] } : {}}>
                {c.nom}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center h-64"><p className="text-gray-400">Calcul en cours…</p></div>
      ) : chartData.length > 0 ? (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Évolution jusqu'au {format(parseISO(targetDate), 'd MMMM yyyy', { locale: fr })}
          </h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.max(1, Math.floor(chartData.length / 10))} />
              <YAxis tickFormatter={v => `${Math.round(v)}€`} tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v, name) => [fmt(v), name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {allLines.map((name, i) => (
                <Line key={name} type="monotone" dataKey={name}
                  stroke={name === 'Total' ? '#1e293b' : COLORS[i % COLORS.length]}
                  strokeWidth={name === 'Total' ? 2.5 : 1.5} dot={false}
                  strokeDasharray={name === 'Total' ? '5 3' : undefined} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {Object.keys(projectedBalances).length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Soldes projetés au {format(parseISO(targetDate), 'd MMMM yyyy', { locale: fr })}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="pb-2 text-gray-500 font-medium">Compte</th>
                <th className="pb-2 text-gray-500 font-medium text-right">Solde actuel</th>
                <th className="pb-2 text-gray-500 font-medium text-right">Solde projeté</th>
                <th className="pb-2 text-gray-500 font-medium text-right">Évolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {comptes.filter(c => selectedComptes.includes(c.id)).map(c => {
                const projected = projectedBalances[c.id] ?? 0
                const current = chartData[0]?.[c.nom] ?? 0
                const diff = projected - current
                return (
                  <tr key={c.id}>
                    <td className="py-2 font-medium text-gray-900">{c.nom}</td>
                    <td className="py-2 text-right text-gray-600">{fmt(current)}</td>
                    <td className={`py-2 text-right font-semibold ${projected >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{fmt(projected)}</td>
                    <td className={`py-2 text-right font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {diff >= 0 ? '+' : ''}{fmt(diff)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
