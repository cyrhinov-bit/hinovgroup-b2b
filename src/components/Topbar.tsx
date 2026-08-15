import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, KeyRound, LogOut, Eye, EyeOff, CheckCircle2, XCircle, ArrowLeftRight, Camera, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import './Topbar.css';

export function Topbar() {
  const { currentUser, logout, updatePin } = useAuth();
  const { posWorkspace, setPosWorkspace, updateMyProfile } = useAppContext();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Fermer le menu si clic en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const openPinModal = () => {
    setShowProfileMenu(false);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setFeedback(null);
    setShowPinModal(true);
  };

  const handleSavePin = async () => {
    setFeedback(null);
    if (newPin !== confirmPin) {
      setFeedback({ type: 'error', message: 'Les deux nouveaux codes PIN ne correspondent pas.' });
      return;
    }
    setSaving(true);
    const result = await updatePin(currentPin, newPin);
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', message: 'Code PIN mis à jour avec succès !' });
      setTimeout(() => setShowPinModal(false), 1800);
    } else {
      setFeedback({ type: 'error', message: result.error || 'Une erreur est survenue.' });
    }
  };

  const pinInputProps = (value: string, onChange: (v: string) => void) => ({
    type: 'password' as const,
    maxLength: 6,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value.replace(/\D/g, '')),
    className: 'pin-input',
    placeholder: '••••••',
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await updateMyProfile({ photo: reader.result as string });
      setShowProfileMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    await updateMyProfile({ photo: '' });
    setShowProfileMenu(false);
  };

  return (
    <>
      <nav className="topbar">
        <div className="topbar-left">
          <button className="icon-button menu-toggle">
            <Menu />
          </button>
          <span className="brand-name">{posWorkspace.active ? 'HINOV POS' : 'HINOV DEVIS'}</span>
          {currentUser?.role === 'Directeur' && (
            <button
              onClick={() => {
                const newActive = !posWorkspace.active;
                setPosWorkspace({ active: newActive });
                navigate(newActive ? '/pos' : '/');
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                marginLeft: '12px', borderRadius: '6px', border: '1px solid var(--color-border)',
                backgroundColor: posWorkspace.active ? 'var(--color-success)' : 'var(--color-primary)',
                color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 500
              }}
            >
              <ArrowLeftRight size={14} />
              {posWorkspace.active ? 'Retour CRM' : 'Ouvrir POS'}
            </button>
          )}
        </div>

        <div className="topbar-right">
          <button className="icon-button notification-btn">
            <Bell />
            <span className="badge">7</span>
          </button>

          {/* Avatar profil */}
          <div className="profile-wrapper" ref={menuRef}>
            <button className="avatar-btn" onClick={() => setShowProfileMenu(p => !p)} title="Mon profil">
              {currentUser?.photo ? (
                <img src={currentUser.photo} alt="Avatar" className="avatar-img" />
              ) : (
                <span className="avatar-initials">
                  {currentUser ? getInitials(currentUser.name) : '?'}
                </span>
              )}
            </button>

            {showProfileMenu && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="avatar-lg">
                    {currentUser?.photo ? (
                      <img src={currentUser.photo} alt="Avatar" className="avatar-img-lg" />
                    ) : (
                      currentUser ? getInitials(currentUser.name) : '?'
                    )}
                  </div>
                  <div>
                    <div className="profile-name">{currentUser?.name}</div>
                    <div className="profile-role">{currentUser?.role}</div>
                    <div className="profile-email">{currentUser?.email}</div>
                  </div>
                </div>
                <button className="dropdown-item" onClick={() => photoInputRef.current?.click()}>
                  <Camera size={15} />
                  {currentUser?.photo ? 'Changer ma photo' : 'Ajouter ma photo'}
                </button>
                {currentUser?.photo && (
                  <button className="dropdown-item dropdown-item-danger" onClick={handleRemovePhoto}>
                    <Trash2 size={15} />
                    Supprimer ma photo
                  </button>
                )}
                <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                <hr className="dropdown-divider" />
                <button className="dropdown-item" onClick={openPinModal}>
                  <KeyRound size={15} />
                  Modifier le code PIN
                </button>
                <button className="dropdown-item dropdown-item-danger" onClick={logout}>
                  <LogOut size={15} />
                  Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Modal modification PIN */}
      {showPinModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPinModal(false)}>
          <div className="pin-modal">
            <div className="pin-modal-header">
              <div className="pin-modal-icon">
                <KeyRound size={22} />
              </div>
              <div>
                <h3>Modifier le code PIN</h3>
                <p>Connecté en tant que <strong>{currentUser?.name}</strong></p>
              </div>
            </div>

            <div className="pin-form">
              {/* PIN actuel */}
              <div className="pin-field">
                <label>Code PIN actuel</label>
                <div className="pin-input-wrapper">
                  <input {...pinInputProps(currentPin, setCurrentPin)} type={showCurrent ? 'text' : 'password'} id="current-pin" />
                  <button type="button" className="eye-btn" onClick={() => setShowCurrent(v => !v)}>
                    {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Nouveau PIN */}
              <div className="pin-field">
                <label>Nouveau code PIN <span className="pin-hint">(6 chiffres)</span></label>
                <div className="pin-input-wrapper">
                  <input {...pinInputProps(newPin, setNewPin)} type={showNew ? 'text' : 'password'} id="new-pin" />
                  <button type="button" className="eye-btn" onClick={() => setShowNew(v => !v)}>
                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Indicateur de force */}
                <div className="pin-strength">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`pin-dot ${i < newPin.length ? 'filled' : ''}`} />
                  ))}
                  <span className="pin-count">{newPin.length}/6</span>
                </div>
              </div>

              {/* Confirmation */}
              <div className="pin-field">
                <label>Confirmer le nouveau PIN</label>
                <div className="pin-input-wrapper">
                  <input {...pinInputProps(confirmPin, setConfirmPin)} type={showConfirm ? 'text' : 'password'} id="confirm-pin" />
                  <button type="button" className="eye-btn" onClick={() => setShowConfirm(v => !v)}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPin.length > 0 && (
                  <div className={`match-indicator ${newPin === confirmPin ? 'match' : 'no-match'}`}>
                    {newPin === confirmPin
                      ? <><CheckCircle2 size={13} /> Les PIN correspondent</>
                      : <><XCircle size={13} /> Les PIN ne correspondent pas</>
                    }
                  </div>
                )}
              </div>

              {/* Feedback */}
              {feedback && (
                <div className={`pin-feedback ${feedback.type}`}>
                  {feedback.type === 'success'
                    ? <CheckCircle2 size={16} />
                    : <XCircle size={16} />
                  }
                  {feedback.message}
                </div>
              )}

              <div className="pin-modal-actions">
                <button className="btn btn-outline" onClick={() => setShowPinModal(false)} disabled={saving}>
                  Annuler
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSavePin}
                  disabled={saving || currentPin.length === 0 || newPin.length !== 6 || confirmPin.length !== 6}
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
