import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export function CommercialClients() {
  const { currentUser } = useAuth();
  const { clients, quotes, sales } = useAppContext();
  const [filter, setFilter] = useState('');

  const myClients = clients.filter(c => c.commercialId === currentUser?.id);

  const filteredClients = myClients.filter(c => {
    return c.name.toLowerCase().includes(filter.toLowerCase()) || (c.company || '').toLowerCase().includes(filter.toLowerCase());
  });

  const getClientQuotes = (clientId: string) => quotes.filter(q => q.clientId === clientId);
  const getClientSales = (clientId: string) => sales.filter(s => s.clientId === clientId);

  return (
    <div className="dashboard">
      <h2>Mes Clients Apportés</h2>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>Clients que vous avez convertis depuis vos prospects (lecture seule)</p>

      <div className="card">
        <div style={{ marginBottom: '24px' }}>
          <input 
            type="text" 
            className="table-input" 
            placeholder="Rechercher par nom ou société..." 
            style={{ maxWidth: '300px' }} 
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>

        <div className="table-responsive">
<table className="data-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Société</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Téléphone</th>
              <th>Devis</th>
              <th>Ventes</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.company || '-'}</td>
                <td>{c.contact || '-'}</td>
                <td>{c.email || '-'}</td>
                <td>{c.phone || '-'}</td>
                <td>{getClientQuotes(c.id).length}</td>
                <td>{getClientSales(c.id).length}</td>
                <td><span className="badge-status bg-success">{c.status || 'Actif'}</span></td>
              </tr>
            ))}
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>Aucun client apporté.</td>
              </tr>
            )}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}
