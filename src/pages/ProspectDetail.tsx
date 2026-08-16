import { useState } from 'react';
import { ArrowLeft, Plus, Phone, Mail, MapPin, Calendar, Trash2, CheckCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';

// 1. Typage strict (TypeScript)
export type ActivityType = 'Appel' | 'Email' | 'Visite' | 'Réunion' | 'Démonstration' | 'Compte rendu';
export type PriorityLevel = 'Basse' | 'Moyenne' | 'Haute' | 'Urgente';
export type ProspectStatus = 'Nouveau' | 'Premier contact' | 'Besoin identifié' | 'Rendez-vous' | 'Offre en préparation' | 'Négociation' | 'À convertir' | 'Converti' | 'Perdu';

// 4. Robustesse : Fonction utilitaire sécurisée pour la génération d'ID
const generateId = (): string => {
  return (window.crypto && window.crypto.randomUUID) 
    ? window.crypto.randomUUID() 
    : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export function ProspectDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuth();
  const { 
    prospects, services, categories, 
    updateProspect, convertProspect,
    prospectActivities, addProspectActivity, deleteProspectActivity,
    // 2. Ajout de deleteProspectFollowUp importé du contexte
    prospectFollowUps, addProspectFollowUp, updateProspectFollowUp, deleteProspectFollowUp
  } = useAppContext();
  const { confirm } = useConfirm();

  const prospect = prospects.find(p => p.id === id);
  const [showActivityForm, setShowActivityForm] = useState(false);
  
  // Typage strict de l'état d'activité
  const [newActivity, setNewActivity] = useState<{ type: ActivityType, description: string }>({ type: 'Appel', description: '' });

  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  // Typage strict de l'état de relance
  const [newFollowUp, setNewFollowUp] = useState<{ date: string, time: string, priority: PriorityLevel, observation: string }>({ date: '', time: '', priority: 'Moyenne', observation: '' });
  
  // 3. Amélioration UX : État d'erreur local pour le formulaire de relance
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  if (!prospect) {
    return (
      <div className="dashboard">
        <p>Prospect introuvable.</p>
        <button className="btn btn-primary" onClick={() => navigate('/commercial/prospects')}>Retour</button>
      </div>
    );
  }

  const activities = prospectActivities
    .filter(a => a.prospectId === prospect.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const followUps = prospectFollowUps
    .filter(f => f.prospectId === prospect.id)
    .sort((a, b) => a.date.localeCompare(b.date));

  const serviceName = services.find(s => s.id === prospect.serviceId)?.name || '-';
  const categoryName = categories.find(c => c.id === prospect.categoryId)?.name || '-';

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    addProspectActivity({
      id: generateId(), // Utilisation du générateur robuste
      prospectId: prospect.id,
      type: newActivity.type,
      description: newActivity.description,
      date: new Date().toISOString(),
      createdBy: currentUser?.id
    });
    setShowActivityForm(false);
    setNewActivity({ type: 'Appel', description: '' });
  };

  const handleAddFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    // 3. Amélioration UX : Remplacement de l'alerte par un état d'erreur
    if (!newFollowUp.date) { 
      setFollowUpError("La date est obligatoire."); 
      return; 
    }
    setFollowUpError(null);

    addProspectFollowUp({
      id: generateId(), // Utilisation du générateur robuste
      prospectId: prospect.id,
      date: newFollowUp.date,
      time: newFollowUp.time,
      priority: newFollowUp.priority,
      observation: newFollowUp.observation,
      status: 'En attente'
    });
    setShowFollowUpForm(false);
    setNewFollowUp({ date: '', time: '', priority: 'Moyenne', observation: '' });
  };

  const handleConvert = () => {
    confirm({
      title: 'Convertir en client',
      message: `Voulez-vous convertir le prospect "${prospect.name}" en client ? Le client sera automatiquement créé et affecté au service.`,
      confirmLabel: 'Convertir',
      onConfirm: () => {
        convertProspect(prospect.id);
        navigate('/commercial/clients');
      }
    });
  };

  // Typage strict du tableau de statuts
  const statuses: ProspectStatus[] = ['Nouveau', 'Premier contact', 'Besoin identifié', 'Rendez-vous', 'Offre en préparation', 'Négociation', 'À convertir'];

  return (
    <div className="dashboard">
      <button className="btn btn-outline" onClick={() => navigate('/commercial/prospects')} style={{ marginBottom: '16px' }}>
        <ArrowLeft size={16} style={{ marginRight: '8px' }} /> Retour aux prospects
      </button>

      <div className="page-header">
        <div>
          <h2>{prospect.name}</h2>
          <p style={{ color: 'var(--color-text-muted)' }}>{prospect.prospectNumber} - {prospect.company || 'Pas de société'}</p>
        </div>
        {prospect.status !== 'Converti' && prospect.status !== 'Perdu' && (
          <button className="btn btn-primary" onClick={handleConvert}>
            <CheckCircle size={16} style={{ marginRight: '8px' }} /> Convertir en Client
          </button>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="card" style={{ padding: '24px' }}>
          <h3>Informations</h3>
          <div style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
            <div><strong>Type:</strong> {prospect.type}</div>
            <div><strong>Service:</strong> {serviceName}</div>
            <div><strong>Catégorie:</strong> {categoryName}</div>
            <div><strong>Intérêt:</strong> {prospect.interestLevel}</div>
            <div><strong>Budget:</strong> {prospect.budget?.toLocaleString('fr-FR') || '0'} FCFA</div>
            <div><strong>Source:</strong> {prospect.source || '-'}</div>
            <div><strong>Statut:</strong> <span className="badge-status bg-primary">{prospect.status}</span></div>
            {prospect.phone && <div><Phone size={14} style={{ marginRight: '4px' }} />{prospect.phone}</div>}
            {prospect.email && <div><Mail size={14} style={{ marginRight: '4px' }} />{prospect.email}</div>}
            {prospect.address && <div><MapPin size={14} style={{ marginRight: '4px' }} />{prospect.address}{prospect.city ? `, ${prospect.city}` : ''}</div>}
          </div>

          {prospect.need && (
            <div style={{ marginTop: '16px' }}>
              <h4>Besoin exprimé</h4>
              <p style={{ marginTop: '8px', color: 'var(--color-text-muted)' }}>{prospect.need}</p>
            </div>
          )}
          {prospect.comments && (
            <div style={{ marginTop: '16px' }}>
              <h4>Commentaires</h4>
              <p style={{ marginTop: '8px', color: 'var(--color-text-muted)' }}>{prospect.comments}</p>
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <h4>Avancement</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              {statuses.map(s => (
                <button
                  key={s}
                  className={`btn ${prospect.status === s ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                  onClick={() => updateProspect(prospect.id, { status: s })} // Plus besoin de "as any"
                  disabled={prospect.status === 'Converti' || prospect.status === 'Perdu'}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Activités</h3>
              <button className="btn btn-outline" onClick={() => setShowActivityForm(!showActivityForm)}>
                <Plus size={14} /> Ajouter
              </button>
            </div>
            {showActivityForm && (
              <form onSubmit={handleAddActivity} className="responsive-flex-actions" style={{ marginTop: '12px' }}>
                <select className="table-input" value={newActivity.type} onChange={e => setNewActivity({...newActivity, type: e.target.value as ActivityType})}>
                  <option value="Appel">Appel</option>
                  <option value="Email">Email</option>
                  <option value="Visite">Visite</option>
                  <option value="Réunion">Réunion</option>
                  <option value="Démonstration">Démonstration</option>
                  <option value="Compte rendu">Compte rendu</option>
                </select>
                <input className="table-input" placeholder="Description" value={newActivity.description} onChange={e => setNewActivity({...newActivity, description: e.target.value})} style={{ flex: 1, minWidth: '150px' }} />
                <button type="submit" className="btn btn-primary">OK</button>
              </form>
            )}
            <div style={{ marginTop: '12px', maxHeight: '200px', overflow: 'auto' }}>
              {activities.length > 0 ? activities.map(a => (
                <div key={a.id} style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <span className="badge-status bg-primary" style={{ marginRight: '8px' }}>{a.type}</span>
                    <span style={{ fontSize: '0.85rem' }}>{a.description || '-'}</span>
                  </div>
                  <button className="icon-button text-error" onClick={() => deleteProspectActivity(a.id)}><Trash2 size={14} /></button>
                </div>
              )) : <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Aucune activité.</p>}
            </div>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Relances</h3>
              <button className="btn btn-outline" onClick={() => setShowFollowUpForm(!showFollowUpForm)}>
                <Plus size={14} /> Planifier
              </button>
            </div>
            {showFollowUpForm && (
              <form onSubmit={handleAddFollowUp} className="responsive-form-grid" style={{ marginTop: '12px', gap: '8px' }}>
                {followUpError && (
                  <div style={{ gridColumn: '1 / -1', color: 'var(--color-error)', fontSize: '0.9rem', marginBottom: '4px' }}>
                    {followUpError}
                  </div>
                )}
                <input className="table-input" type="date" required value={newFollowUp.date} onChange={e => { setNewFollowUp({...newFollowUp, date: e.target.value}); setFollowUpError(null); }} />
                <input className="table-input" type="time" value={newFollowUp.time} onChange={e => setNewFollowUp({...newFollowUp, time: e.target.value})} />
                <select className="table-input" value={newFollowUp.priority} onChange={e => setNewFollowUp({...newFollowUp, priority: e.target.value as PriorityLevel})}>
                  <option value="Basse">Basse</option>
                  <option value="Moyenne">Moyenne</option>
                  <option value="Haute">Haute</option>
                  <option value="Urgente">Urgente</option>
                </select>
                <input className="table-input" placeholder="Observation" value={newFollowUp.observation} onChange={e => setNewFollowUp({...newFollowUp, observation: e.target.value})} />
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary">Planifier</button>
                </div>
              </form>
            )}
            <div style={{ marginTop: '12px', maxHeight: '200px', overflow: 'auto' }}>
              {followUps.length > 0 ? followUps.map(f => (
                <div key={f.id} style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Calendar size={14} style={{ marginRight: '4px' }} />
                    <strong>{f.date}</strong> {f.time || ''}
                    <span className={`badge-status ${f.priority === 'Haute' || f.priority === 'Urgente' ? 'bg-error' : 'bg-warning'}`} style={{ marginLeft: '8px' }}>{f.priority}</span>
                    {f.observation && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{f.observation}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {f.status === 'En attente' && (
                      <button className="icon-button" style={{ color: 'var(--color-success)' }} onClick={() => updateProspectFollowUp(f.id, { status: 'Terminée' })} title="Marquer comme terminée">
                        <CheckCircle size={14} />
                      </button>
                    )}
                    {/* 2. Ajout du bouton de suppression de la relance */}
                    <button className="icon-button text-error" onClick={() => deleteProspectFollowUp(f.id)} title="Supprimer la relance">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )) : <p style={{ color: 'var(--color-text-muted)', textAlign: 'center' }}>Aucune relance.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
