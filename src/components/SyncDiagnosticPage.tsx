import React, { useState, useEffect } from 'react';
import { platform } from '../platform';

export default function SyncDiagnosticPage() {
  const [status, setStatus] = useState<any>({ isOnline: true, pendingCount: 0 });
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    loadStatus();
    platform.sync.onEvent((payload) => {
      setEvents(prev => [...prev, payload]);
      if (payload.event === 'queueUpdated' || payload.event === 'networkStatusChanged') {
        loadStatus();
      }
    });
  }, []);

  const loadStatus = async () => {
    try {
      const s = await platform.sync.getStatus();
      setStatus(s);
    } catch(e) { console.error(e); }
  };

  const handleAddFakeOp = async () => {
    try {
      await platform.sync.enqueue({ type: 'INSERT_SALE', data: { total: 100 } });
      await loadStatus();
    } catch(e) { alert(String(e)); }
  };

  const handleForceSync = async () => {
    try {
      await platform.sync.forceSync();
    } catch(e) { alert(String(e)); }
  };

  const handleToggleNetwork = async () => {
    try {
      await platform.sync.setNetworkStatus(!status.isOnline);
      await loadStatus();
    } catch(e) { alert(String(e)); }
  };

  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <h1>Moteur de Synchronisation (Phase 18)</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        
        {/* Colonne 1 : Contrôles */}
        <div style={{ background: '#f5f5f5', padding: '15px', borderRadius: '4px' }}>
          <h3>État du Réseau & File d'attente</h3>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>Statut Réseau : </strong> 
            <span style={{ color: status.isOnline ? 'green' : 'red', fontWeight: 'bold' }}>
              {status.isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <strong>Opérations en attente : </strong> {status.pendingCount}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
            <button onClick={handleToggleNetwork}>Basculer le mode Hors-ligne / En-ligne</button>
            <button onClick={handleAddFakeOp}>Ajouter une vente fictive à la file</button>
            <button onClick={handleForceSync} disabled={!status.isOnline || status.pendingCount === 0}>Forcer la Synchronisation</button>
          </div>
        </div>

        {/* Colonne 2 : Journal d'événements */}
        <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '4px', height: '400px', overflowY: 'auto' }}>
          <h3>Activité du SyncWorker (Live)</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {events.map((evt, idx) => (
              <li key={idx} style={{ padding: '5px', borderBottom: '1px solid #ccc', fontSize: '13px' }}>
                <strong style={{ color: '#1565c0' }}>{evt.event}</strong> : 
                <pre style={{ margin: 0, fontSize: '11px', background: '#fff', padding: '4px' }}>
                  {JSON.stringify(evt.data, null, 2)}
                </pre>
              </li>
            ))}
            {events.length === 0 && <li>En attente d'événements...</li>}
          </ul>
        </div>

      </div>
    </div>
  );
}
