import React, { useState, useEffect } from 'react';
import { Store, ChevronDown } from 'lucide-react';
import { PosMagasinService, DEFAULT_MAGASIN } from '../../features/pos/services/PosMagasinService';
import type { PosMagasin } from '../../types/posMagasins';

export const POS_SCOPE_STORAGE_KEY = 'hinov_pos_scope_magasin_id';

export interface PosStoreSelectorProps {
  value?: string;
  onChange?: (magasinId: string) => void;
  allowAll?: boolean;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}

export function PosStoreSelector({
  value,
  onChange,
  allowAll = true,
  className = '',
  style = {},
  label = 'Boutique :'
}: PosStoreSelectorProps) {
  const [magasins, setMagasins] = useState<PosMagasin[]>([DEFAULT_MAGASIN]);
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (value !== undefined) return value;
    try {
      const saved = localStorage.getItem(POS_SCOPE_STORAGE_KEY);
      return saved || (allowAll ? 'ALL' : DEFAULT_MAGASIN.id);
    } catch {
      return allowAll ? 'ALL' : DEFAULT_MAGASIN.id;
    }
  });

  const activeValue = value !== undefined ? value : internalValue;

  useEffect(() => {
    let mounted = true;
    PosMagasinService.loadMagasins()
      .then(list => {
        if (mounted && list.length > 0) {
          setMagasins(list);
        }
      })
      .catch(err => {
        console.warn('[PosStoreSelector] Erreur chargement magasins :', err);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Écoute des changements de périmètre inter-onglets/composants
  useEffect(() => {
    const handleScopeChange = (e: any) => {
      const newMagId = e?.detail?.magasinId;
      if (newMagId && newMagId !== activeValue) {
        setInternalValue(newMagId);
        onChange?.(newMagId);
      }
    };

    window.addEventListener('pos-magasin-scope-changed', handleScopeChange);
    return () => {
      window.removeEventListener('pos-magasin-scope-changed', handleScopeChange);
    };
  }, [activeValue, onChange]);

  const handleChange = (newId: string) => {
    try {
      localStorage.setItem(POS_SCOPE_STORAGE_KEY, newId);
      window.dispatchEvent(
        new CustomEvent('pos-magasin-scope-changed', {
          detail: { magasinId: newId }
        })
      );
    } catch (err) {
      console.warn('[PosStoreSelector] Erreur persistance scope :', err);
    }

    setInternalValue(newId);
    onChange?.(newId);
  };

  const selectedMagasin = magasins.find(m => m.id === activeValue);

  return (
    <div
      className={`pos-store-selector-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        background: '#FFFFFF',
        padding: '5px 12px',
        borderRadius: '10px',
        border: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.2s ease',
        ...style
      }}
    >
      <div
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '7px',
          background: activeValue === 'ALL' ? '#EEF2FF' : '#F0FDF4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <Store
          size={15}
          color={activeValue === 'ALL' ? '#4F46E5' : '#16A34A'}
        />
      </div>

      {label && (
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.03em'
          }}
        >
          {label}
        </span>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <select
          aria-label="Sélectionner la boutique"
          value={activeValue}
          onChange={e => handleChange(e.target.value)}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '13px',
            fontWeight: 700,
            color: activeValue === 'ALL' ? '#4F46E5' : '#0F172A',
            cursor: 'pointer',
            paddingRight: '22px',
            paddingLeft: '2px',
            lineHeight: 1.4,
            minWidth: '170px'
          }}
        >
          {allowAll && (
            <option value="ALL">
              🌐 Tout le Réseau ({magasins.length} boutique{magasins.length > 1 ? 's' : ''})
            </option>
          )}
          {magasins.map(mag => (
            <option key={mag.id} value={mag.id}>
              🏪 {mag.nom} {mag.ville ? `(${mag.ville})` : ''} {mag.isDefault ? '⭐' : ''}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          color="#94A3B8"
          style={{
            position: 'absolute',
            right: 0,
            pointerEvents: 'none'
          }}
        />
      </div>

      {activeValue !== 'ALL' && selectedMagasin?.ville && (
        <span
          style={{
            fontSize: '11px',
            fontWeight: 500,
            padding: '2px 6px',
            borderRadius: '4px',
            background: '#F1F5F9',
            color: '#475569'
          }}
        >
          {selectedMagasin.ville}
        </span>
      )}
    </div>
  );
}
export default PosStoreSelector;
