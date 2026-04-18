import { useState, useEffect } from 'react'
import { format, addDays, addWeeks, addMonths, addYears, parseISO, isAfter, isBefore } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import Modal from './Modal'

const today = () => format(new Date(), 'yyyy-MM-dd')

const FREQ_LABELS = {
  hebdomadaire: 'Hebdomadaire (chaque semaine)',
  mensuel: 'Mensuel (chaque mois)',
  annuel: 'Annuel (chaque année)',
  personnalise: 'Personnalisé (tous les X jours)',
}

function nextDate(date, freq, intervalDays) {
  const d = parseISO(date)
  switch (freq) {
    case 'hebdomadaire': return addWeeks(d, 1)
    case 'mensuel': return addMonths(d, 1)
    case 'annuel': return addYears(d, 1)
    case 'personnalise': return addDays(d, intervalDays || 1)
    default: return addMonths(d, 1)
  }
}

function generateOccurrences(rule) {
  const occurrences = []
  const endDate = rule.date_fin ? parseISO(rule.date_fin) : addYears(new Date(), 2)
  let current = parseISO(rule.date_debut)
  while (!isAfter(current, endDate)) {
    occurrences.push(format(current, 'yyyy-MM-dd'))
    current = nextDate(format(current, 'yyyy-MM-dd'), rule.frequence, rule.intervalle_jours)
  }
  return occurrences
}

export default function TransactionFormModal() {
  const { transactionModal, closeTransactionModal, comptes, categories, tiers, loadComptes, openTransactionModal } = useApp()
  const { open, transaction, defaultCompteId } = transactionModal

  const [form, setForm] = useState({})
  const [isRecurrent, setIsRecurrent] = useState(false)
  const [recForm, setRecForm] = useState({ frequence: 'mensuel', intervalle_jours: 7, date_fin: '' })
  const [tierSearch, setTierSearch] = useState('')
  const [tierDropdown, setTierDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (transaction) {
      setForm({
        compte_id: transaction.compte_id,
        date: transaction.date,
        tiers_id: transaction.tiers_id || '',
        tiers_nom: transaction.tiers_nom || '',
        categorie_id: transaction.categorie_id || '',
        montant: transaction.montant,
        notes: transaction.notes || '',
        pointee: transaction.pointee || false,
      })
      setTierSearch(transaction.tiers_nom || '')
    } else {
      setForm({
        compte_id: defaultCompteId || comptes[0]?.id || '',
        date: today(),
        tiers_id: '',
        tiers_nom: '',
        categorie_id: '',
        montant: '',
        notes: '',
        pointee: false,
      })
      setTierSearch('')
    }
    setIsRecurrent(false)
    setError('')
  }, [open, transaction, defaultCompteId, comptes])

  if (!open) return null

  const catParents = [...new Set(categories.map(c => c.parent))].sort()
  const selectedParent = categories.find(c => c.id === form.categorie_id)?.parent || ''
  const subCats = categories.filter(c => c.parent === selectedParent)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function selectTiers(t) {
    setForm(f => ({
      ...f,
      tiers_id: t.id,
      tiers_nom: t.nom,
      categorie_id: t.categorie_id || f.categorie_id,
    }))
    setTierSearch(t.nom)
    setTierDropdown(false)
  }

  function handleTierInput(val) {
    setTierSearch(val)
    setField('tiers_nom', val)
    setField('tiers_id', '')
    setTierDropdown(true)
  }

  const filteredTiers = tiers.filter(t =>
    t.nom.toLowerCase().includes(tierSearch.toLowerCase())
  ).slice(0, 10)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (transaction) {
        // Edit existing
        const { error } = await supabase.from('transactions').update({
          compte_id: form.compte_id,
          date: form.date,
          tiers_id: form.tiers_id || null,
          tiers_nom: form.tiers_nom,
          categorie_id: form.categorie_id || null,
          montant: parseFloat(form.montant),
          notes: form.notes,
          pointee: form.pointee,
        }).eq('id', transaction.id)
        if (error) throw error
      } else if (isRecurrent) {
        // Create recurring rule + generate transactions
        const { data: rule, error: rErr } = await supabase.from('recurrences').insert({
          compte_id: form.compte_id,
          tiers_id: form.tiers_id || null,
          tiers_nom: form.tiers_nom,
          categorie_id: form.categorie_id || null,
          montant: parseFloat(form.montant),
          frequence: recForm.frequence,
          intervalle_jours: recForm.frequence === 'personnalise' ? parseInt(recForm.intervalle_jours) : null,
          date_debut: form.date,
          date_fin: recForm.date_fin || null,
          active: true,
        }).select().single()
        if (rErr) throw rErr

        const dates = generateOccurrences({
          date_debut: form.date,
          date_fin: recForm.date_fin || null,
          frequence: recForm.frequence,
          intervalle_jours: parseInt(recForm.intervalle_jours),
        })

        const txns = dates.map(d => ({
          compte_id: form.compte_id,
          date: d,
          tiers_id: form.tiers_id || null,
          tiers_nom: form.tiers_nom,
          categorie_id: form.categorie_id || null,
          montant: parseFloat(form.montant),
          notes: form.notes,
          pointee: false,
          recurrence_id: rule.id,
        }))

        const { error: tErr } = await supabase.from('transactions').insert(txns)
        if (tErr) throw tErr
      } else {
        // Single transaction
        const { error } = await supabase.from('transactions').insert({
          compte_id: form.compte_id,
          date: form.date,
          tiers_id: form.tiers_id || null,
          tiers_nom: form.tiers_nom,
          categorie_id: form.categorie_id || null,
          montant: parseFloat(form.montant),
          notes: form.notes,
          pointee: form.pointee,
        })
        if (error) throw error
      }
      closeTransactionModal()
    } catch (err) {
      setError(err.message || 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={transaction ? 'Modifier la transaction' : 'Nouvelle transaction'}
      onClose={closeTransactionModal}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Compte */}
        <div>
          <label className="label">Compte *</label>
          <select className="input" value={form.compte_id} onChange={e => setField('compte_id', e.target.value)} required>
            <option value="">— Choisir un compte —</option>
            {comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="label">Date *</label>
          <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} required />
        </div>

        {/* Tiers */}
        <div className="relative">
          <label className="label">Tiers *</label>
          <input
            type="text"
            className="input"
            placeholder="Chercher ou saisir un tiers…"
            value={tierSearch}
            onChange={e => handleTierInput(e.target.value)}
            onFocus={() => setTierDropdown(true)}
            onBlur={() => setTimeout(() => setTierDropdown(false), 150)}
            required
          />
          {tierDropdown && filteredTiers.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
              {filteredTiers.map(t => (
                <li
                  key={t.id}
                  className="px-3 py-2 hover:bg-emerald-50 cursor-pointer text-sm"
                  onMouseDown={() => selectTiers(t)}
                >
                  <span className="font-medium">{t.nom}</span>
                  {t.categories && (
                    <span className="text-gray-400 text-xs ml-2">
                      {t.categories.parent}{t.categories.sous_categorie ? ` — ${t.categories.sous_categorie}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Catégorie */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Catégorie</label>
            <select
              className="input"
              value={selectedParent}
              onChange={e => {
                const cats = categories.filter(c => c.parent === e.target.value)
                setField('categorie_id', cats[0]?.id || '')
              }}
            >
              <option value="">— Catégorie —</option>
              {catParents.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Sous-catégorie</label>
            <select
              className="input"
              value={form.categorie_id}
              onChange={e => setField('categorie_id', e.target.value)}
              disabled={!selectedParent}
            >
              {subCats.map(c => (
                <option key={c.id} value={c.id}>
                  {c.sous_categorie || '(aucune)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Montant */}
        <div>
          <label className="label">Montant * <span className="text-gray-400 font-normal">(négatif = dépense, positif = recette)</span></label>
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setField('montant', form.montant ? -Math.abs(parseFloat(form.montant)) : '')}
                className={`px-3 py-2 ${parseFloat(form.montant) < 0 ? 'bg-red-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                − Dépense
              </button>
              <button
                type="button"
                onClick={() => setField('montant', form.montant ? Math.abs(parseFloat(form.montant)) : '')}
                className={`px-3 py-2 ${parseFloat(form.montant) > 0 ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >
                + Recette
              </button>
            </div>
            <input
              type="number"
              step="0.01"
              className="input flex-1"
              placeholder="0.00"
              value={form.montant === '' ? '' : Math.abs(parseFloat(form.montant) || 0)}
              onChange={e => {
                const abs = parseFloat(e.target.value) || 0
                const signed = parseFloat(form.montant) >= 0 ? abs : -abs
                setField('montant', signed === 0 ? e.target.value : signed)
              }}
              required
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <input type="text" className="input" placeholder="Optionnel…" value={form.notes} onChange={e => setField('notes', e.target.value)} />
        </div>

        {/* Pointée */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="pointee"
            checked={form.pointee}
            onChange={e => setField('pointee', e.target.checked)}
            className="w-4 h-4 text-emerald-600"
          />
          <label htmlFor="pointee" className="text-sm text-gray-700">Transaction pointée (confirmée sur le relevé bancaire)</label>
        </div>

        {/* Récurrence (seulement pour nouvelle transaction) */}
        {!transaction && (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="recurrent"
                checked={isRecurrent}
                onChange={e => setIsRecurrent(e.target.checked)}
                className="w-4 h-4 text-emerald-600"
              />
              <label htmlFor="recurrent" className="text-sm font-medium text-gray-700">Transaction récurrente</label>
            </div>
            {isRecurrent && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-3">
                <div>
                  <label className="label">Fréquence</label>
                  <select
                    className="input"
                    value={recForm.frequence}
                    onChange={e => setRecForm(r => ({ ...r, frequence: e.target.value }))}
                  >
                    {Object.entries(FREQ_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                {recForm.frequence === 'personnalise' && (
                  <div>
                    <label className="label">Tous les X jours</label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={recForm.intervalle_jours}
                      onChange={e => setRecForm(r => ({ ...r, intervalle_jours: e.target.value }))}
                    />
                  </div>
                )}
                <div>
                  <label className="label">Date de fin <span className="text-gray-400 font-normal">(optionnel — vide = 2 ans)</span></label>
                  <input
                    type="date"
                    className="input"
                    value={recForm.date_fin}
                    onChange={e => setRecForm(r => ({ ...r, date_fin: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={closeTransactionModal}>Annuler</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : transaction ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
