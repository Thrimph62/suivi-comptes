import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CheckCircle2, Circle, Pencil, Trash2, Plus, Filter, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import Modal from '../components/Modal'

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function AccountPage() {
  const { id } = useParams()
  const { comptes, openTransactionModal } = useApp()
  const compte = comptes.find(c => c.id === id)

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [expandedYears, setExpandedYears] = useState({})
  const [expandedMonths, setExpandedMonths] = useState({})
  const [filterMonth, setFilterMonth] = useState('')
  const [filterCat, setFilterCat] = useState('')

  useEffect(() => { if (id) loadTransactions() }, [id])

  async function loadTransactions() {
    setLoading(true)
    const { data } = await supabase
      .from('suivi_comptes_transactions')
      .select('*, suivi_comptes_categories(parent, sous_categorie)')
      .eq('compte_id', id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setTransactions(data || [])
    setLoading(false)
  }

  async function togglePointee(txn) {
    await supabase.from('suivi_comptes_transactions').update({ pointee: !txn.pointee }).eq('id', txn.id)
    setTransactions(ts => ts.map(t => t.id === txn.id ? { ...t, pointee: !t.pointee } : t))
  }

  async function deleteTransaction(txn) {
    await supabase.from('suivi_comptes_transactions').delete().eq('id', txn.id)
    setTransactions(ts => ts.filter(t => t.id !== txn.id))
    setDeleteConfirm(null)
  }

  if (!compte) return <p className="text-gray-500">Compte introuvable.</p>

  const soldeTheorique = parseFloat(compte.solde_initial) + transactions.reduce((s, t) => s + parseFloat(t.montant), 0)
  const soldePointe = parseFloat(compte.solde_initial) + transactions.filter(t => t.pointee).reduce((s, t) => s + parseFloat(t.montant), 0)
  const nonPointe = soldeTheorique - soldePointe

  const cats = [...new Set(transactions.map(t => t.suivi_comptes_categories?.parent).filter(Boolean))].sort()

  const filtered = transactions.filter(t => {
    const monthMatch = !filterMonth || t.date.startsWith(filterMonth)
    const catMatch = !filterCat || t.suivi_comptes_categories?.parent === filterCat
    return monthMatch && catMatch
  })

  const groupedByYear = filtered.reduce((acc, t) => {
    const year = t.date.slice(0, 4)
    const month = t.date.slice(0, 7)
    if (!acc[year]) acc[year] = {}
    if (!acc[year][month]) acc[year][month] = []
    acc[year][month].push(t)
    return acc
  }, {})

  const sortedYears = Object.keys(groupedByYear).sort((a, b) => b.localeCompare(a))
  const allMonthKeys = sortedYears.flatMap(y => Object.keys(groupedByYear[y]))
  const everythingExpanded = sortedYears.every(y => expandedYears[y]) && allMonthKeys.every(m => expandedMonths[m])

  function expandAll() {
    const years = {}, months = {}
    sortedYears.forEach(y => {
      years[y] = true
      Object.keys(groupedByYear[y]).forEach(m => { months[m] = true })
    })
    setExpandedYears(years)
    setExpandedMonths(months)
  }

  function collapseAll() {
    setExpandedYears({})
    setExpandedMonths({})
  }

  function toggleYear(year) {
    const isOpen = !!expandedYears[year]
    setExpandedYears(e => ({ ...e, [year]: !isOpen }))
    if (isOpen) {
      const months = {}
      Object.keys(groupedByYear[year]).forEach(m => { months[m] = false })
      setExpandedMonths(e => ({ ...e, ...months }))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{compte.nom}</h1>
          <p className="text-gray-500 text-sm">{compte.banque} · {compte.pays}</p>
        </div>
        <button onClick={() => openTransactionModal(id)} className="btn-primary flex items-center gap-2 shrink-0">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Solde théorique</p>
          <p className={`text-2xl font-bold mt-1 ${soldeTheorique >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{fmt(soldeTheorique)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Solde pointé ✓</p>
          <p className={`text-2xl font-bold mt-1 ${soldePointe >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(soldePointe)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Non pointé</p>
          <p className={`text-2xl font-bold mt-1 ${Math.abs(nonPointe) < 0.01 ? 'text-gray-400' : 'text-amber-500'}`}>{fmt(nonPointe)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={16} className="text-gray-400" />
        <input type="month" className="input w-auto text-sm" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        <select className="input w-auto text-sm" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filterMonth || filterCat) && (
          <button onClick={() => { setFilterMonth(''); setFilterCat('') }} className="text-sm text-emerald-600 hover:underline">Effacer filtres</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} transaction(s)</span>
      </div>

      {loading ? (
        <p className="text-gray-400">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">Aucune transaction.</p>
          <button onClick={() => openTransactionModal(id)} className="btn-primary mt-3">Ajouter la première transaction</button>
        </div>
      ) : (
        <>
          <div className="flex justify-end">
            <button onClick={everythingExpanded ? collapseAll : expandAll}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:underline">
              {everythingExpanded ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
              {everythingExpanded ? 'Tout replier' : 'Tout déplier'}
            </button>
          </div>

          {sortedYears.map(year => {
            const yearMonths = groupedByYear[year]
            const sortedMonths = Object.keys(yearMonths).sort((a, b) => b.localeCompare(a))
            const yearTotal = sortedMonths.reduce((s, m) => s + yearMonths[m].reduce((ms, t) => ms + parseFloat(t.montant), 0), 0)
            const yearCount = sortedMonths.reduce((s, m) => s + yearMonths[m].length, 0)
            const isYearOpen = !!expandedYears[year]

            return (
              <div key={year} className="space-y-1">
                <button
                  className="w-full flex items-center justify-between py-2.5 px-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  onClick={() => toggleYear(year)}
                >
                  <div className="flex items-center gap-2">
                    {isYearOpen ? <ChevronDown size={17} className="text-gray-500" /> : <ChevronRight size={17} className="text-gray-500" />}
                    <span className="font-bold text-gray-800 text-base">{year}</span>
                    <span className="text-xs text-gray-500">({yearCount} transaction{yearCount > 1 ? 's' : ''})</span>
                  </div>
                  <span className={`font-bold text-sm ${yearTotal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {yearTotal >= 0 ? '+' : ''}{fmt(yearTotal)}
                  </span>
                </button>

                {isYearOpen && (
                  <div className="ml-4 space-y-1">
                    {sortedMonths.map(month => {
                      const txns = yearMonths[month]
                      const monthTotal = txns.reduce((s, t) => s + parseFloat(t.montant), 0)
                      const isMonthOpen = !!expandedMonths[month]
                      return (
                        <div key={month}>
                          <button
                            className="w-full flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded-lg transition-colors"
                            onClick={() => setExpandedMonths(e => ({ ...e, [month]: !e[month] }))}
                          >
                            <div className="flex items-center gap-2">
                              {isMonthOpen ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
                              <span className="text-sm font-semibold text-gray-600 capitalize">
                                {format(new Date(month + '-01'), 'MMMM yyyy', { locale: fr })}
                              </span>
                              <span className="text-xs text-gray-400">({txns.length})</span>
                            </div>
                            <span className={`text-sm font-semibold ${monthTotal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {monthTotal >= 0 ? '+' : ''}{fmt(monthTotal)}
                            </span>
                          </button>
                          {isMonthOpen && (
                            <div className="card p-0 overflow-hidden mt-1 mb-2">
                              <table className="w-full text-sm">
                                <tbody className="divide-y divide-gray-50">
                                  {txns.map(t => (
                                    <TransactionRow key={t.id} t={t}
                                      onToggle={() => togglePointee(t)}
                                      onEdit={() => openTransactionModal(id, t)}
                                      onDelete={() => setDeleteConfirm(t)} />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {deleteConfirm && (
        <Modal title="Supprimer la transaction" onClose={() => setDeleteConfirm(null)} size="sm">
          <p className="text-gray-600 mb-4">
            Supprimer <strong>{deleteConfirm.tiers_nom}</strong> ({fmt(deleteConfirm.montant)}) du {format(new Date(deleteConfirm.date), 'd MMM yyyy', { locale: fr })} ?
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Annuler</button>
            <button className="btn-danger" onClick={() => deleteTransaction(deleteConfirm)}>Supprimer</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TransactionRow({ t, onToggle, onEdit, onDelete }) {
  const montant = parseFloat(t.montant)
  return (
    <tr className={`hover:bg-gray-50 transition-colors ${t.pointee ? '' : 'opacity-80'}`}>
      <td className="pl-4 py-3 w-8">
        <button onClick={onToggle} className="text-gray-400 hover:text-emerald-500 transition-colors" title="Pointer">
          {t.pointee ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} />}
        </button>
      </td>
      <td className="py-3 w-24 text-gray-500 text-xs">{format(new Date(t.date), 'd MMM', { locale: fr })}</td>
      <td className="py-3 flex-1">
        <p className="font-medium text-gray-900">{t.tiers_nom || '—'}</p>
        {t.suivi_comptes_categories && (
          <p className="text-xs text-gray-400">
            {t.suivi_comptes_categories.parent}{t.suivi_comptes_categories.sous_categorie ? ` — ${t.suivi_comptes_categories.sous_categorie}` : ''}
          </p>
        )}
        {t.notes && <p className="text-xs text-gray-400 italic">{t.notes}</p>}
        {t.recurrence_id && <span className="text-xs bg-blue-50 text-blue-600 px-1 rounded">↻ récurrent</span>}
        {t.transfer_id && <span className="text-xs bg-purple-50 text-purple-600 px-1 rounded ml-1">↔ virement</span>}
      </td>
      <td className={`py-3 pr-2 text-right font-semibold text-sm ${montant >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {montant >= 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant)}
      </td>
      <td className="py-3 pr-4 w-16">
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="text-gray-300 hover:text-blue-500 transition-colors" title="Modifier"><Pencil size={14} /></button>
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors" title="Supprimer"><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  )
}
