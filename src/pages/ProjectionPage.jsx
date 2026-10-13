import { useState, useEffect } from 'react'
import { format, addDays, parseISO, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase, fetchAll } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { fmt, TX } from '../lib/format'

const COLORS = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316','#ec4899','#64748b']

export default function ProjectionPage() {
  const { comptes, soldes, refreshTrigger } = useApp()
  const [targetDate, setTargetDate] = useState(format(addDays(new Date(), 90), 'yyyy-MM-dd'))
  const [selectedComptes, setSelectedComptes] = useState([])
  const [chartData, setChartData] = useState([])
  const [projectedBalances, setProjectedBalances] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (comptes.length) setSelectedComptes(comptes.filter(c => c.type === 'courant').map(c => c.id))
  }, [comptes])

  useEffect(() => { if (selectedComptes.length && targetDate && Object.keys(soldes).length) compute() }, [selectedComptes, targetDate, soldes, refreshTrigger])

  async function compute() {
    setLoading(true)
    const today = format(new Date(), 'yyyy-MM-dd')
    // point de départ = solde veille (vue SQL) ; on ne charge que les mouvements d'aujourd'hui à la date cible
    const rows = await fetchAll(() => supabase.from(TX).select('compte_id, date, montant')
      .in('compte_id', selectedComptes).gte('date', today).lte('date', targetDate).order('date').order('id'))
    const delta = {}
    for (const t of rows) delta[t.compte_id + t.date] = (delta[t.compte_id + t.date] || 0) + Number(t.montant)

    const list = comptes.filter(c => selectedComptes.includes(c.id))
    const run = Object.fromEntries(list.map(c => [c.id, soldes[c.id]?.avant || 0]))
    const chart = []
    for (let d = new Date(); !isAfter(d, parseISO(targetDate)); d = addDays(d, 1)) {
      const day = format(d, 'yyyy-MM-dd')
      const point = { date: format(d, 'd MMM', { locale: fr }) }
      let total = 0
      for (const c of list) {
        run[c.id] += delta[c.id + day] || 0
        point[c.nom] = Math.round(run[c.id] * 100) / 100
        total += run[c.id]
      }
      if (list.length > 1) point.Total = Math.round(total * 100) / 100
      chart.push(point)
    }
    setChartData(chart)
    setProjectedBalances(run)
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
                const current = soldes[c.id]?.aujourdhui ?? 0
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
