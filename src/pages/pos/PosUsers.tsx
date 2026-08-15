import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function PosUsers() {
  const { users, addUser, updateUser, toggleUserStatus, deleteUser } = useAppContext();
  const posUsers = users.filter(u => u.role === 'Gerant' || u.role === 'Caissier');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', pin: '', role: 'Caissier' as 'Gerant' | 'Caissier' });

  const handleSave = async () => {
    if (editingUser) {
      await updateUser(editingUser.id, { name: form.name, role: form.role, serviceId: undefined });
    } else {
      await addUser({ id: uuidv4(), name: form.name, email: form.email, pin: form.pin, role: form.role, lastLogin: 'Jamais', active: true });
    }
    setShowForm(false);
    setEditingUser(null);
    setForm({ name: '', email: '', pin: '', role: 'Caissier' });
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>Utilisateurs POS</h1>
        <button onClick={() => { setShowForm(true); setEditingUser(null); setForm({ name: '', email: '', pin: '', role: 'Caissier' }); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 500 }}>
          <Plus size={16} /> Ajouter
        </button>
      </div>
      {showForm && (
        <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{editingUser ? 'Modifier' : 'Ajouter'} un utilisateur</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
            <div><div style={{ fontSize: '13px', marginBottom: '4px', fontWeight: 500 }}>Nom</div><input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><div style={{ fontSize: '13px', marginBottom: '4px', fontWeight: 500 }}>Email</div><input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={!!editingUser} /></div>
            {!editingUser && <div><div style={{ fontSize: '13px', marginBottom: '4px', fontWeight: 500 }}>PIN (6 chiffres)</div><input style={inputStyle} maxLength={6} value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} /></div>}
            <div><div style={{ fontSize: '13px', marginBottom: '4px', fontWeight: 500 }}>Rôle</div><select style={inputStyle} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as any })}><option value="Caissier">Caissier</option><option value="Gerant">Gérant</option></select></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={handleSave} style={{ padding: '8px 16px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Enregistrer</button>
            <button onClick={() => { setShowForm(false); setEditingUser(null); }} style={{ padding: '8px 16px', backgroundColor: 'var(--color-surface-alt)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>Annuler</button>
          </div>
        </div>
      )}
      <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div className="table-responsive">
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}><th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Nom</th><th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Email</th><th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Rôle</th><th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Statut</th><th style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-muted)' }}>Actions</th></tr></thead>
          <tbody>
            {posUsers.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--color-surface-alt)' }}>
                <td style={{ padding: '12px 16px', fontSize: '14px' }}>{u.name}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--color-text-muted)' }}>{u.email}</td>
                <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 10px', borderRadius: 'var(--radius-lg)', fontSize: '12px', fontWeight: 500, background: u.role === 'Gerant' ? 'var(--color-primary-tint)' : 'var(--color-success-tint)', color: u.role === 'Gerant' ? 'var(--color-primary)' : 'var(--color-success)' }}>{u.role}</span></td>
                <td style={{ padding: '12px 16px' }}><span style={{ padding: '4px 10px', borderRadius: 'var(--radius-lg)', fontSize: '12px', fontWeight: 500, background: u.active ? 'var(--color-success-tint)' : 'var(--color-error-tint)', color: u.active ? 'var(--color-success)' : 'var(--color-error)' }}>{u.active ? 'Actif' : 'Inactif'}</span></td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setEditingUser(u); setForm({ name: u.name, email: u.email, pin: '', role: u.role as any }); setShowForm(true); }} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><Edit2 size={16} /></button>
                    <button onClick={() => toggleUserStatus(u.id)} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: u.active ? 'var(--color-warning)' : 'var(--color-success)' }}>{u.active ? 'Désactiver' : 'Activer'}</button>
                    <button onClick={() => deleteUser(u.id)} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {posUsers.length === 0 && <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>Aucun utilisateur POS</td></tr>}
          </tbody>
        </table>
</div>
      </div>
    </div>
  );
}
