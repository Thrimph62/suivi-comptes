import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../contexts/AppContext'
import Modal from '../../components/Modal'

export default function CategoriesSettings() {
  const { categories, loadCategories } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ parent: '', sous_categorie: '' })
  const [newParent, setNewParent] = useState('')
  const [showNewParent, setShowNewParent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expanded, setExpanded] = useState({})

  const grouped = categories.reduce((acc, c) => {
    if (!acc[c.parent]) acc[c.parent] = []
    acc[c.parent].push(c)
    return acc
  }, {})
  const parents = Object.keys(grouped).sort()

  async function addCategory() {
    if (!form.parent.trim()) return
    setSaving(true)
    await supabase.from('suivi_comptes_categories').insert({ parent: form.parent.trim(), sous_categorie: form.sous_categorie.trim() || null })
    await loadCategories()
    setShowModal(false)
    setForm({ parent: '', sous_categorie: '' })
    setSaving(false)
  }

  async function addParent() {
    if (!newParent.trim()) return
    setSaving(true)
    await supabase.from('suivi_comptes_categories').insert({ parent: newParent.trim(), sous_categorie: null })
    await loadCategories()
    setNewParent('')
    setShowNewParent(false)
    setSaving(false)
  }

  async function deleteCategory(id) {
    await supabase.from('suivi_comptes_categories').delete().eq('id', id)
    await loadCategories()
    setDeleteTarget(null)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catégories</h1>
          <p className="text-sm text-gray-500 mt-1">Organisez vos transactions par catégorie et sous-catégorie</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowNewParent(true)} className="btn-secondary text-sm">+ Catégorie</button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={16} /> Sous-catégorie</button>
        </div>
      </div>

      {parents.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-400 mb-3">Aucune catégorie définie.</p>
          <button onClick={() => setShowNewParent(true)} className="btn-primary">Créer la première catégorie</button>
        </div>
      ) : (
        <div className="space-y-2">
          {parents.map(parent => {
            const subs = grouped[parent].filter(c => c.sous_categorie)
            const parentOnly = grouped[parent].find(c => !c.sous_categorie)
            const isOpen = expanded[parent]
            return (
              <div key={parent} className="card p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpanded(e => ({ ...e, [parent]: !e[parent] }))}>
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    <span className="font-semibold text-gray-900">{parent}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{subs.length} sous-cat.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); setForm({ parent, sous_categorie: '' }); setShowModal(true) }}
                      className="text-xs text-emerald-600 hover:underline">+ sous-catégorie</button>
                    {parentOnly && (
                      <button onClick={e => { e.stopPropagation(); setDeleteTarget(parentOnly) }} className="text-gray-300 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {isOpen && subs.length > 0 && (
                  <div className="border-t border-gray-100">
                    {subs.map(c => (
                      <div key={c.id} className="flex items-center justify-between px-6 py-2 hover:bg-gray-50">
                        <span className="text-sm text-gray-700">{c.sous_categorie}</span>
                        <button onClick={() => setDeleteTarget(c)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Nouvelle sous-catégorie" onClose={() => setShowModal(false)} size="sm">
          <div className="space-y-3">
            <div>
              <label className="label">Catégorie principale *</label>
              <select className="input" value={form.parent} onChange={e => setForm(f => ({ ...f, parent: e.target.value }))}>
                <option value="">— Choisir —</option>
                {parents.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Nom de la sous-catégorie *</label>
              <input type="text" className="input" value={form.sous_categorie}
                onChange={e => setForm(f => ({ ...f, sous_categorie: e.target.value }))} placeholder="ex: Supermarché" autoFocus />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
              <button className="btn-primary" onClick={addCategory} disabled={saving || !form.parent || !form.sous_categorie}>
                {saving ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showNewParent && (
        <Modal title="Nouvelle catégorie principale" onClose={() => setShowNewParent(false)} size="sm">
          <div className="space-y-3">
            <div>
              <label className="label">Nom de la catégorie *</label>
              <input type="text" className="input" value={newParent} onChange={e => setNewParent(e.target.value)} placeholder="ex: Alimentation" autoFocus />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-secondary" onClick={() => setShowNewParent(false)}>Annuler</button>
              <button className="btn-primary" onClick={addParent} disabled={saving || !newParent}>{saving ? 'Ajout…' : 'Ajouter'}</button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Supprimer" onClose={() => setDeleteTarget(null)} size="sm">
          <p className="text-gray-600 mb-4">Supprimer <strong>{deleteTarget.sous_categorie || deleteTarget.parent}</strong> ? Les transactions liées ne seront pas supprimées.</p>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>Annuler</button>
            <button className="btn-danger" onClick={() => deleteCategory(deleteTarget.id)}>Supprimer</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
