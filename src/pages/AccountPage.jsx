import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Circle, Pencil, Trash2, Plus, Filter, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Archive } from 'lucide-react'
import { supabase, fetchAll } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { fmt, fmtDiff, fdate, catLabel, sum, TX } from '../lib/format'
import Modal from '../components/Modal'
import Projections from '../components/Projections'

const CLOS = 'suivi_comptes_mois_clotures'
const Amt = ({ v, cls = '' }) => <span className={`${cls} ${v >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmtDiff(v)}</span>
const Chev = ({ open, size = 16 }) => (open ? <ChevronDown size={size} className="text-gray-400" /> : <ChevronRight size={size} className="text-gray-400" />)

function groupByYearMonth(txns) {
  const g = {}
  for (const t of txns) ((g[t.date.slice(0, 4)] ??= {})[t.date.slice(0, 7)] ??= []).push(t)
  return g
}

// key={id} : l'état (dépliages, filtres) repart de zéro quand on change de compte
export default function AccountPage() {
  const { id } = useParams()
  return <Account key={id} id={id} />
}

function Account({ id }) {
  const { comptes, soldes, refresh, refreshTrigger, openTransactionModal } = useApp()
  const compte = comptes.find(c => c.id === id)
  const s = soldes[id]

  const [txns, setTxns] = useState([])
  const [closed, setClosed] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [open, setOpen] = useState({}) // 'archive' | année | 'a'+année (archivée) | mois
  const [filterMonth, setFilterMonth] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterPointe, setFilterPointe] = useState('toutes')

  useEffect(() => {
    let stale = false
    Promise.all([
      fetchAll(() => supabase.from(TX).select('*, suivi_comptes_categories(parent, sous_categorie)').eq('compte_id', id)
        .order('date', { ascending: false }).order('created_at', { ascending: false }).order('id')),
      supabase.from(CLOS).select('mois').eq('compte_id', id),
    ]).then(([rows, { data }]) => {
      if (stale) return
      setTxns(rows); setClosed(new Set((data || []).map(r => r.mois))); setLoading(false)
    }).catch(e => alert(e.message))
    return () => { stale = true }
  }, [id, refreshTrigger])

  // Toute écriture passe par ici : erreur affichée (plus d'échec silencieux), puis rechargement.
  async function run(p) {
    const { error } = await p
    if (error) alert(error.message)
    refresh()
  }
  const togglePointee = t => run(supabase.from(TX).update({ pointee: !t.pointee }).eq('id', t.id))
  // un virement = 2 lignes liées par transfer_id : on supprime les deux (sinon les soldes divergent)
  const remove = t => { run(supabase.from(TX).delete().eq(t.transfer_id ? 'transfer_id' : 'id', t.transfer_id || t.id)); setDeleteConfirm(null) }
  function toggleClosed(m) {
    const q = supabase.from(CLOS)
    if (closed.has(m)) return run(q.delete().eq('compte_id', id).eq('mois', m))
    setOpen(o => ({ ...o, [m]: false }))
    run(q.insert({ compte_id: id, mois: m }))
  }
  // fermer une année replie aussi ses mois
  const toggle = (k, year) => setOpen(o => {
    const n = { ...o, [k]: !o[k] }
    if (o[k] && year) Object.keys(n).forEach(m => { if (m.startsWith(year + '-')) n[m] = false })
    return n
  })

  if (!compte) return <p className="text-gray-500">Compte introuvable.</p>

  const cats = [...new Set(txns.map(t => t.suivi_comptes_categories?.parent).filter(Boolean))].sort()
  const filtered = txns.filter(t =>
    (!filterMonth || t.date.startsWith(filterMonth)) &&
    (!filterCat || t.suivi_comptes_categories?.parent === filterCat) &&
    (filterPointe === 'toutes' || (filterPointe === 'pointees') === !!t.pointee))
  const archived = filtered.filter(t => closed.has(t.date.slice(0, 7)))
  const main = groupByYearMonth(filtered.filter(t => !closed.has(t.date.slice(0, 7))))
  const mainYears = Object.keys(main)
  const everythingExpanded = mainYears.every(y => open[y] && Object.keys(main[y]).every(m => open[m]))
  const expandAll = () => setOpen(Object.fromEntries(mainYears.flatMap(y => [y, ...Object.keys(main[y])]).map(k => [k, true])))

  const years = (groups, isArchived) => Object.keys(groups).sort().map(year => {
    const months = Object.keys(groups[year]).sort()
    const all = months.flatMap(m => groups[year][m])
    const yk = (isArchived ? 'a' : '') + year
    return (
      <div key={yk} className="space-y-1">
        <button onClick={() => toggle(yk, year)}
          className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors ${isArchived ? 'bg-slate-50 hover:bg-slate-100' : 'bg-gray-100 hover:bg-gray-200'}`}>
          <div className="flex items-center gap-2">
            <Chev open={open[yk]} size={17} />
            <span className="font-bold text-gray-800 text-base">{year}</span>
            <span className="text-xs text-gray-500">({all.length} transaction{all.length > 1 ? 's' : ''})</span>
          </div>
          <Amt v={sum(all)} cls="font-bold text-sm" />
        </button>
        {open[yk] && (
          <div className="ml-4 space-y-1">
            {months.map(m => {
              const t = groups[year][m]
              return (
                <div key={m}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={isArchived} onChange={() => toggleClosed(m)} className="w-4 h-4 text-emerald-600 rounded shrink-0 cursor-pointer"
                      title={isArchived ? 'Retirer du Pointage Terminé' : 'Marquer comme Pointage Terminé'} />
                    <button onClick={() => toggle(m)} className="flex-1 flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <Chev open={open[m]} size={15} />
                        <span className="text-sm font-semibold text-gray-600 capitalize">{fdate(m + '-01', 'MMMM yyyy')}</span>
                        <span className="text-xs text-gray-400">({t.length})</span>
                      </div>
                      <Amt v={sum(t)} cls="text-sm font-semibold" />
                    </button>
                  </div>
                  {open[m] && (
                    <div className={`card p-0 overflow-hidden mt-1 mb-2 ml-6 ${isArchived ? 'opacity-75' : ''}`}>
                      <table className="w-full text-sm"><tbody className="divide-y divide-gray-50">
                        {t.map(x => <TransactionRow key={x.id} t={x} onToggle={() => togglePointee(x)}
                          onEdit={() => openTransactionModal(id, x)} onDelete={() => setDeleteConfirm(x)} />)}
                      </tbody></table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{compte.nom}</h1>
          <p className="text-gray-500 text-sm">{compte.banque} · {compte.pays}</p>
        </div>
        <button onClick={() => openTransactionModal(id)} className="btn-primary flex items-center gap-2 shrink-0"><Plus size={16} /> Ajouter</button>
      </div>

      {s && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Solde théorique</p>
            <p className={`text-2xl font-bold mt-1 ${s.aujourdhui >= 0 ? 'text-gray-900' : 'text-red-500'}`}>{fmt(s.aujourdhui)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Solde pointé ✓</p>
            <p className={`text-2xl font-bold mt-1 ${s.pointe >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(s.pointe)}</p>
            {Math.abs(s.aujourdhui - s.pointe) > 0.01 && <p className="text-xs text-amber-500 mt-1 font-medium">Non pointé : {fmtDiff(s.aujourdhui - s.pointe)}</p>}
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Projections</p>
            <div className="space-y-1.5"><Projections s={s} /></div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={16} className="text-gray-400" />
        <input type="month" className="input w-auto text-sm" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        <select className="input w-auto text-sm" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Toutes catégories</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-auto text-sm" value={filterPointe} onChange={e => setFilterPointe(e.target.value)}>
          <option value="toutes">Toutes</option>
          <option value="pointees">Pointées ✓</option>
          <option value="non_pointees">Non pointées ○</option>
        </select>
        {(filterMonth || filterCat || filterPointe !== 'toutes') && (
          <button onClick={() => { setFilterMonth(''); setFilterCat(''); setFilterPointe('toutes') }} className="text-sm text-emerald-600 hover:underline">Effacer filtres</button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} transaction(s)</span>
      </div>

      {loading ? <p className="text-gray-400">Chargement…</p> : filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-400">Aucune transaction.</p>
          <button onClick={() => openTransactionModal(id)} className="btn-primary mt-3">Ajouter la première transaction</button>
        </div>
      ) : (
        <>
          {mainYears.length > 0 && (
            <>
              <div className="flex justify-end">
                <button onClick={() => (everythingExpanded ? setOpen({}) : expandAll())} className="flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                  {everythingExpanded ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
                  {everythingExpanded ? 'Tout replier' : 'Tout déplier'}
                </button>
              </div>
              {years(main, false)}
            </>
          )}
          {archived.length > 0 && (
            <div className="mt-4">
              <button onClick={() => toggle('archive')} className="w-full flex items-center justify-between py-3 px-4 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                <div className="flex items-center gap-2">
                  <Chev open={open.archive} size={17} />
                  <Archive size={16} className="text-slate-500" />
                  <span className="font-bold text-slate-700">Pointage Terminé</span>
                  <span className="text-xs text-slate-500">({closed.size} mois · {archived.length} transaction{archived.length > 1 ? 's' : ''})</span>
                </div>
                <Amt v={sum(archived)} cls="font-bold text-sm" />
              </button>
              {open.archive && <div className="mt-2 space-y-1">{years(groupByYearMonth(archived), true)}</div>}
            </div>
          )}
        </>
      )}

      {deleteConfirm && (
        <Modal title="Supprimer la transaction" onClose={() => setDeleteConfirm(null)} size="sm">
          <p className="text-gray-600 mb-4">
            Supprimer <strong>{deleteConfirm.tiers_nom}</strong> ({fmt(deleteConfirm.montant)}) du {fdate(deleteConfirm.date)} ?
            {deleteConfirm.transfer_id && <span className="block text-amber-600 text-sm mt-2">Virement : l'opération correspondante sur l'autre compte sera aussi supprimée.</span>}
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>Annuler</button>
            <button className="btn-danger" onClick={() => remove(deleteConfirm)}>Supprimer</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function TransactionRow({ t, onToggle, onEdit, onDelete }) {
  return (
    <tr className={`hover:bg-gray-50 transition-colors ${t.pointee ? '' : 'opacity-80'}`}>
      <td className="pl-4 py-3 w-8">
        <button onClick={onToggle} className="text-gray-400 hover:text-emerald-500 transition-colors" title="Pointer">
          {t.pointee ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} />}
        </button>
      </td>
      <td className="py-3 w-24 text-gray-500 text-xs">{fdate(t.date, 'd MMM')}</td>
      <td className="py-3 flex-1">
        <p className="font-medium text-gray-900">{t.tiers_nom || '—'}</p>
        {t.suivi_comptes_categories && <p className="text-xs text-gray-400">{catLabel(t.suivi_comptes_categories)}</p>}
        {t.notes && <p className="text-xs text-gray-400 italic">{t.notes}</p>}
        {t.recurrence_id && <span className="text-xs bg-blue-50 text-blue-600 px-1 rounded">↻ récurrent</span>}
        {t.transfer_id && <span className="text-xs bg-purple-50 text-purple-600 px-1 rounded ml-1">↔ virement</span>}
      </td>
      <td className="py-3 pr-2 text-right"><Amt v={Number(t.montant)} cls="font-semibold text-sm" /></td>
      <td className="py-3 pr-4 w-16">
        <div className="flex items-center gap-1">
          {/* un virement ne se modifie pas (les 2 lignes divergeraient) : supprimer puis recréer */}
          {!t.transfer_id && <button onClick={onEdit} className="text-gray-300 hover:text-blue-500 transition-colors" title="Modifier"><Pencil size={14} /></button>}
          <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors" title="Supprimer"><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  )
}
