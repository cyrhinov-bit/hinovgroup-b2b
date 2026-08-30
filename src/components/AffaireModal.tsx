import React, { useState, useEffect } from 'react';
import { X, Briefcase, User, Building, Calendar, DollarSign, Target, FileText, CheckCircle2 } from 'lucide-react';
import { useAppContext, type Affaire, type AffaireStatus } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import './AffaireModal.css';

interface AffaireModalProps {
  isOpen: boolean;
  onClose: () => void;
  affaireToEdit?: Affaire | null;
  preselectedClientId?: string;
}

const AFFAIRE_STATUSES: { value: AffaireStatus; label: string; color: string }[] = [
  { value: 'PROSPECTION', label: 'Prospection', color: '#64748B' },
  { value: 'QUALIFIEE', label: 'Qualifiée', color: '#0284C7' },
  { value: 'PROPOSITION', label: 'Proposition', color: '#D97706' },
  { value: 'NEGOCIATION', label: 'Négociation', color: '#7C3AED' },
  { value: 'GAGNEE', label: 'Gagnée', color: '#16A34A' },
  { value: 'EN_COURS', label: 'En cours', color: '#2563EB' },
  { value: 'CLOTUREE', label: 'Clôturée', color: '#059669' },
  { value: 'PERDUE', label: 'Perdue', color: '#DC2626' },
  { value: 'ANNULEE', label: 'Annulée', color: '#9CA3AF' },
];

const SOURCES = [
  'Prospection directe',
  'Recommandation',
  'Appel entrant / Site Web',
  'Réseaux sociaux',
  'Salon / Événement',
  'Client existant (Fidélisation)',
  'Autre'
];

export function AffaireModal({ isOpen, onClose, affaireToEdit, preselectedClientId }: AffaireModalProps) {
  const { clients, services, users, addAffaire, updateAffaire } = useAppContext();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState(preselectedClientId || '');
  const [serviceId, setServiceId] = useState('');
  const [commercialId, setCommercialId] = useState('');
  const [status, setStatus] = useState<AffaireStatus>('QUALIFIEE');
  const [estimatedAmountHt, setEstimatedAmountHt] = useState<number>(0);
  const [probability, setProbability] = useState<number>(50);
  const [source, setSource] = useState('Prospection directe');
  const [startDatePlanned, setStartDatePlanned] = useState('');
  const [endDatePlanned, setEndDatePlanned] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filtrer les commerciaux éligibles
  const commercials = users.filter(u => 
    u.role === 'Commercial' || u.role === 'Responsable' || u.role === 'Directeur' || u.role === 'Directeur adjoint' || u.role === 'SuperAdmin'
  );

  useEffect(() => {
    if (affaireToEdit) {
      setTitle(affaireToEdit.title);
      setClientId(affaireToEdit.clientId);
      setServiceId(affaireToEdit.serviceId);
      setCommercialId(affaireToEdit.commercialId);
      setStatus(affaireToEdit.status);
      setEstimatedAmountHt(affaireToEdit.estimatedAmountHt);
      setProbability(affaireToEdit.probability);
      setSource(affaireToEdit.source || 'Prospection directe');
      setStartDatePlanned(affaireToEdit.startDatePlanned ? affaireToEdit.startDatePlanned.split('T')[0] : '');
      setEndDatePlanned(affaireToEdit.endDatePlanned ? affaireToEdit.endDatePlanned.split('T')[0] : '');
      setDescription(affaireToEdit.description || '');
      setNotes(affaireToEdit.notes || '');
    } else {
      setTitle('');
      setClientId(preselectedClientId || (clients[0]?.id || ''));
      setServiceId(services[0]?.id || '');
      setCommercialId(currentUser?.id || (commercials[0]?.id || ''));
      setStatus('QUALIFIEE');
      setEstimatedAmountHt(0);
      setProbability(50);
      setSource('Prospection directe');
      setStartDatePlanned(new Date().toISOString().split('T')[0]);
      setEndDatePlanned('');
      setDescription('');
      setNotes('');
    }
    setError('');
  }, [affaireToEdit, preselectedClientId, isOpen, clients, services, users, currentUser]);

  // Si un client est sélectionné, pré-sélectionner son commercial ou service si pertinent
  const handleClientChange = (selectedClientId: string) => {
    setClientId(selectedClientId);
    const client = clients.find(c => c.id === selectedClientId);
    if (client) {
      if (client.commercialId) setCommercialId(client.commercialId);
      if (client.serviceId) setServiceId(client.serviceId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Le titre de l\'affaire est obligatoire.');
      return;
    }
    if (!clientId) {
      setError('Vous devez obligatoirement sélectionner un Client existant.');
      return;
    }
    if (!serviceId) {
      setError('Le service responsable est obligatoire.');
      return;
    }
    if (!commercialId) {
      setError('Le commercial en charge est obligatoire.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (affaireToEdit) {
        await updateAffaire(affaireToEdit.id, {
          title: title.trim(),
          clientId,
          serviceId,
          commercialId,
          status,
          estimatedAmountHt: Number(estimatedAmountHt) || 0,
          probability: Number(probability) || 0,
          source,
          startDatePlanned: startDatePlanned || undefined,
          endDatePlanned: endDatePlanned || undefined,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await addAffaire({
          title: title.trim(),
          clientId,
          serviceId,
          commercialId,
          status,
          estimatedAmountHt: Number(estimatedAmountHt) || 0,
          probability: Number(probability) || 0,
          source,
          startDatePlanned: startDatePlanned || undefined,
          endDatePlanned: endDatePlanned || undefined,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue lors de l\'enregistrement.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="affaire-modal-overlay" onClick={onClose}>
      <div className="affaire-modal-container" onClick={e => e.stopPropagation()}>
        <div className="affaire-modal-header">
          <div className="affaire-modal-header-title">
            <Briefcase size={22} className="text-teal-600" />
            <h3>{affaireToEdit ? `Modifier l'Affaire : ${affaireToEdit.reference}` : 'Nouvelle Affaire Commerciale'}</h3>
          </div>
          <button className="affaire-modal-close" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="affaire-modal-form">
          {error && <div className="affaire-modal-error">{error}</div>}

          <div className="affaire-form-grid">
            {/* Ligne 1 : Titre du projet */}
            <div className="form-group full-width">
              <label htmlFor="affaire-title">
                Titre du projet / Affaire <span className="text-red-500">*</span>
              </label>
              <input
                id="affaire-title"
                type="text"
                className="form-input"
                placeholder="Ex: Refonte Système Informatique & Équipements"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Ligne 2 : Client (Strictement issu de la table clients) */}
            <div className="form-group">
              <label htmlFor="affaire-client">
                <Building size={16} className="inline mr-1" />
                Client Associé <span className="text-red-500">*</span>
              </label>
              <select
                id="affaire-client"
                className="form-select"
                value={clientId}
                onChange={e => handleClientChange(e.target.value)}
                required
              >
                <option value="" disabled>-- Sélectionner un Client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.company ? `(${c.company})` : ''}
                  </option>
                ))}
              </select>
              <span className="form-helper">Seuls les clients enregistrés peuvent faire l'objet d'une affaire.</span>
            </div>

            {/* Ligne 2 : Service */}
            <div className="form-group">
              <label htmlFor="affaire-service">
                <Briefcase size={16} className="inline mr-1" />
                Service Métier <span className="text-red-500">*</span>
              </label>
              <select
                id="affaire-service"
                className="form-select"
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                required
              >
                <option value="" disabled>-- Sélectionner un Service --</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Ligne 3 : Commercial */}
            <div className="form-group">
              <label htmlFor="affaire-commercial">
                <User size={16} className="inline mr-1" />
                Commercial Responsable <span className="text-red-500">*</span>
              </label>
              <select
                id="affaire-commercial"
                className="form-select"
                value={commercialId}
                onChange={e => setCommercialId(e.target.value)}
                required
              >
                <option value="" disabled>-- Sélectionner un Commercial --</option>
                {commercials.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Ligne 3 : Statut */}
            <div className="form-group">
              <label htmlFor="affaire-status">
                <Target size={16} className="inline mr-1" />
                Étape du Pipeline <span className="text-red-500">*</span>
              </label>
              <select
                id="affaire-status"
                className="form-select font-medium"
                value={status}
                onChange={e => setStatus(e.target.value as AffaireStatus)}
                required
              >
                {AFFAIRE_STATUSES.map(st => (
                  <option key={st.value} value={st.value}>{st.label}</option>
                ))}
              </select>
            </div>

            {/* Ligne 4 : Montant Estimé HT */}
            <div className="form-group">
              <label htmlFor="affaire-amount">
                <DollarSign size={16} className="inline mr-1" />
                Montant Estimé HT (FCFA)
              </label>
              <input
                id="affaire-amount"
                type="number"
                min="0"
                step="1000"
                className="form-input font-bold"
                placeholder="0"
                value={estimatedAmountHt || ''}
                onChange={e => setEstimatedAmountHt(Number(e.target.value))}
              />
            </div>

            {/* Ligne 4 : Probabilité */}
            <div className="form-group">
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="affaire-probability">Probabilité de succès</label>
                <span className="text-sm font-bold text-teal-700">{probability}%</span>
              </div>
              <input
                id="affaire-probability"
                type="range"
                min="0"
                max="100"
                step="5"
                className="w-full accent-teal-600 cursor-pointer"
                value={probability}
                onChange={e => setProbability(Number(e.target.value))}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Faible (0-30%)</span>
                <span>Moyen (50%)</span>
                <span>Forte (80-100%)</span>
              </div>
            </div>

            {/* Ligne 5 : Source */}
            <div className="form-group">
              <label htmlFor="affaire-source">Canal / Source</label>
              <select
                id="affaire-source"
                className="form-select"
                value={source}
                onChange={e => setSource(e.target.value)}
              >
                {SOURCES.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>

            {/* Ligne 5 : Dates Planning */}
            <div className="form-group">
              <label htmlFor="affaire-start-date">
                <Calendar size={16} className="inline mr-1" />
                Date début prévue
              </label>
              <input
                id="affaire-start-date"
                type="date"
                className="form-input"
                value={startDatePlanned}
                onChange={e => setStartDatePlanned(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="affaire-end-date">
                <Calendar size={16} className="inline mr-1" />
                Date clôture prévisionnelle
              </label>
              <input
                id="affaire-end-date"
                type="date"
                className="form-input"
                value={endDatePlanned}
                onChange={e => setEndDatePlanned(e.target.value)}
              />
            </div>

            {/* Ligne 6 : Description & Besoins */}
            <div className="form-group full-width">
              <label htmlFor="affaire-description">
                <FileText size={16} className="inline mr-1" />
                Cahier des charges & Besoins exprimés
              </label>
              <textarea
                id="affaire-description"
                rows={3}
                className="form-textarea"
                placeholder="Détails du périmètre, besoins techniques du client, attentes particulières..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* Ligne 7 : Notes internes */}
            <div className="form-group full-width">
              <label htmlFor="affaire-notes">Notes internes & Stratégie commerciale</label>
              <textarea
                id="affaire-notes"
                rows={2}
                className="form-textarea"
                placeholder="Éléments de négociation, points de vigilance, prochaines actions..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="affaire-modal-actions">
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn-modal-submit"
              disabled={loading}
            >
              {loading ? (
                <span>Enregistrement...</span>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>{affaireToEdit ? 'Mettre à jour' : 'Créer l\'Affaire'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

