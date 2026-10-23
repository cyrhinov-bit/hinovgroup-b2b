import { useState, useEffect } from 'react';
import { Store, ChevronDown, Check } from 'lucide-react';
import { PosMagasinService } from '../../features/pos/services/PosMagasinService';
import type { PosMagasin } from '../../types/posMagasins';
import { useAuth } from '../../context/AuthContext';

export default function MagasinSwitcher() {
  const { currentUser } = useAuth();
  const [magasins, setMagasins] = useState<PosMagasin[]>([]);
  const [activeMagasinId, setActiveMagasinId] = useState<string>(() => PosMagasinService.getActiveMagasinId());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    PosMagasinService.loadMagasins().then(list => {
      setMagasins(list.filter(m => m.actif !== false));
      // Si le magasin actif stocké n'existe plus, prendre le 1er ou le défaut
      if (!list.some(m => m.id === activeMagasinId) && list.length > 0) {
        const defaultMag = list.find(m => m.isDefault) || list[0];
        setActiveMagasinId(defaultMag.id);
        PosMagasinService.setActiveMagasinId(defaultMag.id);
      }
    });

    const handler = (e: any) => {
      if (e?.detail?.magasinId) {
        setActiveMagasinId(e.detail.magasinId);
      }
    };
    window.addEventListener('pos-magasin-changed', handler);
    return () => window.removeEventListener('pos-magasin-changed', handler);
  }, [activeMagasinId]);

  const activeMagasin = magasins.find(m => m.id === activeMagasinId) || magasins[0];
  const canSwitch = currentUser && ['SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant'].includes(currentUser.role);

  const handleSelect = (magasinId: string) => {
    setActiveMagasinId(magasinId);
    PosMagasinService.setActiveMagasinId(magasinId);
    setIsOpen(false);
  };

  if (!activeMagasin) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => canSwitch && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md, 8px)',
          background: 'rgba(13, 148, 136, 0.1)',
          color: 'var(--color-primary, #0D9488)',
          border: '1px solid rgba(13, 148, 136, 0.25)',
          cursor: canSwitch ? 'pointer' : 'default',
          fontWeight: 600,
          fontSize: '13px',
          transition: 'all 0.2s ease',
        }}
        title={canSwitch ? 'Cliquer pour changer de librairie' : 'Librairie affectée'}
      >
        <Store size={16} />
        <span>{activeMagasin.nom}</span>
        {canSwitch && <ChevronDown size={14} style={{ opacity: 0.7 }} />}
      </button>

      {isOpen && canSwitch && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              minWidth: '220px',
              background: '#ffffff',
              borderRadius: 'var(--radius-lg, 12px)',
              border: '1px solid var(--color-border, #e2e8f0)',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              padding: '6px',
              zIndex: 9999,
            }}
          >
            <div style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Changer de Boutique
            </div>
            {magasins.map(m => {
              const isSelected = m.id === activeMagasinId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelect(m.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md, 6px)',
                    border: 'none',
                    background: isSelected ? 'var(--color-surface-alt, #f1f5f9)' : 'transparent',
                    color: isSelected ? 'var(--color-primary, #0D9488)' : '#1e293b',
                    fontSize: '13px',
                    fontWeight: isSelected ? 600 : 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{m.nom}</span>
                    {m.ville && <span style={{ fontSize: '11px', color: '#64748b' }}>{m.ville}</span>}
                  </div>
                  {isSelected && <Check size={16} color="var(--color-primary, #0D9488)" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
