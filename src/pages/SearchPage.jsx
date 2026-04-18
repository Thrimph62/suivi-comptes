import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function SearchPage() {
  const { comptes } = useApp()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filterCompte, setFilterCompte] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [results, setResults] = useState([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSearch(e) {
    e?.preventDefault()
    setLoading(true)
    setSearched(true)

    let q = supabase
      .from('transactions')
      .select('*, comptes(nom), categories(parent, sous_categorie)')
      .order('date', { ascending: false })
      .limit(200)

    if (filterCompte) q = q.eq('compte_id', filterCompte)
    if (filterDateFrom) q = q.gte('date', filterDateFrom)
    if (filterDateTo) q = q.lte('date', filterDateTo)

    const { data } = await q
    let filtered = data || []

    if (query.trim()) {
      const q2 = query.toLowerCase().trim()
      filtered = filtered.filter(t => {
        const montantStr = Math.abs(parseFloat(t.montant)).toString()
        return (
          (t.tiers_nom || '').toLowerCase().includes(q2) ||
          (t.categories?.parent || '').toLowerCase().includes(q2) ||
          (t.categories?.sous_categorie || '').toLowerCase().includes(q2) ||
          (t.notes || '').toLowerCase().includes(q2) ||
          montantStr.includes(q2)
        )
      })
    }

    setResults(filtered)
    setLoading(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Recherche</h1>

      <form onSubmit={handleSearch} className="card space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Tiers, catégorie, montant, notes…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">Rechercher</button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select className="input w-auto text-sm" value={filterCompte} onChange={e => setFilterCompte(e.target.value)}>
            <option value="">Tous les comptes</option>
            {comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <input type="date" className="input w-auto text-sm" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} title="Date de début" />
          <input type="date" className="input w-auto text-sm" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} title="Date de fin" />
          <button
            type="button"
            onClick={() => { setFilterCompte(''); setFilterDateFrom(''); setFilterDateTo(''); setQuery(''); setResults([]); setSearched(false) }}
            className="text-sm text-emerald-600 hover:underline"
          >
            Réinitialiser
          </button>
        </div>
      </form>

      {loading && <p className="text-gray-400 text-sm">Recherche…</p>}

      {searched && !loading && (
        <div>
          <p className="text-sm text-gray-500 mb-3">{results.length} résultat(s)</p>
          {results.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-400">Aucun résultat pour cette recherche.</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tiers</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Catégorie</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Compte</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {results.map(t => {
                    const montant = parseFloat(t.montant)
                    return (
                      <tr
                        key={t.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/compte/${t.compte_id}`)}
                      >
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {format(new Date(t.date), 'd MMM yyyy', { locale: fr })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{t.tiers_nom || '—'}</p>
                          {t.notes && <p className="text-xs text-gray-400 italic">{t.notes}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                          {t.categories?.parent || '—'}
                          {t.categories?.sous_categorie && ` — ${t.categories.sous_categorie}`}
                        </td>
                        <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{t.comptes?.nom}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${montant >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {montant >= 0 ? '+' : ''}{fmt(montant)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
