import React, { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useConfirm } from '../components/ConfirmModal';
import type { Client } from '../context/AppContext';

export function Clients() {
  const { clients, addClient, updateClient, deleteClient, users } = useAppContext();
  const { confirm } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [newClient, setNewClient] = useState<Partial<Client>>({});
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  const commercials = users.filter(u => (u.role === 'Commercial' || u.role === 'Responsable') && u.active);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClient.name || newClient.contact) {
      addClient({
        id: Date.now().toString(),
        name: newClient.name || '',
        contact: newClient.contact || '',
        email: newClient.email || '',
        phone: newClient.phone || '',
        company: newClient.company || '',
        address: newClient.address || '',
        status: newClient.status || 'Actif',
        commercialId: newClient.commercialId || ''
      });
      setShowForm(false);
      setNewClient({});
    }
  };

  const startEdit = (client: Client) => {
    setEditingClient(client);
    setEditForm({
      name: client.name,
      contact: client.contact,
      email: client.email,
      phone: client.phone,
      company: client.company || '',
      address: client.address || '',
      status: client.status || 'Actif',
      commercialId: client.commercialId || ''
    });
    setShowForm(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    updateClient(editingClient.id, {
      ...editingClient,
      name: editForm.name || '',
      contact: editForm.contact || '',
      email: editForm.email || '',
      phone: editForm.phone || '',
      company: editForm.company || '',
      address: editForm.address || '',
      status: editForm.status || 'Actif',
      commercialId: editForm.commercialId || ''
    });
    setEditingClient(null);
  };

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Gestion des Clients</h2>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingClient(null); }}>
          <Plus size={16} style={{ marginRight: '8px' }} /> Nouveau Client
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
          <h3>Ajouter un client</h3>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <input className="table-input" placeholder="Entreprise" onChange={e => setNewClient({...newClient, name: e.target.value})} />
            <input className="table-input" placeholder="Responsable" required onChange={e => setNewClient({...newClient, contact: e.target.value})} />
            <input className="table-input" placeholder="Email" type="email" required onChange={e => setNewClient({...newClient, email: e.target.value})} />
            <input className="table-input" placeholder="Téléphone" required onChange={e => setNewClient({...newClient, phone: e.target.value})} />
            <select className="table-input" onChange={e => setNewClient({...newClient, commercialId: e.target.value})}>
              <option value="">Aucun commercial</option>
              {commercials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      {editingClient && (
        <div className="card" style={{ marginBottom: '24px', padding: '24px', borderLeft: '4px solid var(--color-primary)' }}>
          <h3>Modifier le client : {editingClient.name || editingClient.contact}</h3>
          <form onSubmit={handleSaveEdit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Nom de l'entreprise</label>
              <input
                className="table-input"
                placeholder="Ex: HINOV SARL"
                value={editForm.name || ''}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Responsable / Contact *</label>
              <input
                className="table-input"
                placeholder="Ex: Jean Dupont"
                value={editForm.contact || ''}
                required
                onChange={e => setEditForm({ ...editForm, contact: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Adresse e-mail *</label>
              <input
                className="table-input"
                type="email"
                placeholder="Ex: contact@client.com"
                value={editForm.email || ''}
                required
                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Téléphone *</label>
              <input
                className="table-input"
                placeholder="Ex: +225 0700000000"
                value={editForm.phone || ''}
                required
                onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Statut</label>
              <select
                className="table-input"
                value={editForm.status || 'Actif'}
                onChange={e => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="Actif">Actif</option>
                <option value="Inactif">Inactif</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>Commercial</label>
              <select
                className="table-input"
                value={editForm.commercialId || ''}
                onChange={e => setEditForm({ ...editForm, commercialId: e.target.value })}
              >
                <option value="">Aucun commercial</option>
                {commercials.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingClient(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Sauvegarder les modifications</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
<table className="data-table">
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Responsable</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Commercial</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => (
              <tr key={client.id}>
                <td><strong>{client.name || '-'}</strong></td>
                <td>{client.contact}</td>
                <td>{client.email}</td>
                <td>{client.phone}</td>
                <td>{users.find(u => u.id === client.commercialId)?.name || '-'}</td>
                <td><span className={`badge-status ${client.status === 'Actif' ? 'bg-success' : 'bg-error'}`}>{client.status || 'Actif'}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button className="icon-button" style={{ color: 'var(--color-primary)' }} title="Modifier le client" onClick={() => startEdit(client)}>
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="icon-button text-error"
                      title="Supprimer le client"
                      onClick={() => confirm({
                        title: 'Supprimer le client',
                        message: `Êtes-vous sûr de vouloir supprimer le client "${client.name || client.contact}" ?`,
                        confirmLabel: 'Supprimer',
                        onConfirm: () => deleteClient(client.id)
                      })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Aucun client trouvé.</td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}
