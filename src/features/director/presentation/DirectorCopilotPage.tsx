import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, Mic, MicOff, Loader2, TrendingUp, AlertTriangle, ShieldCheck, HelpCircle, RefreshCw, BarChart3, ArrowRight } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { askDirectorCopilot, type CopilotMessage } from '../services/DirectorAiService';
import { Button } from '../../../components/ui/Button';
import { toast } from 'react-hot-toast';

export default function DirectorCopilotPage() {
  const { currentUser } = useAuth();
  const { posProducts, posTransactions, posCashSessions, posReturns, users } = useAppContext();

  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Bonjour **${currentUser?.name || 'Monsieur le Directeur'}** ! Je suis votre **Copilote Décisionnel IA (Point de Vente)**.\n\nJe suis connecté en direct aux données du magasin : ventes de caisse, stocks, sessions de caisse, remises et rentabilité.\n\nQuelle analyse souhaitez-vous effectuer aujourd'hui ?`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      suggestedFollowUps: [
        "📊 Bilan d'activité du magasin",
        "⚠️ Quels sont les articles en rupture ou stock critique ?",
        "💰 Y a-t-il eu des écarts lors des clôtures de caisse ?",
        "🏆 Quel est le top 5 de nos articles les plus vendus ?"
      ]
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || loading) return;

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({
        role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: m.text }]
      }));

      const res = await askDirectorCopilot(
        q,
        {
          posProducts,
          posTransactions,
          posCashSessions,
          posReturns,
          users,
          currentUserName: currentUser?.name,
          userId: currentUser?.id
        },
        history
      );

      const assistantMsg: CopilotMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: res.replyText,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        suggestedFollowUps: res.suggestedFollowUps
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      toast.error('Erreur Copilot : ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Reconnaissance vocale non supportée par votre navigateur (utilisez Chrome ou Edge).');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.lang = 'fr-FR';
      rec.onstart = () => setIsListening(true);
      rec.onresult = (e: any) => {
        const spoken = e.results[0][0].transcript;
        if (spoken) {
          setInputQuery(spoken);
          handleSend(spoken);
        }
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
      rec.start();
      toast('Écoute en cours... parlez !', { icon: '🎙️' });
    } catch {
      setIsListening(false);
    }
  };

  return (
    <div className="dashboard" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)', padding: '0 20px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Bot size={26} color="#8B5CF6" /> Copilot Décisionnel Direction (IA)
          </h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0', fontSize: '14px' }}>
            Interrogez en direct toutes les données de vente, caisses, finances et stocks en français
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setMessages([
              {
                id: `welcome-${Date.now()}`,
                sender: 'assistant',
                text: `Bonjour **${currentUser?.name || 'Monsieur le Directeur'}** ! Conversation réinitialisée. En quoi puis-je vous éclairer ?`,
                timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                suggestedFollowUps: [
                  "Bilan financier global",
                  "Articles en rupture",
                  "Contrôle des écarts de caisse"
                ]
              }
            ]);
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} /> Nouvelle discussion
        </Button>
      </div>

      {/* Main Chat Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden'
      }}>
        {/* Strategic Advice Quick Pills */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 16px',
          background: 'linear-gradient(90deg, #F5F3FF 0%, #EFF6FF 100%)',
          borderBottom: '1px solid var(--color-border)',
          overflowX: 'auto',
          flexShrink: 0
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#6D28D9', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <Sparkles size={13} color="#7C3AED" /> Conseils Express :
          </span>
          <button
            type="button"
            onClick={() => handleSend("Donnez-moi vos conseils et votre plan d'action pour booster le chiffre d'affaires et le panier moyen du magasin")}
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              border: '1px solid #DDD6FE',
              background: 'white',
              color: '#5B21B6',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            🚀 Booster le Chiffre d'Affaires
          </button>
          <button
            type="button"
            onClick={() => handleSend("Quels sont vos conseils pour l'approvisionnement et la gestion des ruptures de stock ?")}
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              border: '1px solid #BAE6FD',
              background: 'white',
              color: '#0369A1',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            📦 Conseils Approvisionnement & Stocks
          </button>
          <button
            type="button"
            onClick={() => handleSend("Comment optimiser nos marges et encadrer les remises accordées en caisse ?")}
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              border: '1px solid #FED7AA',
              background: 'white',
              color: '#C2410C',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            🏷️ Optimiser les Marges & Prix
          </button>
          <button
            type="button"
            onClick={() => handleSend("Quels sont vos conseils pour sécuriser les caisses et supprimer les écarts de fin de journée ?")}
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              border: '1px solid #FECACA',
              background: 'white',
              color: '#B91C1C',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            🛡️ Sécuriser les Clôtures de Caisse
          </button>
        </div>

        {/* Messages List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                padding: '14px 18px',
                borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                background: msg.sender === 'user' ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'var(--color-surface-alt)',
                color: msg.sender === 'user' ? 'white' : 'var(--color-text)',
                fontSize: '14px',
                lineHeight: '1.6',
                border: msg.sender === 'assistant' ? '1px solid var(--color-border)' : 'none',
                whiteSpace: 'pre-line'
              }}>
                {msg.text}
              </div>

              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px', padding: '0 4px' }}>
                {msg.timestamp}
              </div>

              {/* Follow up suggestions */}
              {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {msg.suggestedFollowUps.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(sug)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--color-border)',
                        background: 'white',
                        color: 'var(--color-primary-strong)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s'
                      }}
                    >
                      <Sparkles size={12} color="#8B5CF6" /> {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'var(--color-surface-alt)', borderRadius: '16px', alignSelf: 'flex-start', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              <Loader2 size={16} className="animate-spin" /> Analyse des bases de données et calculs en cours...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)', background: '#FAF5FF', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={toggleVoice}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: isListening ? '#ef4444' : 'white',
              color: isListening ? 'white' : 'var(--color-text)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            title={isListening ? 'Arrêter le micro' : 'Poser la question à la voix'}
          >
            {isListening ? <MicOff size={18} className="animate-pulse" /> : <Mic size={18} />}
          </button>

          <input
            type="text"
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Posez une question sur les ventes, stocks, marges, créances ou rapports..."
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)',
              fontSize: '14px',
              outline: 'none',
              background: 'white'
            }}
          />

          <Button
            variant="primary"
            onClick={() => handleSend()}
            disabled={loading || !inputQuery.trim()}
            style={{ borderRadius: 'var(--radius-full)', padding: '0 20px', height: '42px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Send size={16} /> Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
}

