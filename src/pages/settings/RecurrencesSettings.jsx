import { useEffect, useState } from 'react'
import { Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmt, fdate, catLabel, TX } from '../../lib/format'
import { useApp } from '../../contexts/AppContext'
import Modal from '../../components/Modal'

const FREQ_LABELS = {
  hebdomadaire: 'Hebdomadaire', mensuel: 'Mensuel', annuel: 'Annuel', personnalise: 'Personnalisé',
}

export default function RecurrencesSettings() {
  const { refresh } = useApp()
  const [recurrences, setRecurrences] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [futureCounts, setFutureCounts] = useState({})

  useEffect(() => { loadRecurrences() }, [])

  async function loadRecurrences() {
    // une requête pour les règles, une pour les comptes d'occurrences futures (vue SQL)
    const [{ data }, { data: counts }] = await Promise.all([
      supabase.from('suivi_comptes_recurrences')
        .select('*, suivi_comptes_comptes(nom), suivi_comptes_categories(parent, sous_categorie)').order('date_debut', { ascending: false }),
      supabase.from('suivi_comptes_occurrences_futures').select('*'),
    ])
    setRecurrences(data || [])
    setFutureCounts(Object.fromEntries((counts || []).map(r => [r.recurrence_id, r.n])))
    setLoading(false)
  }

  async function deleteRecurrence(rec) {
    setDeleting(true)
    const today = new Date().toLocaleDateString('sv', { timeZone: 'Europe/Brussels' }) // AAAA-MM-JJ
    const { error } = await supabase.from(TX).delete().eq('recurrence_id', rec.id).gt('date', today)
    if (error) alert(error.message)
    else {
      const { error: e2 } = await supabase.from('suivi_comptes_recurrences').delete().eq('id', rec.id)
      if (e2) alert(e2.message)
    }
    await loadRecurrences(); refresh()
    setDeleteTarget(null)
    setDeleting(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transactions récurrentes</h1>
        <p className="text-sm text-gray-500 mt-1">Supprimer une règle efface toutes ses occurrences futures (les passées sont conservées).</p>
      </div>

      {loading ? <p className="text-gray-400">Chargement…</p> : recurrences.length === 0 ? (
        <div className="card text-center py-10">
          <RefreshCw size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Aucune transaction récurrente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recurrences.map(rec => {
            const montant = Number(rec.montant)
            return (
              <div key={rec.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{rec.tiers_nom || '—'}</span>
                      <span className={`font-bold text-sm ${montant >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {montant >= 0 ? '+' : ''}{fmt(montant)}
                      </span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {FREQ_LABELS[rec.frequence]}{rec.frequence === 'personnalise' && ` (${rec.intervalle_jours}j)`}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>📂 {rec.suivi_comptes_comptes?.nom || '—'}</span>
                      <span>🏷 {catLabel(rec.suivi_comptes_categories)}</span>
                      <span>📅 Début : {fdate(rec.date_debut)}</span>
                      {rec.date_fin && <span>Fin : {fdate(rec.date_fin)}</span>}
                    </div>
                    <p className="text-xs text-amber-600 mt-1">{futureCounts[rec.id] ?? '…'} occurrence(s) future(s) programmée(s)</p>
                  </div>
                  <button onClick={() => setDeleteTarget(rec)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-1">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <Modal title="Supprimer la récurrence" onClose={() => setDeleteTarget(null)} size="sm">
          <div className="space-y-3">
            <p className="text-gray-600">Supprimer la règle <strong>{deleteTarget.tiers_nom}</strong> ({FREQ_LABELS[deleteTarget.frequence].toLowerCase()}) ?</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠️ Les <strong>{futureCounts[deleteTarget.id] || 0} transaction(s) future(s)</strong> associées seront également supprimées. Les transactions passées seront conservées.
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button className="btn-danger" onClick={() => deleteRecurrence(deleteTarget)} disabled={deleting}>{deleting ? 'Suppression…' : 'Supprimer'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
