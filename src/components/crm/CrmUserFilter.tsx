import type { User } from '../../context/AppContext';

export const CRM_UNASSIGNED_USER = '__unassigned__';

interface CrmUserFilterProps {
  users: User[];
  value: string;
  onChange: (userId: string) => void;
  label: string;
}

export function CrmUserFilter({ users, value, onChange, label }: CrmUserFilterProps) {
  const crmUsers = users.filter((user) => !['Caissier', 'Gerant', 'Encaisseur'].includes(user.role));

  return (
    <select
      className="table-input"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="ALL">Tous les utilisateurs</option>
      <option value={CRM_UNASSIGNED_USER}>Données historiques sans auteur</option>
      {crmUsers.map((user) => (
        <option key={user.id} value={user.id}>{user.name} — {user.role}</option>
      ))}
    </select>
  );
}
