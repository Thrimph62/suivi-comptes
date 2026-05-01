import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../contexts/AppContext'
import Modal from '../../components/Modal'

const TYPES = { courant: 'Compte courant', epargne: 'Épargne', cheques_repas: 'Chèques repas', titres_services: 'Titres services', autre: 'Autre' }
const PAYS = ['BE', 'FR', 'Autre']

export default function AccountsSettings() {
  const { comptes, loadComptes } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nom: '', type: 'courant', banque: '', pays: 'BE', solde_initial: '0', ordre: '99' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function openAdd() {
    setEditing(null)
    setForm({ nom: '', type: 'courant', banque: '', pays: 'BE', solde_initial: '0', ordre: String(comptes.length + 1) })
    setShowModal(true)
  }

  function openEdit(c) {
    setEditing(c)
    setForm({ nom: c.nom, type: c.type, banque: c.banque || '', pays: c.pays || 'BE', solde_initial: String(c.solde_initial ?? 0), ordre: String(c.ordre ?? 99) })
    setShowModal(true)
  }

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    const payload = { nom: form.nom.trim(), type: form.type, banque: form.banque.trim() || null, pays: form.pays, solde_initial: parseFloat(form.solde_initial) || 0, ordre: parseInt(form.ordre) || 99 }
    if (editing) {
      await supabase.from('suivi_comptes_comptes').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('suivi_comptes_comptes').insert(payload)
    }
    await loadComptes()
    setShowModal(false)
    setSaving(false)
  }

  async function deleteAccount(id) {
    await supabase.from('suivi_comptes_comptes').delete().eq('id', id)
    await loadComptes()
    setDeleteTarget(null)
  }

  const grouped = comptes.reduce((acc, c) => { if (!acc[c.type]) acc[c.type] = []; acc[c.type].push(c); return acc }, {})

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptes</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez vos comptes et soldes initiaux</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} /> Nouveau compte</button>
      </div>

      {Object.entries(grouped).map(([type, accounts]) => (
        <div key={type}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{TYPES[type]}</h2>
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {accounts.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.nom}</p>
                      <p className="text-xs text-gray-400">{c.banque || '—'} · {c.pays}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-xs text-gray-400">Solde initial</p>
                      <p className={`font-semibold ${parseFloat(c.solde_initial) >= 0 ? 'text-gray-700' : 'text-red-500'}`}>
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(c.solde_initial)}
                      </p>
                    </td>
                    <td className="px-4 py-3 w-16">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(c)} className="text-gray-300 hover:text-blue-500"><Pencil size={14} /></button>
                        <button onClick={() => setDeleteTarget(c)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {showModal && (
        <Modal title={editing ? 'Modifier le compte' : 'Nouveau compte'} onClose={() => setShowModal(false)} size="sm">
          <div className="space-y-3">
            <div>
              <label className="label">Nom *</label>
              <input type="text" className="input" value={form.nom} onChange={e => setField('nom', e.target.value)} autoFocus placeholder="ex: Compte Courant BNP" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.type} onChange={e => setField('type', e.target.value)}>
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Pays</label>
                <select className="input" value={form.pays} onChange={e => setField('pays', e.target.value)}>
                  {PAYS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Banque</label>
              <input type="text" className="input" value={form.banque} onChange={e => setField('banque', e.target.value)} placeholder="ex: Argenta" />
            </div>
            <div>
              <label className="label">Solde initial (€) <span className="text-gray-400 font-normal ml-1">— solde au démarrage du suivi</span></label>
              <input type="number" step="0.01" className="input" value={form.solde_initial} onChange={e => setField('solde_initial', e.target.value)} />
            </div>
            <div>
              <label className="label">Ordre d'affichage</label>
              <input type="number" className="input" value={form.ordre} onChange={e => setField('ordre', e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn-primary" onClick={save} disabled={saving || !form.nom}>{saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Ajouter'}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Supprimer le compte" onClose={() => setDeleteTarget(null)} size="sm">
          <div className="space-y-3">
            <p className="text-gray-600">Supprimer <strong>{deleteTarget.nom}</strong> ?</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              ⚠️ Toutes les transactions de ce compte seront également supprimées définitivement.
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Annuler</button>
              <button className="btn-danger" onClick={() => deleteAccount(deleteTarget.id)}>Supprimer</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
