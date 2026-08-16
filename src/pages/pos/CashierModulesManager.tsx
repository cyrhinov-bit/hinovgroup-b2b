import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Shield, ToggleRight, ToggleLeft, Package, Truck, ClipboardList, Warehouse, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function CashierModulesManager() {
  const { users, updateUser } = useAppContext();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState('');

  const cashiers = users.filter(u => u.role === 'Caissier' && u.active);
  const filteredCashiers = cashiers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const togglePermission = async (
    id: string, 
    field: 'posReturnsEnabled' | 'posCatalogueEnabled' | 'posSupplyEnabled' | 'posInventoryEnabled' | 'posStockEnabled', 
    currentValue: boolean
  ) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    await updateUser(id, {
      name: user.name,
      role: user.role,
      serviceId: user.serviceId,
      posReturnsEnabled: field === 'posReturnsEnabled' ? !currentValue : !!user.posReturnsEnabled,
      posCatalogueEnabled: field === 'posCatalogueEnabled' ? !currentValue : !!user.posCatalogueEnabled,
      posSupplyEnabled: field === 'posSupplyEnabled' ? !currentValue : !!user.posSupplyEnabled,
      posInventoryEnabled: field === 'posInventoryEnabled' ? !currentValue : !!user.posInventoryEnabled,
      posStockEnabled: field === 'posStockEnabled' ? !currentValue : !!user.posStockEnabled,
    });
  };

  if (currentUser?.role !== 'Directeur' && currentUser?.role !== 'Gerant') {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-error)' }}>
        Accès refusé. Seul un Gérant ou un Directeur peut gérer les modules des caissiers.
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={24} color="var(--color-primary)" />
          Modules Caissier
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontSize: '14px' }}>
          Gérez l'accès des caissiers aux différents modules du point de vente.
        </p>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Rechercher un caissier..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: '400px', padding: '10px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '14px' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
        {filteredCashiers.map(cashier => (
          <div key={cashier.id} style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--color-surface-alt)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--color-primary-tint)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '18px' }}>
                {cashier.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{cashier.name}</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{cashier.email}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <ModuleToggle 
                label="Catalogue" 
                icon={<Package size={16} />} 
                isActive={!!cashier.posCatalogueEnabled} 
                onToggle={() => togglePermission(cashier.id, 'posCatalogueEnabled', !!cashier.posCatalogueEnabled)} 
              />
              <ModuleToggle 
                label="Approvisionnement" 
                icon={<Truck size={16} />} 
                isActive={!!cashier.posSupplyEnabled} 
                onToggle={() => togglePermission(cashier.id, 'posSupplyEnabled', !!cashier.posSupplyEnabled)} 
              />
              <ModuleToggle 
                label="Inventaire" 
                icon={<ClipboardList size={16} />} 
                isActive={!!cashier.posInventoryEnabled} 
                onToggle={() => togglePermission(cashier.id, 'posInventoryEnabled', !!cashier.posInventoryEnabled)} 
              />
              <ModuleToggle 
                label="Stock & Mouvements" 
                icon={<Warehouse size={16} />} 
                isActive={!!cashier.posStockEnabled} 
                onToggle={() => togglePermission(cashier.id, 'posStockEnabled', !!cashier.posStockEnabled)} 
              />
              <ModuleToggle 
                label="Retours" 
                icon={<RotateCcw size={16} />} 
                isActive={!!cashier.posReturnsEnabled} 
                onToggle={() => togglePermission(cashier.id, 'posReturnsEnabled', !!cashier.posReturnsEnabled)} 
              />
            </div>
          </div>
        ))}

        {filteredCashiers.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
            Aucun caissier actif trouvé.
          </div>
        )}
      </div>
    </div>
  );
}

function ModuleToggle({ label, icon, isActive, onToggle }: { label: string, icon: React.ReactNode, isActive: boolean, onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 500, color: 'var(--color-text)' }}>
        <span style={{ color: 'var(--color-text-muted)', display: 'flex' }}>{icon}</span>
        {label}
      </div>
      <button 
        onClick={onToggle}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isActive ? 'var(--color-success)' : 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
        title={isActive ? 'Désactiver le module' : 'Activer le module'}
      >
        {isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
      </button>
    </div>
  );
}
