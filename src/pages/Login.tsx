import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import './Login.css';
import logo from '../assets/logoh.png';
import illustration from '../assets/login_illustration.png';
import { InstallButton } from '../components/InstallButton';
import type { User } from '../context/AppContext';

const testRoles: { label: string; role: User['role']; posActive: boolean; path: string; icon: string }[] = [
  { label: 'Super Admin', role: 'SuperAdmin', posActive: false, path: '/utilisateurs', icon: '👑' },
  { label: 'Admin POS', role: 'Directeur', posActive: true, path: '/pos', icon: '📊' },
  { label: 'Gérant POS', role: 'Gerant', posActive: true, path: '/pos', icon: '🛒' },
  { label: 'Caissier POS', role: 'Caissier', posActive: true, path: '/pos/terminal', icon: '💰' },
  { label: 'CRM', role: 'Directeur', posActive: false, path: '/', icon: '📋' },
  { label: 'Responsable CRM', role: 'Responsable', posActive: false, path: '/', icon: '🏢' },
  { label: 'Commercial', role: 'Commercial', posActive: false, path: '/commercial', icon: '🤝' },
];

export function Login() {
  const { login, loginAsTestUser, currentUser, loading } = useAuth();
  const { setPosWorkspace } = useAppContext();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (currentUser && !navigatingRef.current) {
      navigate('/', { replace: true });
    }
    return () => { navigatingRef.current = false; };
  }, [currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email && pin) {
      setError('');
      setIsSubmitting(true);
      const result = await login(email.trim().toLowerCase(), pin.trim());
      setIsSubmitting(false);
      if (result.success) {
        navigate('/', { replace: true });
      } else {
        setError(result.error || 'Identifiants ou code PIN incorrects.');
        setPin('');
      }
    }
  };

  const handleTestAccess = (r: typeof testRoles[0]) => {
    navigatingRef.current = true;
    loginAsTestUser(r.role);
    setPosWorkspace({ active: r.posActive });
    navigate(r.path, { replace: true });
  };

  if (loading && !currentUser) {
    return (
      <div className="login-container">
        <div className="login-header">
          <h2 style={{ color: 'var(--color-primary)' }}>HINOV DEVIS</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-illustration">
        <img src={illustration} alt="Gestion des devis" />
        <div className="illustration-overlay">
          <h2>Simplifiez la gestion de vos devis</h2>
          <p>La solution connectée et hors-ligne pour votre entreprise.</p>
        </div>
      </div>
      
      <div className="login-form-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <img src={logo} alt="Hinov" />
            </div>
            <h2 className="animated-title">Hinov Devis</h2>
            <p>Connectez-vous à votre espace</p>
          </div>

        {error && (
          <div className="login-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Adresse e-mail</label>
            <input 
              type="email" 
              className="login-input" 
              placeholder="Ex: jean.dupont@hinov.com" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
          </div>
          
          <div className="form-group">
            <label>Code PIN / Mot de passe</label>
            <input 
              type="password" 
              className="login-input" 
              placeholder="******" 
              value={pin}
              onChange={e => setPin(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
          </button>
          
          <InstallButton />
        </form>

        <div className="test-access-section">
          <div className="test-access-divider">
            <span>Accès test</span>
          </div>
          <div className="test-access-grid">
            {testRoles.map((r) => (
              <button
                key={r.label}
                type="button"
                className="test-access-btn"
                onClick={() => handleTestAccess(r)}
              >
                <span className="test-access-icon">{r.icon}</span>
                <span className="test-access-label">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
