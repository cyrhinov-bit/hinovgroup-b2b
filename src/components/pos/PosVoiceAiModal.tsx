import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Sparkles, Mic, MicOff, Loader2, Plus, AlertCircle, Package, Volume2, Trash2 } from 'lucide-react';
import { parseNaturalLanguageOrder, type ParsedOrderItem } from '../../features/pos/services/PosAiService';
import type { PosProduct } from '../../context/AppContext';
import { toast } from 'react-hot-toast';

interface PosVoiceAiModalProps {
  open: boolean;
  onClose: () => void;
  posProducts: PosProduct[];
  userId?: string;
  onAddItemsToCart: (items: { product: PosProduct; quantity: number }[], replace?: boolean) => void;
}

export default function PosVoiceAiModal({
  open,
  onClose,
  posProducts,
  userId,
  onAddItemsToCart
}: PosVoiceAiModalProps) {
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedOrderItem[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const transcriptRef = useRef('');

  // Synchroniser le ref avec l'état pour les callbacks d'événements
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Initialisation de la reconnaissance vocale
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onstart = () => {
        setIsListening(true);
        setPermissionError(null);
      };

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalChunk += result[0].transcript + ' ';
          } else {
            interimChunk += result[0].transcript;
          }
        }

        if (finalChunk) {
          setTranscript(prev => {
            const next = prev ? `${prev.trim()} ${finalChunk.trim()}` : finalChunk.trim();
            return next;
          });
          setInterimText('');
        } else {
          setInterimText(interimChunk);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[VoiceAI] SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setPermissionError("L'accès au microphone a été refusé. Veuillez autoriser le micro dans votre navigateur.");
          shouldListenRef.current = false;
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          // Silence normal : ne pas couper si écoute continue souhaitée
        }
      };

      recognition.onend = () => {
        // Mode Écoute permanente : si shouldListenRef est vrai, redémarrer automatiquement
        if (shouldListenRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Ignorer si déjà en cours
          }
        } else {
          setIsListening(false);
          setInterimText('');
        }
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('[VoiceAI] Erreur initialisation WebSpeech:', e);
      setSpeechSupported(false);
    }

    return () => {
      shouldListenRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Démarre l'écoute continue
  const startContinuousListening = async () => {
    if (!recognitionRef.current) {
      toast.error('Reconnaissance vocale non disponible sur ce navigateur.');
      return;
    }

    try {
      // Demande explicite de permission micro
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      shouldListenRef.current = true;
      setIsListening(true);
      setPermissionError(null);
      recognitionRef.current.start();
      toast.success('Micro activé en permanence. Parlez librement !');
    } catch (err: any) {
      console.error('[VoiceAI] Start error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError("Permission micro refusée. Cliquez sur le cadenas 🔒 dans la barre d'adresse pour autoriser le micro.");
      } else {
        // Tenter quand même de démarrer la reconnaissance
        try {
          shouldListenRef.current = true;
          setIsListening(true);
          recognitionRef.current.start();
        } catch (e) {
          setPermissionError("Impossible de démarrer le micro : " + (err.message || err));
        }
      }
    }
  };

  // Arrête l'écoute
  const stopListening = () => {
    shouldListenRef.current = false;
    setIsListening(false);
    setInterimText('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    toast('Micro désactivé.', { icon: '🔇' });
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startContinuousListening();
    }
  };

  // Fermeture du modal
  const handleClose = () => {
    stopListening();
    setTranscript('');
    setInterimText('');
    setParsedItems([]);
    setUnmatched([]);
    setInterpretation('');
    setHasSearched(false);
    onClose();
  };

  // Lancement de l'analyse IA
  const handleAnalyze = async (textToAnalyze?: string) => {
    const raw = (typeof textToAnalyze === 'string' ? textToAnalyze : transcript).trim();
    if (!raw) {
      toast.error('Veuillez dicter ou saisir une commande avant d’analyser.');
      return;
    }

    setIsAnalyzing(true);
    setHasSearched(true);

    try {
      const res = await parseNaturalLanguageOrder(raw, posProducts, userId);
      setParsedItems(res.items);
      setUnmatched(res.unmatchedPhrases);
      setInterpretation(res.rawInterpretation);

      if (res.items.length === 0) {
        toast('Aucun article trouvé pour cette formulation.', { icon: 'ℹ️' });
      } else {
        toast.success(`${res.items.length} article(s) reconnu(s) !`);
      }
    } catch (error: any) {
      toast.error('Erreur lors de l’analyse : ' + (error.message || error));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyToCart = (replace = false) => {
    if (parsedItems.length === 0) return;

    const itemsToAdd = parsedItems.map(item => {
      const prod = posProducts.find(p => p.id === item.productId);
      return {
        product: prod!,
        quantity: item.quantity
      };
    }).filter(i => !!i.product);

    onAddItemsToCart(itemsToAdd, replace);
    toast.success(`${itemsToAdd.length} article(s) ajouté(s) au panier !`);
    handleClose();
  };

  const updateItemQty = (productId: string, newQty: number) => {
    if (newQty < 1) return;
    setParsedItems(prev => prev.map(item => item.productId === productId ? { ...item, quantity: newQty } : item));
  };

  const removeItem = (productId: string) => {
    setParsedItems(prev => prev.filter(item => item.productId !== productId));
  };

  const fullDisplayTranscript = transcript + (interimText ? (transcript ? ' ' : '') + interimText : '');

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Commande Express IA (Dictée Vocale Continue & Texte)"
      width={580}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Button variant="ghost" onClick={handleClose}>
            Fermer
          </Button>

          {parsedItems.length > 0 && (
            <Button
              variant="primary"
              onClick={() => handleApplyToCart(false)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Ajouter au panier ({parsedItems.reduce((acc, i) => acc + i.quantity, 0)} articles)
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Permission / Support Warning */}
        {permissionError && (
          <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#b91c1c', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{permissionError}</span>
          </div>
        )}

        {!speechSupported && (
          <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', color: '#b45309', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>La reconnaissance vocale nécessite Google Chrome ou Microsoft Edge. Vous pouvez néanmoins taper du texte ci-dessous.</span>
          </div>
        )}

        {/* Microphone Permanent Toggle Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: isListening ? '#f0fdf4' : 'var(--color-surface-alt)',
          border: isListening ? '2px solid #22c55e' : '1px solid var(--color-border)',
          transition: 'all 0.2s'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: isListening ? '#22c55e' : '#94a3b8',
              boxShadow: isListening ? '0 0 0 4px rgba(34, 197, 94, 0.25)' : 'none',
              animation: isListening ? 'pulse 1.5s infinite' : 'none'
            }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: isListening ? '#166534' : 'var(--color-text)' }}>
                {isListening ? '🎙️ Micro ACTIF EN PERMANENCE' : '🔇 Micro DÉSACTIVÉ'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                {isListening ? 'Parlez naturellement, la transcription s’enrichit en direct' : 'Cliquez sur le bouton pour activer l’écoute continue'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleListening}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: isListening ? '#ef4444' : '#16a34a',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            {isListening ? (
              <>
                <MicOff size={15} /> Couper le micro
              </>
            ) : (
              <>
                <Mic size={15} /> Activer le micro
              </>
            )}
          </button>
        </div>

        {/* Text / Live transcript Area */}
        <div style={{ position: 'relative' }}>
          <textarea
            rows={4}
            value={fullDisplayTranscript}
            onChange={e => {
              setTranscript(e.target.value);
              setInterimText('');
            }}
            placeholder='Exemple : "Ajoute 3 cahiers 200 pages et 2 stylos bleus bic et 1 roman"'
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: isListening ? '2px solid #22c55e' : '1px solid var(--color-border)',
              fontSize: '15px',
              lineHeight: '1.5',
              resize: 'none',
              outline: 'none',
              background: isListening ? '#fafffa' : 'white',
              transition: 'all 0.2s'
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAnalyze();
              }
            }}
          />

          {transcript && (
            <button
              type="button"
              onClick={() => {
                setTranscript('');
                setInterimText('');
              }}
              style={{
                position: 'absolute',
                right: '10px',
                bottom: '12px',
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Effacer le texte"
            >
              <Trash2 size={12} /> Effacer
            </button>
          )}
        </div>

        {/* Quick action buttons & examples */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', alignSelf: 'center' }}>Exemples :</span>
            <button
              type="button"
              onClick={() => {
                setTranscript('3 cahiers 200 pages et 2 bics bleus');
                handleAnalyze('3 cahiers 200 pages et 2 bics bleus');
              }}
              style={{ fontSize: '11px', padding: '4px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', cursor: 'pointer' }}
            >
              3 cahiers + 2 bics
            </button>
            <button
              type="button"
              onClick={() => {
                setTranscript('1 roman et 1 paquet de rame');
                handleAnalyze('1 roman et 1 paquet de rame');
              }}
              style={{ fontSize: '11px', padding: '4px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', cursor: 'pointer' }}
            >
              1 roman + 1 paquet
            </button>
          </div>

          <Button
            variant="primary"
            onClick={() => handleAnalyze()}
            disabled={isAnalyzing || !fullDisplayTranscript.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Analyse IA en cours...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Analyser et trouver les articles
              </>
            )}
          </Button>
        </div>

        {/* Interpretation / AI notes */}
        {interpretation && (
          <div style={{ fontSize: '13px', padding: '10px 12px', background: 'var(--color-primary-tint)', borderRadius: 'var(--radius-md)', color: 'var(--color-primary-strong)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} />
            <span>{interpretation}</span>
          </div>
        )}

        {/* Unmatched alerts */}
        {unmatched.length > 0 && (
          <div style={{ fontSize: '13px', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>Articles non trouvés dans le catalogue : <b>{unmatched.join(', ')}</b></span>
          </div>
        )}

        {/* Parsed Items List */}
        {hasSearched && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={16} /> Articles identifiés ({parsedItems.length})
            </div>

            {parsedItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                Aucun produit du catalogue n'a pu être identifié formellement. Reformulez ou vérifiez les noms dans le catalogue.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {parsedItems.map(item => (
                  <div
                    key={item.productId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--color-surface-alt)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ flex: 1, marginRight: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{item.productName}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        Réf: {item.reference} • Prix : {item.unitPrice.toLocaleString()} FCFA • Stock : {item.stockAvailable}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => updateItemQty(item.productId, parseInt(e.target.value) || 1)}
                        style={{
                          width: '54px',
                          padding: '4px 6px',
                          textAlign: 'center',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          fontWeight: 600
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-error)',
                          cursor: 'pointer',
                          padding: '4px',
                          fontSize: '13px'
                        }}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
