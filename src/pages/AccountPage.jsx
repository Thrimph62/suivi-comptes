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
  const [expandedMonths, setExpandedMonths] = useState({})

  // Filters
  const [filterMonth, setFilterMonth] = useState('')
  const [filterCat, setFilterCat] = useState('')

  useEffect(() => {
    if (!id) return
    loadTransactions()
  }, [id])

  async function loadTransactions() {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, categories(parent, sous_categorie)')
      .eq('compte_id', id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    setTransactions(data || [])
    setLoading(false)
  }

  async function togglePointee(txn) {
    await supabase.from('transactions').update({ pointee: !txn.pointee }).eq('id', txn.id)
    setTransactions(ts => ts.map(t => t.id === txn.id ? { ...t, pointee: !t.pointee } : t))
  }

  async function deleteTransaction(txn) {
    await supabase.from('transactions').delete().eq('id', txn.id)
    setTransactions(ts => ts.filter(t => t.id !== txn.id))
    setDeleteConfirm(null)
  }

  if (!compte) return <p className="text-gray-500">Compte introuvable.</p>

  // Balances
  const soldeTheorique = parseFloat(compte.solde_initial) + transactions.reduce((s, t) => s + parseFloat(t.montant), 0)
  const soldePointe = parseFloat(compte.solde_initial) + transactions.filter(t => t.pointee).reduce((s, t) => s + parseFloat(t.montant), 0)
  const nonPointe = soldeTheorique - soldePointe

  // Distinct categories for filter
  const cats = [...new Set(transactions.map(t => t.categories?.parent).filter(Boolean))].sort()

  // Filter
  const filtered = transactions.filter(t => {
    const monthMatch = !filterMonth || t.date.startsWith(filterMonth)
    const catMatch = !filterCat || t.categories?.parent === filterCat
    return monthMatch && catMatch
  })

  // Group by month for display
  const grouped = filtered.reduce((acc, t) => {
    const key = t.date.slice(0, 7)
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{compte.nom}</h1>
          <p className="text-gray-500 text-sm">{compte.banque} · {compte.pays}</p>
        </div>
        <button
          onClick={() => openTransactionModal(id)}
          className="btn-primary flex items-center gap-2 shrink-0"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Solde théorique</p>
          <p className={`text-2xl font-bold mt-1 ${soldeTheorique >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
            {fmt(soldeTheorique)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Solde pointé ✓</p>
          <p className={`text-2xl font-bold mt-1 ${soldePointe >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {fmt(soldePointe)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Non pointé</p>
          <p className={`text-2xl font-bold mt-1 ${Math.abs(nonPointe) < 0.01 ? 'text-gray-400' : 'text-amber-500'}`}>
            {fmt(nonPointe)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={16} className="text-gray-400" />
        <input
          type="month"
          className="input w-auto text-sm"
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
        />
        <select className="input w-auto text-sm" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(filterMonth || filterCat) && (
          <button onClick={() => { setFilterMonth(''); setFilterCat('') }} className="text-sm text-emerald-600 hover:underline">
            Effacer filtres
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} transaction(s)</span>
      </div>

      {/* Transactions by month */}
      {loading ? (
        <p className="text-gray-400">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">Aucune transaction.</p>
          <button onClick={() => openTransactionModal(id)} className="btn-primary mt-3">
            Ajouter la première transaction
          </button>
        </div>
      ) : (() => {
        const sortedMonths = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))
        const allExpanded = sortedMonths.every(([m]) => expandedMonths[m])
        return (
          <>
            {/* Collapse / expand all */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  const next = {}
                  sortedMonths.forEach(([m]) => { next[m] = !allExpanded })
                  setExpandedMonths(next)
                }}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"
              >
                {allExpanded ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
                {allExpanded ? 'Tout replier' : 'Tout déplier'}
              </button>
            </div>

            {sortedMonths.map(([month, txns]) => {
              const monthTotal = txns.reduce((s, t) => s + parseFloat(t.montant), 0)
              const isOpen = !!expandedMonths[month]
              return (
                <div key={month}>
                  {/* Month header — clickable */}
                  <button
                    className="w-full flex items-center justify-between py-2 px-1 hover:bg-gray-50 rounded-lg transition-colors group"
                    onClick={() => setExpandedMonths(e => ({ ...e, [month]: !e[month] }))}
                  >
                    <div className="flex items-center gap-2">
                      {isOpen
                        ? <ChevronDown size={16} className="text-gray-400" />
                        : <ChevronRight size={16} className="text-gray-400" />
                      }
                      <span className="text-sm font-semibold text-gray-600 capitalize">
                        {format(new Date(month + '-01'), 'MMMM yyyy', { locale: fr })}
                      </span>
                      <span className="text-xs text-gray-400">({txns.length})</span>
                    </div>
                    <span className={`text-sm font-semibold ${monthTotal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {monthTotal >= 0 ? '+' : ''}{fmt(monthTotal)}
                    </span>
                  </button>

                  {/* Transactions — only shown when expanded */}
                  {isOpen && (
                    <div className="card p-0 overflow-hidden mt-1 mb-3">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-50">
                          {txns.map(t => (
                            <TransactionRow
                              key={t.id}
                              t={t}
                              onToggle={() => togglePointee(t)}
                              onEdit={() => openTransactionModal(id, t)}
                              onDelete={() => setDeleteConfirm(t)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )
      })()}

      {/* Delete confirmation modal */}
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
          {t.pointee
            ? <CheckCircle2 size={18} className="text-emerald-500" />
            : <Circle size={18} />
          }
        </button>
      </td>
      <td className="py-3 w-24 text-gray-500 text-xs">
        {format(new Date(t.date), 'd MMM', { locale: fr })}
      </td>
      <td className="py-3 flex-1">
        <p className="font-medium text-gray-900">{t.tiers_nom || '—'}</p>
        {t.categories && (
          <p className="text-xs text-gray-400">
            {t.categories.parent}{t.categories.sous_categorie ? ` — ${t.categories.sous_categorie}` : ''}
          </p>
        )}
        {t.notes && <p className="text-xs text-gray-400 italic">{t.notes}</p>}
        {t.recurrence_id && <span className="text-xs bg-blue-50 text-blue-600 px-1 rounded">↻ récurrent</span>}
      </td>
      <td className={`py-3 pr-2 text-right font-semibold text-sm ${montant >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
        {montant >= 0 ? '+' : ''}{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant)}
      </td>
      <td className="py-3 pr-4 w-16">
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="text-gray-300 hover:text-blue-500 transition-colors" title="Modifier">
            <Pencil size={14} />
          </button>
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors" title="Supprimer">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}
