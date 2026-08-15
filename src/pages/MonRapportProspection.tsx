import React, { useState, useMemo } from 'react';
import { Calendar, FileText, Phone, Mail, MapPin, Search } from 'lucide-react';
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '250px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Date du rapport</label>
            <input 
              className="form-control" 
              type="date" 
              style={{ width: '100%' }} 
              value={selectedDate} 
              max={toDateStr(new Date())} 
              onChange={e => setSelectedDate(e.target.value)} 
            />
          </div>
          <div style={{ paddingTop: '22px' }}>
            <span className="badge-status bg-info" style={{ fontSize: '0.9rem', padding: '8px 12px' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {dailyProspects.map(prospect => {
                const serviceName = services.find(s => s.id === prospect.serviceId)?.name || '-';
                const categoryName = categories.find(c => c.id === prospect.categoryId)?.name || '-';
                
                return (
                  <div key={prospect.id} style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} color="var(--color-primary)" />
                          {prospect.prospectNumber} - {prospect.name}
                        </h4>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{prospect.company || 'Sans société'}</span>
                      </div>
                      <span className="badge-status bg-primary">{prospect.status}</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                      <div><strong>Type:</strong> {prospect.type}</div>
                      <div><strong>Service:</strong> {serviceName}</div>
                      <div><strong>Catégorie:</strong> {categoryName}</div>
                      <div><strong>Intérêt:</strong> {prospect.interestLevel}</div>
                      <div><strong>Source:</strong> {prospect.source || '-'}</div>
                      <div><strong>Budget:</strong> {prospect.budget ? `${prospect.budget.toLocaleString('fr-FR')} FCFA` : '-'}</div>
                      
                      {prospect.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={14} color="var(--color-text-muted)" /> {prospect.phone}</div>}
                      {prospect.email && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={14} color="var(--color-text-muted)" /> {prospect.email}</div>}
                      {prospect.address && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} color="var(--color-text-muted)" /> {prospect.address}{prospect.city ? `, ${prospect.city}` : ''}</div>}
                    </div>

                    {(prospect.need || prospect.comments) && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--color-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem' }}>
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
