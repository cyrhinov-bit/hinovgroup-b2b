import { useState, useEffect, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Sparkles, Mic, MicOff, Loader2, Plus, AlertCircle, CheckCircle, Package } from 'lucide-react';
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
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedOrderItem[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Vérifier support Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'fr-FR';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error("L'accès au microphone a été refusé.");
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('SpeechRecognition init error:', e);
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('La reconnaissance vocale n’est pas supportée par ce navigateur.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        setTranscript('');
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Error starting recognition:', err);
      }
    }
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      toast.error('Veuillez saisir ou dicter une commande.');
      return;
    }

    setIsAnalyzing(true);
    setHasSearched(true);

    try {
      const res = await parseNaturalLanguageOrder(transcript, posProducts, userId);
      setParsedItems(res.items);
      setUnmatched(res.unmatchedPhrases);
      setInterpretation(res.rawInterpretation);

      if (res.items.length === 0) {
        toast('Aucun produit correspondant trouvé dans le catalogue.', { icon: 'ℹ️' });
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
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setTranscript('');
    setParsedItems([]);
    setUnmatched([]);
    setInterpretation('');
    setHasSearched(false);
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  const updateItemQty = (productId: string, newQty: number) => {
    if (newQty < 1) return;
    setParsedItems(prev => prev.map(item => item.productId === productId ? { ...item, quantity: newQty } : item));
  };

  const removeItem = (productId: string) => {
    setParsedItems(prev => prev.filter(item => item.productId !== productId));
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Commande Express IA (Voix & Texte)"
      width={560}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Button variant="ghost" onClick={() => { handleReset(); onClose(); }}>
            Fermer
          </Button>

          {parsedItems.length > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="primary"
                onClick={() => handleApplyToCart(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Ajouter au panier ({parsedItems.reduce((acc, i) => acc + i.quantity, 0)} articles)
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Input box with mic button */}
        <div style={{ position: 'relative' }}>
          <textarea
            rows={3}
            value={transcript}
            onChange={e => setTranscript(e.target.value)}
            placeholder='Ex: "Ajoute 3 cahiers 200p et 2 stylos bleus" ou dictez au micro...'
            style={{
              width: '100%',
              padding: '12px 50px 12px 14px',
              borderRadius: 'var(--radius-md)',
              border: isListening ? '2px solid #ef4444' : '1px solid var(--color-border)',
              fontSize: '15px',
              resize: 'none',
              outline: 'none',
              background: isListening ? '#fef2f2' : 'white',
              transition: 'border 0.2s, background 0.2s'
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAnalyze();
              }
            }}
          />

          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              title={isListening ? 'Arrêter la dictée' : 'Démarrer la dictée vocale'}
              style={{
                position: 'absolute',
                right: '12px',
                top: '12px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: isListening ? '#ef4444' : 'var(--color-surface-alt)',
                color: isListening ? 'white' : 'var(--color-text)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {isListening ? <MicOff size={18} className="animate-pulse" /> : <Mic size={18} />}
            </button>
          )}
        </div>

        {/* Action Button & Suggestions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', alignSelf: 'center' }}>Exemples :</span>
            <button
              type="button"
              onClick={() => { setTranscript('3 cahiers 200 pages et 2 bics bleus'); }}
              style={{ fontSize: '11px', padding: '3px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', cursor: 'pointer' }}
            >
              3 cahiers + 2 bics
            </button>
            <button
              type="button"
              onClick={() => { setTranscript('1 roman et 1 paquet de rame'); }}
              style={{ fontSize: '11px', padding: '3px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', cursor: 'pointer' }}
            >
              1 roman + 1 paquet
            </button>
          </div>

          <Button
            variant="primary"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !transcript.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Analyse en cours...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Analyser avec l'IA
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
            <span>Articles non trouvés : <b>{unmatched.join(', ')}</b></span>
          </div>
        )}

        {/* Parsed Items List */}
        {hasSearched && (
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={16} /> Articles détectés ({parsedItems.length})
            </div>

            {parsedItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)', fontSize: '13px' }}>
                Aucun produit du catalogue n'a pu être identifié formellement. Essayez de reformuler ou de mentionner le nom exact du produit.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
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
                        Réf: {item.reference} • Prix : {item.unitPrice.toLocaleString()} FCFA • Stock dispo : {item.stockAvailable}
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
