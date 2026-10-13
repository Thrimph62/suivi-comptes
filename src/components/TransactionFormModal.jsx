import { useState, useEffect } from 'react'
import { format, addDays, addWeeks, addMonths, addYears, parseISO, isAfter } from 'date-fns'
import { ArrowLeftRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../contexts/AppContext'
import { catLabel, TX } from '../lib/format'
import Modal from './Modal'

const REC = 'suivi_comptes_recurrences'
const CAT = 'suivi_comptes_categories'
const today = () => format(new Date(), 'yyyy-MM-dd')
const REC0 = { frequence: 'mensuel', intervalle_jours: 7, date_fin: '' }
const FREQ_LABELS = {
  hebdomadaire: 'Hebdomadaire (chaque semaine)',
  mensuel: 'Mensuel (chaque mois)',
  annuel: 'Annuel (chaque année)',
  personnalise: 'Personnalisé (tous les X jours)',
}

// Dates calculées depuis le début (addMonths(début, i)) : le 31 janvier donne 28 fév. puis 31 mars (et non 28 mars).
function occurrences(start, { frequence, intervalle_jours, date_fin }) {
  const s = parseISO(start)
  const end = date_fin ? parseISO(date_fin) : addYears(new Date(), 2)
  const n = Math.max(1, parseInt(intervalle_jours) || 1)
  const at = { hebdomadaire: i => addWeeks(s, i), mensuel: i => addMonths(s, i), annuel: i => addYears(s, i), personnalise: i => addDays(s, i * n) }[frequence]
  const out = []
  for (let i = 0, d = s; !isAfter(d, end); d = at(++i)) out.push(format(d, 'yyyy-MM-dd'))
  if (!out.length) throw new Error('La date de fin est avant la date de début.')
  return out
}

const ok = ({ error }) => { if (error) throw error }

function RecurrenceFields({ id, label, on, setOn, rec, setRec }) {
  const set = (k, v) => setRec(r => ({ ...r, [k]: v }))
  return (
    <div className="border-t border-gray-100 pt-3">
      <div className="flex items-center gap-2 mb-3">
        <input type="checkbox" id={id} checked={on} onChange={e => setOn(e.target.checked)} className="w-4 h-4 text-emerald-600" />
        <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
      </div>
      {on && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-3">
          <div>
            <label className="label">Fréquence</label>
            <select className="input" value={rec.frequence} onChange={e => set('frequence', e.target.value)}>
              {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {rec.frequence === 'personnalise' && (
            <div>
              <label className="label">Tous les X jours</label>
              <input type="number" min="1" className="input" value={rec.intervalle_jours} onChange={e => set('intervalle_jours', e.target.value)} />
            </div>
          )}
          <div>
            <label className="label">Date de fin <span className="text-gray-400 font-normal">(optionnel — vide = 2 ans)</span></label>
            <input type="date" className="input" value={rec.date_fin} onChange={e => set('date_fin', e.target.value)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function TransactionFormModal() {
  const { transactionModal, closeTransactionModal, comptes, categories, tiers, loadCategories, loadTiers } = useApp()
  const { open, transaction, defaultCompteId } = transactionModal

  const [mode, setMode] = useState('transaction') // 'transaction' | 'virement'
  const [form, setForm] = useState({})
  const [transfer, setTransfer] = useState({ from: '', to: '', montant: '', date: today(), notes: '' })
  const [isRecurrent, setIsRecurrent] = useState(false)
  const [rec, setRec] = useState(REC0)
  const [tierSearch, setTierSearch] = useState('')
  const [tierDropdown, setTierDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setMode('transaction'); setError(''); setIsRecurrent(false); setRec(REC0)
    if (transaction) {
      setForm({
        compte_id: transaction.compte_id, date: transaction.date,
        tiers_id: transaction.tiers_id || '', tiers_nom: transaction.tiers_nom || '',
        categorie_id: transaction.categorie_id || '', montant: transaction.montant,
        notes: transaction.notes || '', pointee: transaction.pointee || false,
      })
      setTierSearch(transaction.tiers_nom || '')
    } else {
      const first = defaultCompteId || comptes[0]?.id || ''
      setForm({ compte_id: first, date: today(), tiers_id: '', tiers_nom: '', categorie_id: '', montant: '', notes: '', pointee: false })
      setTransfer({ from: first, to: comptes.find(c => c.id !== first)?.id || '', montant: '', date: today(), notes: '' })
      setTierSearch('')
    }
  }, [open, transaction, defaultCompteId, comptes])

  if (!open) return null

  const isEditing = !!transaction
  const catParents = [...new Set(categories.map(c => c.parent))].sort()
  const selectedParent = categories.find(c => c.id === form.categorie_id)?.parent || ''
  const subCats = categories.filter(c => c.parent === selectedParent)
  const filteredTiers = tiers.filter(t => t.nom.toLowerCase().includes(tierSearch.toLowerCase())).slice(0, 10)
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setTransferField = (k, v) => setTransfer(f => ({ ...f, [k]: v }))
  const rule = date => ({
    frequence: rec.frequence, date_debut: date, date_fin: rec.date_fin || null, active: true,
    intervalle_jours: rec.frequence === 'personnalise' ? parseInt(rec.intervalle_jours) : null,
  })

  function selectTiers(t) {
    setForm(f => ({ ...f, tiers_id: t.id, tiers_nom: t.nom, categorie_id: t.categorie_id || f.categorie_id }))
    setTierSearch(t.nom); setTierDropdown(false)
  }

  async function save(fn) {
    setSaving(true); setError('')
    try { await fn(); closeTransactionModal(true) }
    catch (err) { setError(err.message || "Erreur lors de l'enregistrement.") }
    finally { setSaving(false) }
  }

  // Insère les règles puis les transactions ; si les transactions échouent, les règles sont retirées (pas d'orphelines).
  async function insertWithRules(rules, rows) {
    if (rules.length) ok(await supabase.from(REC).insert(rules))
    const { error } = await supabase.from(TX).insert(rows)
    if (error) {
      if (rules.length) await supabase.from(REC).delete().in('id', rules.map(r => r.id))
      throw error
    }
  }

  async function virementCategory() {
    const { data } = await supabase.from(CAT).select('id').eq('parent', 'Virement Interne').is('sous_categorie', null).limit(1)
    if (data?.[0]) return data[0].id
    const { data: c, error } = await supabase.from(CAT).insert({ parent: 'Virement Interne', sous_categorie: null }).select('id').single()
    if (error) throw error
    loadCategories()
    return c.id
  }

  // Tiers saisi à la main : on le retrouve (même nom) ou on le crée avec la catégorie choisie,
  // pour que la catégorie se remplisse toute seule la prochaine fois. Ne change jamais la catégorie d'un tiers déjà catégorisé.
  async function resolveTiers() {
    const nom = form.tiers_nom.trim()
    const cat = form.categorie_id || null
    const known = tiers.find(t => t.id === form.tiers_id) || tiers.find(t => t.nom.toLowerCase() === nom.toLowerCase())
    if (known) {
      if (!known.categorie_id && cat) { ok(await supabase.from('suivi_comptes_tiers').update({ categorie_id: cat }).eq('id', known.id)); loadTiers() }
      return known.id
    }
    const { data, error } = await supabase.from('suivi_comptes_tiers').insert({ nom, categorie_id: cat }).select('id').single()
    if (error) throw error
    loadTiers()
    return data.id
  }

  const submitTransaction = e => {
    e.preventDefault()
    save(async () => {
      const tiers_id = form.tiers_nom.trim() ? await resolveTiers() : null
      const row = {
        compte_id: form.compte_id, date: form.date, tiers_id, tiers_nom: form.tiers_nom.trim(),
        categorie_id: form.categorie_id || null, montant: parseFloat(form.montant), notes: form.notes,
      }
      if (transaction) return ok(await supabase.from(TX).update({ ...row, pointee: form.pointee }).eq('id', transaction.id))
      if (!isRecurrent) return ok(await supabase.from(TX).insert({ ...row, pointee: form.pointee }))
      const id = crypto.randomUUID()
      const { date, notes, ...base } = row
      await insertWithRules(
        [{ id, ...rule(form.date), compte_id: row.compte_id, tiers_id: row.tiers_id, tiers_nom: row.tiers_nom, categorie_id: row.categorie_id, montant: row.montant }],
        occurrences(form.date, rec).map(d => ({ ...base, date: d, notes, pointee: false, recurrence_id: id })))
    })
  }

  const submitTransfer = () => {
    if (!transfer.from || !transfer.to || !transfer.montant) return setError('Veuillez remplir tous les champs obligatoires.')
    if (transfer.from === transfer.to) return setError('Le compte source et le compte destination doivent être différents.')
    save(async () => {
      const amount = Math.abs(parseFloat(transfer.montant))
      const A = comptes.find(c => c.id === transfer.from)
      const B = comptes.find(c => c.id === transfer.to)
      const categorie_id = await virementCategory()
      const dates = isRecurrent ? occurrences(transfer.date, rec) : [transfer.date]
      // une règle par jambe (sortie / entrée)
      const rules = isRecurrent ? [[A, B, -amount], [B, A, amount]].map(([c, other, montant]) =>
        ({ id: crypto.randomUUID(), ...rule(transfer.date), compte_id: c.id, tiers_nom: other.nom, categorie_id, montant })) : []
      const rows = dates.flatMap(date => {
        const transfer_id = crypto.randomUUID()
        return [[A, B, -amount], [B, A, amount]].map(([c, other, montant], i) => ({
          compte_id: c.id, date, tiers_nom: other.nom, categorie_id, montant, notes: transfer.notes || null,
          pointee: false, transfer_id, recurrence_id: rules[i]?.id,
        }))
      })
      await insertWithRules(rules, rows)
    })
  }

  const actions = (onClick, label) => (
    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
      <button type="button" className="btn-secondary" onClick={() => closeTransactionModal(false)}>Annuler</button>
      <button type={onClick ? 'button' : 'submit'} className="btn-primary" onClick={onClick} disabled={saving}>{saving ? 'Enregistrement…' : label}</button>
    </div>
  )
  const modeBtn = (m, children) => (
    <button type="button" onClick={() => setMode(m)}
      className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${mode === m ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{children}</button>
  )

  return (
    <Modal title={isEditing ? 'Modifier la transaction' : 'Nouvelle opération'} onClose={() => closeTransactionModal(false)} size="md">
      {!isEditing && (
        <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-5">
          {modeBtn('transaction', 'Transaction')}
          {modeBtn('virement', <><ArrowLeftRight size={15} /> Virement interne</>)}
        </div>
      )}

      {mode === 'virement' && !isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Compte source *</label>
              <select className="input" value={transfer.from} onChange={e => setTransferField('from', e.target.value)}>
                <option value="">— Choisir —</option>
                {comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Compte destination *</label>
              <select className="input" value={transfer.to} onChange={e => setTransferField('to', e.target.value)}>
                <option value="">— Choisir —</option>
                {comptes.filter(c => c.id !== transfer.from).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          </div>
          {transfer.from && transfer.to && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <span className="font-medium text-red-500 truncate">{comptes.find(c => c.id === transfer.from)?.nom}</span>
              <ArrowLeftRight size={14} className="shrink-0 text-gray-400" />
              <span className="font-medium text-emerald-600 truncate">{comptes.find(c => c.id === transfer.to)?.nom}</span>
            </div>
          )}
          <div>
            <label className="label">Montant * (€)</label>
            <input type="number" step="0.01" min="0" className="input" placeholder="0.00" value={transfer.montant} onChange={e => setTransferField('montant', e.target.value)} />
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={transfer.date} onChange={e => setTransferField('date', e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" className="input" placeholder="Optionnel…" value={transfer.notes} onChange={e => setTransferField('notes', e.target.value)} />
          </div>
          <RecurrenceFields id="recurrent" label="Virement récurrent" on={isRecurrent} setOn={setIsRecurrent} rec={rec} setRec={setRec} />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {actions(submitTransfer, isRecurrent ? 'Créer les virements récurrents' : 'Effectuer le virement')}
        </div>
      ) : (
        <form onSubmit={submitTransaction} className="space-y-4">
          <div>
            <label className="label">Compte *</label>
            <select className="input" value={form.compte_id} onChange={e => setField('compte_id', e.target.value)} required>
              <option value="">— Choisir un compte —</option>
              {comptes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} required />
          </div>
          <div className="relative">
            <label className="label">Tiers *</label>
            <input type="text" className="input" placeholder="Chercher ou saisir un tiers…" value={tierSearch}
              onChange={e => { setTierSearch(e.target.value); setForm(f => ({ ...f, tiers_nom: e.target.value, tiers_id: '' })); setTierDropdown(true) }}
              onFocus={() => setTierDropdown(true)} onBlur={() => setTimeout(() => setTierDropdown(false), 150)} required />
            {tierDropdown && filteredTiers.length > 0 && (
              <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                {filteredTiers.map(t => (
                  <li key={t.id} className="px-3 py-2 hover:bg-emerald-50 cursor-pointer text-sm" onMouseDown={() => selectTiers(t)}>
                    <span className="font-medium">{t.nom}</span>
                    {t.suivi_comptes_categories && <span className="text-gray-400 text-xs ml-2">{catLabel(t.suivi_comptes_categories)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Catégorie</label>
              <select className="input" value={selectedParent} onChange={e => setField('categorie_id', categories.find(c => c.parent === e.target.value)?.id || '')}>
                <option value="">— Catégorie —</option>
                {catParents.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sous-catégorie</label>
              <select className="input" value={form.categorie_id} onChange={e => setField('categorie_id', e.target.value)} disabled={!selectedParent}>
                {subCats.map(c => <option key={c.id} value={c.id}>{c.sous_categorie || '(aucune)'}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Montant * <span className="text-gray-400 font-normal">(négatif = dépense, positif = recette)</span></label>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                <button type="button" onClick={() => setField('montant', form.montant ? -Math.abs(parseFloat(form.montant)) : '')}
                  className={`px-3 py-2 ${parseFloat(form.montant) < 0 ? 'bg-red-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>− Dépense</button>
                <button type="button" onClick={() => setField('montant', form.montant ? Math.abs(parseFloat(form.montant)) : '')}
                  className={`px-3 py-2 ${parseFloat(form.montant) > 0 ? 'bg-emerald-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>+ Recette</button>
              </div>
              <input type="number" step="0.01" className="input flex-1" placeholder="0.00"
                value={form.montant === '' ? '' : Math.abs(parseFloat(form.montant) || 0)}
                onChange={e => {
                  const abs = parseFloat(e.target.value) || 0
                  const signed = parseFloat(form.montant) >= 0 ? abs : -abs
                  setField('montant', signed === 0 ? e.target.value : signed)
                }} required />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" className="input" placeholder="Optionnel…" value={form.notes} onChange={e => setField('notes', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="pointee" checked={form.pointee} onChange={e => setField('pointee', e.target.checked)} className="w-4 h-4 text-emerald-600" />
            <label htmlFor="pointee" className="text-sm text-gray-700">Transaction pointée (confirmée sur le relevé bancaire)</label>
          </div>
          {!isEditing && <RecurrenceFields id="recurrent" label="Transaction récurrente" on={isRecurrent} setOn={setIsRecurrent} rec={rec} setRec={setRec} />}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {actions(null, isEditing ? 'Mettre à jour' : 'Enregistrer')}
        </form>
      )}
    </Modal>
  )
}
