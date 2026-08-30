import { useState, useEffect } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';

interface PwaInstallPromptProps {
  variant?: 'button' | 'banner' | 'nav-item' | 'icon-button';
  className?: string;
  onInstalled?: () => void;
}

export function PwaInstallPrompt({ variant = 'button', className = '' }: PwaInstallPromptProps) {
  const getPrompt = () => (window as any).deferredPWAInstallPrompt || (window as any).deferredInstallPrompt || null;
  const [deferredPrompt, setDeferredPrompt] = useState<any>(getPrompt);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Vérifier si l'application est déjà lancée en mode autonome (PWA installée)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    const syncPrompt = () => {
      const p = getPrompt();
      if (p) setDeferredPrompt(p);
    };

    syncPrompt();

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPWAInstallPrompt = e;
      (window as any).deferredInstallPrompt = e;
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).deferredPWAInstallPrompt = null;
      (window as any).deferredInstallPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('pwa-install-ready', syncPrompt);
    window.addEventListener('pwa-installable', syncPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('pwa-install-ready', syncPrompt);
      window.removeEventListener('pwa-installable', syncPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    const promptEvent = deferredPrompt || getPrompt();
    if (promptEvent && typeof promptEvent.prompt === 'function') {
      try {
        promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          (window as any).deferredPWAInstallPrompt = null;
          (window as any).deferredInstallPrompt = null;
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error('Erreur lors du prompt d\'installation:', err);
      }
    } else {
      // Fallback si l'API est absente ou si le navigateur n'a pas encore émis l'événement
      console.log('Prompt non disponible pour le moment.');
    }
  };

  if (isInstalled) {
    if (variant === 'nav-item') {
      return (
        <div className="native-bottom-nav-item active">
          <CheckCircle2 size={20} color="#0F766E" />
          <span>Installé</span>
        </div>
      );
    }
    return null;
  }

  // Rendu dans la barre de navigation inférieure mobile (Bottom Nav)
  if (variant === 'nav-item') {
    return (
      <button
        onClick={handleInstallClick}
        className="native-bottom-nav-item install-cta"
        type="button"
        title="Installer l'application"
      >
        <div className="nav-icon-badge-wrap">
          <Download size={20} />
          <span className="install-pulse-dot" />
        </div>
        <span>Installer</span>
      </button>
    );
  }

  // Rendu icône seule pour la Topbar
  if (variant === 'icon-button') {
    return (
      <button
        onClick={handleInstallClick}
        className={`native-topbar-install-btn ${className}`}
        type="button"
        title="Installer l'application"
      >
        <Download size={16} />
        <span className="install-label-desktop">Installer</span>
      </button>
    );
  }

  // Rendu bouton normal
  return (
    <button
      onClick={handleInstallClick}
      className={className}
      type="button"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: '#0F766E',
        color: 'white',
        border: 'none',
        padding: '7px 14px',
        borderRadius: '20px',
        fontWeight: 600,
        fontSize: '12px',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(15, 118, 110, 0.25)',
        transition: 'transform 0.15s',
        whiteSpace: 'nowrap'
      }}
    >
      <Download size={14} />
      <span>Installer l'app</span>
    </button>
  );
}
