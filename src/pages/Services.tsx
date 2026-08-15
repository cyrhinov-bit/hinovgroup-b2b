import React, { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useConfirm } from '../components/ConfirmModal';
import type { Service } from '../context/AppContext';

export function Services() {
  const { services, users, addService, updateService, deleteService } = useAppContext();
  const { confirm } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [newService, setNewService] = useState<Partial<Service>>({});
  const [editForm, setEditForm] = useState<{ name: string; members: number; description: string }>({ name: '', members: 1, description: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newService.name) {
      addService({
        id: Date.now().toString(),
        name: newService.name,
        members: newService.members || 1,
        description: newService.description || ''
      });
      setShowForm(false);
      setNewService({});
    }
  };

  const startEdit = (service: Service) => {
    setEditingService(service);
    setEditForm({
      name: service.name,
      members: service.members || 1,
      description: service.description || ''
    });
    setShowForm(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    updateService(editingService.id, editForm);
    setEditingService(null);
  };

  const handleDelete = (service: Service) => {
    confirm({
      title: 'Supprimer le service',
      message: `Êtes-vous sûr de vouloir supprimer le service "${service.name}" ? Cette action est définitive.`,
      confirmLabel: 'Supprimer',
      onConfirm: () => deleteService(service.id)
    });
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Départements / Services</h2>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingService(null); }}>
          <Plus size={16} style={{ marginRight: '8px' }} /> Ajouter un service
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
          <h3>Nouveau service</h3>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <input
              className="table-input"
              placeholder="Nom du service *"
              value={newService.name || ''}
              required
              onChange={e => setNewService({ ...newService, name: e.target.value })}
            />
            <input
              className="table-input"
              type="number"
              placeholder="Nombre de membres (ex: 3)"
              min="1"
              value={newService.members || ''}
              onChange={e => setNewService({ ...newService, members: Number(e.target.value) })}
            />
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      {editingService && (
        <div className="card" style={{ marginBottom: '24px', padding: '24px', borderLeft: '4px solid var(--color-primary)' }}>
          <h3>Modifier le service : {editingService.name}</h3>
          <form onSubmit={handleSaveEdit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Nom du service *</label>
              <input
                className="table-input"
                value={editForm.name}
                required
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Nombre de membres *</label>
              <input
                className="table-input"
                type="number"
                min="1"
                value={editForm.members}
                required
                onChange={e => setEditForm({ ...editForm, members: Number(e.target.value) })}
              />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingService(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Sauvegarder les modifications</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Responsable</th>
              <th>Membres d'équipe</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map(s => {
              const managerName = users.find(u => u.serviceId === s.id && u.role === 'Responsable')?.name || 'Non assigné';
              return (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{managerName}</td>
                  <td>{s.members || 1}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="icon-button" style={{ color: 'var(--color-primary)' }} title="Modifier le service" onClick={() => startEdit(s)}>
                        <Edit2 size={16} />
                      </button>
                      <button className="icon-button text-error" title="Supprimer le service" onClick={() => handleDelete(s)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {services.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px' }}>Aucun service trouvé.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
