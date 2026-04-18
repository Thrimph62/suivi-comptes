import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../contexts/AppContext'
import Modal from '../../components/Modal'

function fmt(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

const FREQ_LABELS = {
  hebdomadaire: 'Hebdomadaire',
  mensuel: 'Mensuel',
  annuel: 'Annuel',
  personnalise: 'Personnalisé',
}

export default function RecurrencesSettings() {
  const { comptes } = useApp()
  const [recurrences, setRecurrences] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [futureCounts, setFutureCounts] = useState({})

  useEffect(() => {
    loadRecurrences()
  }, [])

  async function loadRecurrences() {
    setLoading(true)
    const { data } = await supabase
      .from('recurrences')
      .select('*, comptes(nom), categories(parent, sous_categorie)')
      .order('date_debut', { ascending: false })
    setRecurrences(data || [])

    // Count future transactions per recurrence
    const today = format(new Date(), 'yyyy-MM-dd')
    const counts = {}
    for (const r of (data || [])) {
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('recurrence_id', r.id)
        .gt('date', today)
      counts[r.id] = count || 0
    }
    setFutureCounts(counts)
    setLoading(false)
  }

  async function deleteRecurrence(rec) {
    setDeleting(true)
    const today = format(new Date(), 'yyyy-MM-dd')
    // Delete future transactions
    await supabase.from('transactions')
      .delete()
      .eq('recurrence_id', rec.id)
      .gt('date', today)
    // Delete the rule
    await supabase.from('recurrences').delete().eq('id', rec.id)
    await loadRecurrences()
    setDeleteTarget(null)
    setDeleting(false)
  }

  function getCatLabel(rec) {
    if (!rec.categories) return '—'
    return rec.categories.sous_categorie
      ? `${rec.categories.parent} — ${rec.categories.sous_categorie}`
      : rec.categories.parent
  }

  function getCompteName(rec) {
    return rec.comptes?.nom || '—'
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Transactions récurrentes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Supprimer une règle efface toutes ses occurrences futures (les passées sont conservées).
        </p>
      </div>

      {loading ? (
        <p className="text-gray-400">Chargement…</p>
      ) : recurrences.length === 0 ? (
        <div className="card text-center py-10">
          <RefreshCw size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">Aucune transaction récurrente.</p>
          <p className="text-sm text-gray-400 mt-1">Créez-en une via le bouton "Ajouter une transaction".</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recurrences.map(rec => {
            const montant = parseFloat(rec.montant)
            const futureCount = futureCounts[rec.id] ?? '…'
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
                        {FREQ_LABELS[rec.frequence]}
                        {rec.frequence === 'personnalise' && ` (${rec.intervalle_jours}j)`}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>📂 {getCompteName(rec)}</span>
                      <span>🏷 {getCatLabel(rec)}</span>
                      <span>📅 Début : {format(new Date(rec.date_debut), 'd MMM yyyy', { locale: fr })}</span>
                      {rec.date_fin && <span>Fin : {format(new Date(rec.date_fin), 'd MMM yyyy', { locale: fr })}</span>}
                    </div>

                    <p className="text-xs text-amber-600 mt-1">
                      {futureCount} occurrence(s) future(s) programmée(s)
                    </p>
                  </div>

                  <button
                    onClick={() => setDeleteTarget(rec)}
                    className="text-gray-300 hover:text-red-500 transition-colors shrink-0 mt-1"
                    title="Supprimer cette règle récurrente"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Modal title="Supprimer la récurrence" onClose={() => setDeleteTarget(null)} size="sm">
          <div className="space-y-3">
            <p className="text-gray-600">
              Supprimer la règle <strong>{deleteTarget.tiers_nom}</strong> ({FREQ_LABELS[deleteTarget.frequence].toLowerCase()}) ?
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              ⚠️ Les <strong>{futureCounts[deleteTarget.id] || 0} transaction(s) future(s)</strong> associées seront également supprimées.
              Les transactions passées seront conservées.
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button className="btn-danger" onClick={() => deleteRecurrence(deleteTarget)} disabled={deleting}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
