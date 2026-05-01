import { useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../contexts/AppContext'
import Modal from '../../components/Modal'

export default function TiersSettings() {
  const { tiers, categories, loadTiers } = useApp()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nom: '', categorie_id: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const parents = [...new Set(categories.map(c => c.parent))].sort()
  const filtered = tiers.filter(t => t.nom.toLowerCase().includes(search.toLowerCase()))

  function openAdd() { setEditing(null); setForm({ nom: '', categorie_id: '' }); setShowModal(true) }
  function openEdit(t) { setEditing(t); setForm({ nom: t.nom, categorie_id: t.categorie_id || '' }); setShowModal(true) }

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    const payload = { nom: form.nom.trim(), categorie_id: form.categorie_id || null }
    if (editing) {
      await supabase.from('suivi_comptes_tiers').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('suivi_comptes_tiers').insert(payload)
    }
    await loadTiers()
    setShowModal(false)
    setSaving(false)
  }

  async function deleteTiers(id) {
    await supabase.from('suivi_comptes_tiers').delete().eq('id', id)
    await loadTiers()
    setDeleteTarget(null)
  }

  function catLabel(catId) {
    const c = categories.find(x => x.id === catId)
    if (!c) return '—'
    return c.sous_categorie ? `${c.parent} — ${c.sous_categorie}` : c.parent
  }

  const selectedParent = categories.find(c => c.id === form.categorie_id)?.parent || ''
  const subCats = categories.filter(c => c.parent === selectedParent)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tiers</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez vos payeurs et bénéficiaires</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} /> Nouveau tiers</button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" className="input pl-9" placeholder="Rechercher un tiers…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400 mb-3">{search ? 'Aucun résultat.' : 'Aucun tiers défini.'}</p>
          {!search && <button onClick={openAdd} className="btn-primary">Créer le premier tiers</button>}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-100">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nom</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Catégorie par défaut</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{t.nom}</td>
                  <td className="px-4 py-3 text-gray-500">{catLabel(t.categorie_id)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(t)} className="text-gray-300 hover:text-blue-500"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTarget(t)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? 'Modifier le tiers' : 'Nouveau tiers'} onClose={() => setShowModal(false)} size="sm">
          <div className="space-y-3">
            <div>
              <label className="label">Nom *</label>
              <input type="text" className="input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} autoFocus placeholder="ex: Colruyt" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={selectedParent}
                  onChange={e => { const cats = categories.filter(c => c.parent === e.target.value); setForm(f => ({ ...f, categorie_id: cats[0]?.id || '' })) }}>
                  <option value="">— Aucune —</option>
                  {parents.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Sous-catégorie</label>
                <select className="input" value={form.categorie_id} onChange={e => setForm(f => ({ ...f, categorie_id: e.target.value }))} disabled={!selectedParent}>
                  {subCats.map(c => <option key={c.id} value={c.id}>{c.sous_categorie || '(aucune)'}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn-primary" onClick={save} disabled={saving || !form.nom}>{saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Ajouter'}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Supprimer le tiers" onClose={() => setDeleteTarget(null)} size="sm">
          <p className="text-gray-600 mb-4">Supprimer <strong>{deleteTarget.nom}</strong> ? Les transactions liées ne seront pas supprimées.</p>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Annuler</button>
            <button className="btn-danger" onClick={() => deleteTiers(deleteTarget.id)}>Supprimer</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
