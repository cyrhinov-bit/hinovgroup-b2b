import React from 'react';
import { Sparkles, Wand2, Loader2, CheckCircle2 } from 'lucide-react';
import { STUDIO_SETTINGS, type StudioSettingType } from '../../services/ProductImageAiService';

interface StudioAiPanelProps {
  selectedSetting: StudioSettingType;
  onSelectSetting: (setting: StudioSettingType) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
  aiSource: string | null;
  onResetStandard: () => void;
}

export const StudioAiPanel: React.FC<StudioAiPanelProps> = ({
  selectedSetting,
  onSelectSetting,
  onRegenerate,
  isRegenerating,
  aiSource,
  onResetStandard
}) => {
  return (
    <div
      style={{
        marginBottom: '16px',
        backgroundColor: '#F0FDFA',
        border: '1px solid #99F6E4',
        borderRadius: '14px',
        padding: '12px 14px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={16} color="#0D9488" />
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F766E' }}>
            Studio IA & Décors Publicitaires
          </span>
        </div>
        <span style={{ fontSize: '10px', backgroundColor: '#CCFBF1', color: '#0F766E', padding: '2px 6px', borderRadius: '6px', fontWeight: 700 }}>
          HD & Ambiance
        </span>
      </div>

      <p style={{ fontSize: '11px', color: '#115E59', margin: '0 0 10px 0', lineHeight: '1.4' }}>
        <strong>Fidélité 100% garantie :</strong> le produit reste strictement identique à l'original (forme, logo, textes, couleurs) avec un éclairage studio professionnel et un décor adapté au catalogue.
      </p>

      {/* Grille des 5 décors studio */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px', marginBottom: '12px' }}>
        {(Object.keys(STUDIO_SETTINGS) as StudioSettingType[]).map((key) => {
          const cfg = STUDIO_SETTINGS[key];
          const isSelected = selectedSetting === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectSetting(key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '8px 10px',
                borderRadius: '10px',
                border: `1.5px solid ${isSelected ? '#0D9488' : '#CCFBF1'}`,
                backgroundColor: isSelected ? '#FFFFFF' : '#F0FDFA',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: isSelected ? '0 2px 8px rgba(13, 148, 136, 0.15)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', marginBottom: '2px' }}>
                <span style={{ fontSize: '14px' }}>{cfg.icon}</span>
                <span style={{ fontSize: '11px', fontWeight: isSelected ? 800 : 700, color: isSelected ? '#0F766E' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cfg.label}
                </span>
              </div>
              <span style={{ fontSize: '9px', color: '#0D9488', fontWeight: 600 }}>
                {cfg.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bouton de déclenchement de la régénération IA */}
      <button
        type="button"
        onClick={onRegenerate}
        disabled={isRegenerating}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #0D9488 0%, #0F766E 100%)',
          color: 'white',
          border: 'none',
          fontWeight: 800,
          fontSize: '13px',
          cursor: isRegenerating ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
          opacity: isRegenerating ? 0.7 : 1
        }}
      >
        {isRegenerating ? (
          <>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Régénération en cours...</span>
          </>
        ) : (
          <>
            <Wand2 size={16} />
            <span>🪄 Régénérer avec le décor « {STUDIO_SETTINGS[selectedSetting]?.label} »</span>
          </>
        )}
      </button>

      {/* Badge statut si l'image est générée par l'IA */}
      {aiSource && (
        <div
          style={{
            marginTop: '10px',
            padding: '6px 10px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #99F6E4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#0F766E', fontWeight: 700 }}>
            <CheckCircle2 size={13} color="#0D9488" />
            <span>Rendu IA actif ({STUDIO_SETTINGS[selectedSetting]?.label})</span>
          </div>
          <button
            type="button"
            onClick={onResetStandard}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              fontSize: '10px',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            Filtre classique
          </button>
        </div>
      )}
    </div>
  );
};
