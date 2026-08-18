import React, { useState, useMemo } from 'react';
import { FileText, Phone, Mail, MapPin, Search } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MonRapportProspection() {
  const { prospects, services, categories } = useAppContext();
  const { currentUser } = useAuth();
  
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));

  const dailyProspects = useMemo(() => {
    if (!currentUser) return [];
    return prospects.filter(p => {
      const createdDate = p.createdAt?.split('T')[0];
      return p.commercialId === currentUser.id && createdDate === selectedDate;
    });
  }, [prospects, currentUser, selectedDate]);

  return (
    <div className="dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Rapport de prospection</h2>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '0.85rem' }}>
            Consultation des prospects ajoutés automatiquement à cette date.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div className="responsive-flex-actions" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Date du rapport</label>
            <input 
              className="table-input" 
              type="date" 
              style={{ width: '100%' }} 
              value={selectedDate} 
              max={toDateStr(new Date())} 
              onChange={e => setSelectedDate(e.target.value)} 
            />
          </div>
          <div>
            <span className="badge-status bg-info" style={{ fontSize: '0.9rem', padding: '8px 12px', display: 'inline-block' }}>
              {dailyProspects.length} prospect{dailyProspects.length !== 1 ? 's' : ''} ajouté{dailyProspects.length !== 1 ? 's' : ''} le {new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR')}
            </span>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          {dailyProspects.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', backgroundColor: 'var(--color-background)', borderRadius: '8px', border: '1px dashed var(--color-border)' }}>
              <Search size={32} style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }} />
              <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Aucun prospect n'a été ajouté à cette date.</p>
            </div>
          ) : (
            <div className="mobile-card-grid">
              {dailyProspects.map(prospect => {
                const serviceName = services.find(s => s.id === prospect.serviceId)?.name || '-';
                const categoryName = categories.find(c => c.id === prospect.categoryId)?.name || '-';
                
                return (
                  <div key={prospect.id} className="mobile-card">
                    <div className="mobile-card-header">
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} color="var(--color-primary)" />
                          {prospect.prospectNumber} - {prospect.name}
                        </h4>
                        <span className="mobile-card-subtitle">{prospect.company || 'Sans société'}</span>
                      </div>
                      <span className="badge-status bg-primary">{prospect.status}</span>
                    </div>
                    
                    <div className="mobile-card-body" style={{ marginTop: '8px' }}>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Type</span>
                        <span className="mobile-card-value">{prospect.type}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Service</span>
                        <span className="mobile-card-value">{serviceName}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Catégorie</span>
                        <span className="mobile-card-value">{categoryName}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Intérêt</span>
                        <span className="mobile-card-value">{prospect.interestLevel}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Source</span>
                        <span className="mobile-card-value">{prospect.source || '-'}</span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Budget</span>
                        <span className="mobile-card-value">{prospect.budget ? `${prospect.budget.toLocaleString('fr-FR')} FCFA` : '-'}</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                        {prospect.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={14} color="var(--color-text-muted)" /> {prospect.phone}</div>}
                        {prospect.email && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={14} color="var(--color-text-muted)" /> {prospect.email}</div>}
                        {prospect.address && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={14} color="var(--color-text-muted)" /> {prospect.address}{prospect.city ? `, ${prospect.city}` : ''}</div>}
                      </div>
                    </div>

                    {(prospect.need || prospect.comments) && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
                        {prospect.need && (
                          <div>
                            <strong style={{ color: 'var(--color-text-muted)' }}>Besoin exprimé:</strong>
                            <p style={{ margin: '4px 0 0 0' }}>{prospect.need}</p>
                          </div>
                        )}
                        {prospect.comments && (
                          <div>
                            <strong style={{ color: 'var(--color-text-muted)' }}>Commentaires:</strong>
                            <p style={{ margin: '4px 0 0 0' }}>{prospect.comments}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
