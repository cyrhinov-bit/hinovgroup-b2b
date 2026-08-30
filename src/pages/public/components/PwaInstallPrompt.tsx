import { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, CheckCircle2, Smartphone } from 'lucide-react';

interface PwaInstallPromptProps {
  variant?: 'button' | 'banner' | 'floating';
  className?: string;
  onInstalled?: () => void;
}

export function PwaInstallPrompt({ variant = 'button', className = '' }: PwaInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosModal, setShowIosModal] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    // Vérifier si l'application est déjà installée en mode standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Détection iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    if (isIosDevice) {
      setIsInstallable(true);
    }

    // Écouter l'événement standard PWA beforeinstallprompt (Android, Chrome, Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) return;

    if (isIOS) {
      setShowIosModal(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback si pas de prompt disponible
      setShowIosModal(true);
    }
  };

  if (isInstalled) {
    return null;
  }

  // Rendu sous forme de Bannière en haut
  if (variant === 'banner' && !bannerDismissed) {
    return (
      <>
        <div style={{
          backgroundColor: '#0F766E',
          color: 'white',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontSize: '13px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Smartphone size={18} style={{ flexShrink: 0 }} />
            <span>Installez l'application <strong>Hinov Catalogue</strong> pour un accès rapide hors ligne !</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleInstallClick}
              style={{
                backgroundColor: 'white',
                color: '#0F766E',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '20px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Download size={14} /> Installer
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8, padding: '4px' }}
              title="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal iOS Guide */}
        {showIosModal && <IosInstallModal onClose={() => setShowIosModal(false)} />}
      </>
    );
  }

  // Rendu sous forme de Bouton normal
  return (
    <>
      <button
        onClick={handleInstallClick}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#0F766E',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: 'var(--radius-md, 8px)',
          fontWeight: 600,
          fontSize: '13px',
          cursor: 'pointer',
          boxShadow: '0 2px 4px rgba(15, 118, 110, 0.2)',
          transition: 'all 0.2s'
        }}
      >
        <Download size={16} />
        <span>Installer le Catalogue</span>
      </button>

      {/* Modal iOS Guide */}
      {showIosModal && <IosInstallModal onClose={() => setShowIosModal(false)} />}
    </>
  );
}

function IosInstallModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(3px)'
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          padding: '24px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: '#F3F4F6',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={16} color="#4B5563" />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              backgroundColor: '#CCFBF1',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto'
            }}
          >
            <Smartphone size={28} color="#0F766E" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0', color: '#111827' }}>
            Installer sur votre téléphone
          </h3>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
            Ajoutez le catalogue Hinov Group sur votre écran d'accueil pour y accéder comme une vraie application !
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0F766E', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
              1
            </div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>
              Appuyez sur le bouton <strong>Partager</strong> <Share size={15} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} /> dans la barre de votre navigateur (Safari).
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0F766E', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
              2
            </div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>
              Faites défiler les options et touchez <strong>"Sur l'écran d'accueil"</strong> <PlusSquare size={15} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} />.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#0F766E', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
              3
            </div>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.4' }}>
              Appuyez sur <strong>"Ajouter"</strong> en haut à droite. L'icône Hinov sera créée sur votre téléphone !
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            backgroundColor: '#0F766E',
            color: 'white',
            border: 'none',
            padding: '12px',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          C'est compris !
        </button>
      </div>
    </div>
  );
}
