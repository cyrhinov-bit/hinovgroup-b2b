import { useState } from 'react';
import { Plus, Eye, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import type { Prospect } from '../context/AppContext';

export function Prospects() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { prospects, services, categories, addProspect, deleteProspect } = useAppContext();
  const { confirm } = useConfirm();
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newProspect, setNewProspect] = useState<Partial<Prospect>>({
    type: 'Entreprise',
    interestLevel: 'Moyen',
    status: 'Nouveau',
    budget: 0
  });

  const myProspects = prospects.filter(p => p.commercialId === currentUser?.id);

  const filteredProspects = myProspects.filter(p => {
    const matchName = p.name.toLowerCase().includes(filter.toLowerCase()) || (p.company || '').toLowerCase().includes(filter.toLowerCase());
    const matchStatus = statusFilter ? p.status === statusFilter : true;
    return matchName && matchStatus;
  });

  const getServiceName = (id: string) => services.find(s => s.id === id)?.name || 'Inconnu';

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProspect.name || !newProspect.serviceId) {
      alert("Le nom et le service sont obligatoires");
      return;
    }

    const now = new Date();
    const seq = (now.getTime() % 10000).toString().padStart(4, '0');

    addProspect({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      prospectNumber: `PRO-${now.getFullYear()}-${seq}`,
      commercialId: currentUser?.id || '',
      serviceId: newProspect.serviceId,
      categoryId: newProspect.categoryId,
      type: newProspect.type as 'Entreprise' | 'Particulier',
      name: newProspect.name,
      company: newProspect.company,
      phone: newProspect.phone,
      email: newProspect.email,
      address: newProspect.address,
      city: newProspect.city,
      source: newProspect.source,
      interestLevel: newProspect.interestLevel as Prospect['interestLevel'],
      budget: newProspect.budget || 0,
      need: newProspect.need,
      comments: newProspect.comments,
      status: 'Nouveau',
      responsibleId: undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });

    setShowForm(false);
    setNewProspect({ type: 'Entreprise', interestLevel: 'Moyen', status: 'Nouveau', budget: 0 });
  };

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'Converti': return 'bg-success';
      case 'Perdu': return 'bg-error';
      case 'À convertir': return 'bg-warning';
      case 'Nouveau': return 'bg-info';
      default: return 'bg-primary';
    }
  };

  const serviceCategories = newProspect.serviceId
    ? categories.filter(c => c.serviceId === newProspect.serviceId)
    : [];

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Mes Prospects</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} style={{ marginRight: '8px' }} /> Nouveau Prospect
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
          <h3>Créer un prospect</h3>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <select className="table-input" value={newProspect.type} onChange={e => setNewProspect({...newProspect, type: e.target.value as any})}>
              <option value="Entreprise">Entreprise</option>
              <option value="Particulier">Particulier</option>
            </select>
            <input className="table-input" placeholder="Nom *" required onChange={e => setNewProspect({...newProspect, name: e.target.value})} />
            <input className="table-input" placeholder="Société" onChange={e => setNewProspect({...newProspect, company: e.target.value})} />
            <input className="table-input" placeholder="Téléphone" onChange={e => setNewProspect({...newProspect, phone: e.target.value})} />
            <input className="table-input" placeholder="Email" type="email" onChange={e => setNewProspect({...newProspect, email: e.target.value})} />
            <input className="table-input" placeholder="Adresse" onChange={e => setNewProspect({...newProspect, address: e.target.value})} />
            <input className="table-input" placeholder="Ville" onChange={e => setNewProspect({...newProspect, city: e.target.value})} />
            <select className="table-input" required value={newProspect.serviceId || ''} onChange={e => setNewProspect({...newProspect, serviceId: e.target.value, categoryId: undefined})}>
              <option value="">Service concerné *</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="table-input" value={newProspect.categoryId || ''} onChange={e => setNewProspect({...newProspect, categoryId: e.target.value})}>
              <option value="">Catégorie (optionnel)</option>
              {serviceCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="table-input" value={newProspect.interestLevel} onChange={e => setNewProspect({...newProspect, interestLevel: e.target.value as any})}>
              <option value="Faible">Intérêt faible</option>
              <option value="Moyen">Intérêt moyen</option>
              <option value="Élevé">Intérêt élevé</option>
              <option value="Très élevé">Intérêt très élevé</option>
            </select>
            <input className="table-input" placeholder="Source du prospect" onChange={e => setNewProspect({...newProspect, source: e.target.value})} />
            <input className="table-input" type="number" placeholder="Budget estimatif (FCFA)" value={newProspect.budget || ''} onChange={e => setNewProspect({...newProspect, budget: Number(e.target.value)})} />
            <div style={{ gridColumn: 'span 3' }}>
              <textarea className="table-input" placeholder="Besoin exprimé" rows={2} onChange={e => setNewProspect({...newProspect, need: e.target.value})} />
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <textarea className="table-input" placeholder="Commentaires" rows={2} onChange={e => setNewProspect({...newProspect, comments: e.target.value})} />
            </div>
            <div style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary">Enregistrer</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <input 
            type="text" 
            className="table-input" 
            placeholder="Rechercher par nom ou société..." 
            style={{ maxWidth: '300px' }} 
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <select 
            className="table-input" 
            style={{ maxWidth: '200px' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="Nouveau">Nouveau</option>
            <option value="Premier contact">Premier contact</option>
            <option value="Besoin identifié">Besoin identifié</option>
            <option value="Rendez-vous">Rendez-vous</option>
            <option value="Offre en préparation">Offre en préparation</option>
            <option value="Négociation">Négociation</option>
            <option value="À convertir">À convertir</option>
            <option value="Converti">Converti</option>
            <option value="Perdu">Perdu</option>
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>N° Prospect</th>
              <th>Nom</th>
              <th>Société</th>
              <th>Service</th>
              <th>Intérêt</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProspects.map(p => (
              <tr key={p.id}>
                <td>{p.prospectNumber}</td>
                <td>{p.name}</td>
                <td>{p.company || '-'}</td>
                <td>{p.serviceId ? getServiceName(p.serviceId) : '-'}</td>
                <td>{p.interestLevel}</td>
                <td><span className={`badge-status ${getBadgeColor(p.status)}`}>{p.status}</span></td>
                <td>
                  <button className="icon-button" style={{ color: 'var(--color-primary)' }} onClick={() => navigate(`/commercial/prospects/${p.id}`)} title="Voir">
                    <Eye size={18} />
                  </button>
                  <button className="icon-button text-error" onClick={() => confirm({
                    title: 'Supprimer le prospect',
                    message: `Voulez-vous vraiment supprimer le prospect "${p.name}" ?`,
                    confirmLabel: 'Supprimer',
                    onConfirm: () => deleteProspect(p.id)
                  })} title="Supprimer">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredProspects.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>Aucun prospect trouvé.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
