import { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { Search, Trash2, Plus, Minus, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { barcodeScannerService } from '../../features/products/services/BarcodeScannerService';
import ProductImage from '../../features/products/images/ProductImage';
import ReceiptTicket from '../../components/pos/ReceiptTicket';
import type { ReceiptData } from '../../components/pos/ReceiptTicket';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { toast } from 'react-hot-toast';
import { platform } from '../../platform';

interface CartItem { id: string; productId: string; name: string; reference: string; unitPrice: number; quantity: number; discountType: 'none' | 'percent' | 'amount'; discountPercent: number; discountAmount: number; total: number; }

export default function PosTerminal() {
  const navigate = useNavigate();
  const { posProducts, posSettings, posCashSessions, addPosTransaction, addPosCashSession, suspendedCarts, addSuspendedCart, removeSuspendedCart, settings: crmSettings } = useAppContext();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!currentUser) return [];
    try { const saved = localStorage.getItem(`pos_active_cart_${currentUser.id}`); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'amount'>(() => {
    if (!currentUser) return 'none';
    return (localStorage.getItem(`pos_active_discount_type_${currentUser.id}`) as any) || 'none';
  });
  const [discountValue, setDiscountValue] = useState(() => {
    if (!currentUser) return 0;
    return Number(localStorage.getItem(`pos_active_discount_value_${currentUser.id}`)) || 0;
  });

  useEffect(() => { if (currentUser) localStorage.setItem(`pos_active_cart_${currentUser.id}`, JSON.stringify(cart)); }, [cart, currentUser]);
  useEffect(() => { if (currentUser) localStorage.setItem(`pos_active_discount_type_${currentUser.id}`, discountType); }, [discountType, currentUser]);
  useEffect(() => { if (currentUser) localStorage.setItem(`pos_active_discount_value_${currentUser.id}`, String(discountValue)); }, [discountValue, currentUser]);

  const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'Mobile Money' | 'Mixte'>('Espèces');
  const [cashAmount, setCashAmount] = useState<number | ''>('');
  const [mobileAmount, setMobileAmount] = useState<number | ''>('');
  const [showPayment, setShowPayment] = useState(false);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [initialFund, setInitialFund] = useState('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReference, setSuspendReference] = useState('');
  const [showSuspendedList, setShowSuspendedList] = useState(false);
  const [selectedCartIndex, setSelectedCartIndex] = useState(0);
  const openSession = posCashSessions.find(s => s.status === 'Ouverte' && s.cashierId === currentUser?.id);

  const filteredProducts = posProducts.filter(p => {
    if (p.isActive === false) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q) || (p.barcode && p.barcode.includes(q)) || (p.isbn && p.isbn.includes(q));
  });

  const addToCart = (product: typeof posProducts[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.productId === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        let total: number;
        if (existing.discountType === 'percent') {
          total = newQty * existing.unitPrice * (1 - existing.discountPercent / 100);
        } else if (existing.discountType === 'amount') {
          total = newQty * existing.unitPrice - existing.discountAmount;
        } else {
          total = newQty * existing.unitPrice;
        }
        return prev.map(c => c.productId === product.id ? { ...c, quantity: newQty, total } : c);
      }
      return [...prev, { id: uuidv4(), productId: product.id, name: product.name, reference: product.reference, unitPrice: product.sellingPrice, quantity: 1, discountType: 'none' as const, discountPercent: 0, discountAmount: 0, total: product.sellingPrice }];
    });
    setSearch('');
  };

  useEffect(() => {
    barcodeScannerService.startKeyboardListener();
    const unsubscribe = barcodeScannerService.subscribe((barcode: string) => {
      const result = barcodeScannerService.searchProduct(barcode, posProducts.filter(p => p.isActive !== false));
      if (result.products.length === 1) {
        addToCart(result.products[0]);
      } else {
        setSearch(barcode);
      }
    });
    return () => {
      unsubscribe();
      barcodeScannerService.stopKeyboardListener();
    };
  }, [posProducts]);

  const updateCartQty = useCallback((id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newQty = Math.max(1, c.quantity + delta);
      const lineDiscount = c.discountType === 'percent' ? c.discountPercent / 100 : 0;
      const lineAmount = c.discountType === 'amount' ? c.discountAmount : 0;
      return { ...c, quantity: newQty, total: newQty * c.unitPrice * (1 - lineDiscount) - lineAmount };
    }));
  }, []);

  const setExactCartQty = useCallback((id: string, qty: number) => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newQty = Math.max(1, qty || 1);
      const lineDiscount = c.discountType === 'percent' ? c.discountPercent / 100 : 0;
      const lineAmount = c.discountType === 'amount' ? c.discountAmount : 0;
      return { ...c, quantity: newQty, total: newQty * c.unitPrice * (1 - lineDiscount) - lineAmount };
    }));
  }, []);

  const updateCartDiscountType = (id: string, type: 'none' | 'percent' | 'amount') => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (type === 'none') return { ...c, discountType: type, discountPercent: 0, discountAmount: 0, total: c.quantity * c.unitPrice };
      if (type === 'percent') return { ...c, discountType: type, discountPercent: Math.min(c.discountPercent || 0, 100), discountAmount: 0, total: c.quantity * c.unitPrice * (1 - Math.min(c.discountPercent || 0, 100) / 100) };
      return { ...c, discountType: type, discountPercent: 0, discountAmount: Math.min(c.discountAmount || 0, c.quantity * c.unitPrice), total: c.quantity * c.unitPrice - Math.min(c.discountAmount || 0, c.quantity * c.unitPrice) };
    }));
  };

  const updateCartDiscount = (id: string, type: 'percent' | 'amount', value: number) => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (type === 'percent') {
        const disc = Math.min(value, 100);
        return { ...c, discountType: 'percent', discountPercent: disc, discountAmount: 0, total: c.quantity * c.unitPrice * (1 - disc / 100) };
      }
      const cap = Math.min(value, c.quantity * c.unitPrice);
      return { ...c, discountType: 'amount', discountPercent: 0, discountAmount: cap, total: c.quantity * c.unitPrice - cap };
    }));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

  const subtotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);
  const cartDiscount = cart.reduce((sum, c) => sum + c.discountAmount + (c.unitPrice * c.quantity * c.discountPercent / 100), 0);
  const afterCartDiscount = subtotal - cartDiscount;
  let globalDiscount = 0;
  if (discountType === 'percent') globalDiscount = afterCartDiscount * discountValue / 100;
  else if (discountType === 'amount') globalDiscount = discountValue;
  const total = Math.max(0, afterCartDiscount - globalDiscount);

  const handlePayment = async () => {
    if (!openSession) { alert('Aucune session caisse ouverte.'); return; }
    if (cart.length === 0) { alert('Panier vide.'); return; }

    const receivedCash = Number(cashAmount) || 0;
    const receivedMobile = Number(mobileAmount) || 0;
    
    let receivedTotal = 0;
    if (paymentMethod === 'Espèces') receivedTotal = receivedCash;
    else if (paymentMethod === 'Mobile Money') receivedTotal = receivedMobile;
    else if (paymentMethod === 'Mixte') receivedTotal = receivedCash + receivedMobile;

    if (receivedTotal < total) {
      alert(`Montant reçu insuffisant : l'encaissement (${receivedTotal.toLocaleString()} FCFA) doit être supérieur ou égal au total (${total.toLocaleString()} FCFA).`);
      return;
    }

    const outOfStock = cart.filter(c => {
      const product = posProducts.find(p => p.id === c.productId);
      return product && c.quantity > product.quantity;
    });
    if (outOfStock.length > 0) {
      alert(`Stock insuffisant pour : ${outOfStock.map(c => c.name).join(', ')}`);
      return;
    }
    const txNumber = `VTE-${Date.now().toString(36).toUpperCase()}`;

    const payments: any[] = [];
    if (paymentMethod === 'Mixte') {
      if (receivedCash > 0) payments.push({ id: uuidv4(), method: 'Espèces', amount: receivedCash });
      if (receivedMobile > 0) payments.push({ id: uuidv4(), method: 'Mobile Money', amount: receivedMobile });
    } else {
      payments.push({ id: uuidv4(), method: paymentMethod, amount: total });
    }

    const tx = {
      id: uuidv4(), transactionNumber: txNumber, cashierId: currentUser?.id, sessionId: openSession.id,
      date: new Date().toISOString(), subtotal, vat: 0, discountAmount: cartDiscount + globalDiscount,
      total, status: 'Validée' as const,
      lines: cart.map(c => ({ id: uuidv4(), productId: c.productId, description: c.name, quantity: c.quantity, unitPrice: c.unitPrice, discountPercent: c.discountPercent, discountAmount: c.discountAmount, total: c.total })),
      payments
    };

    const changeAmount = paymentMethod === 'Espèces' || paymentMethod === 'Mixte' ? Math.max(0, receivedTotal - total) : 0;

    await addPosTransaction(tx);

    const currentReceiptData = {
      transaction: tx,
      cart: [...cart],
      paymentMethod,
      cashAmount: receivedCash,
      changeAmount,
      total,
      subtotal,
      globalDiscount,
      settings: posSettings,
      crmSettings: crmSettings
    };

    setReceiptData(currentReceiptData);
    
    setCart([]);
    setShowPayment(false);
    setDiscountType('none');
    setDiscountValue(0);
    setCashAmount('');
    setMobileAmount('');

    if (import.meta.env.DEV) {
      setShowPreviewModal(true);
    } else {
      // Clear form and local storage
      setCart([]);
      setDiscountType('none');
      setDiscountValue(0);
      setPaymentMethod('Espèces');
      setCashAmount('');
      setMobileAmount('');
      setShowPayment(false);
      
      localStorage.removeItem('pos_active_cart');
      localStorage.removeItem('pos_active_discount_type');
      localStorage.removeItem('pos_active_discount_value');

      toast.success('Paiement validé avec succès !');
      setTimeout(async () => {
        if (platform.isDesktop) {
          try {
            await platform.pos.printReceipt(currentReceiptData);
          } catch (e: any) {
            toast.error("Erreur d'impression: " + (e.message || e));
          }
        } else {
          window.print();
        }
      }, 100);
    }
  };

  const handleSuspendCart = () => {
    if (cart.length === 0) return;
    addSuspendedCart({
      id: uuidv4(),
      reference: suspendReference || `Ticket ${suspendedCarts.length + 1}`,
      date: new Date().toISOString(),
      cart: [...cart]
    });
    setCart([]);
    setDiscountType('none');
    setDiscountValue(0);
    setShowSuspendModal(false);
    setSuspendReference('');
  };

  const handleResumeCart = (suspendedCart: any) => {
    if (cart.length > 0) {
      if (!window.confirm("Attention, le panier actuel n'est pas vide. Voulez-vous l'écraser ?")) {
        return;
      }
    }
    setCart(suspendedCart.cart);
    removeSuspendedCart(suspendedCart.id);
    setShowSuspendedList(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Modals Enter handling
      if (showPreviewModal && e.key === 'Enter') {
        e.preventDefault();
        if (platform.isDesktop && receiptData) {
          platform.pos.printReceipt({
            ...receiptData,
            settings: posSettings
          }).catch((err: any) => toast.error("Erreur d'impression: " + (err.message || err)));
        } else {
          setTimeout(() => { window.print(); }, 100);
        }
        setShowPreviewModal(false);
        return;
      }
      if (showPayment && e.key === 'Enter') {
        e.preventDefault();
        handlePayment();
        return;
      }
      if (showOpenModal && e.key === 'Enter') {
        e.preventDefault();
        const fund = Number(initialFund);
        if (!isNaN(fund)) {
          addPosCashSession({ id: uuidv4(), cashierId: currentUser?.id, openedAt: new Date().toISOString(), initialFund: fund, status: 'Ouverte' }).then(() => {
            setShowOpenModal(false);
            setInitialFund('');
          });
        }
        return;
      }

      // Cart navigation
      if (cart.length > 0 && !showPayment && !showPreviewModal && !showOpenModal && !showSuspendModal && !showSuspendedList) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCartIndex(prev => Math.max(0, prev - 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCartIndex(prev => Math.min(cart.length - 1, prev + 1));
        } else if (e.key === 'ArrowLeft') {
          const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT';
          if (!isInputFocused) {
            e.preventDefault();
            const item = cart[selectedCartIndex];
            if (item) updateCartQty(item.id, -1);
          }
        } else if (e.key === 'ArrowRight') {
          const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT';
          if (!isInputFocused) {
            e.preventDefault();
            const item = cart[selectedCartIndex];
            if (item) updateCartQty(item.id, 1);
          }
        } else if (e.key === 'Enter') {
          const isSearchFocused = document.activeElement?.tagName === 'INPUT' && (document.activeElement as HTMLInputElement).placeholder.includes('Scanner');
          if (!isSearchFocused && openSession) {
            e.preventDefault();
            setShowPayment(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, selectedCartIndex, showPayment, showPreviewModal, showOpenModal, showSuspendModal, showSuspendedList, initialFund, openSession, currentUser, cashAmount, mobileAmount, paymentMethod, discountType, discountValue, updateCartQty]);

  useEffect(() => {
    if (selectedCartIndex >= cart.length && cart.length > 0) {
      setSelectedCartIndex(cart.length - 1);
    } else if (cart.length === 0 && selectedCartIndex !== 0) {
      setSelectedCartIndex(0);
    }
  }, [cart.length, selectedCartIndex]);

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '14px', outline: 'none' };

  return (
    <>
      <ReceiptTicket data={receiptData} settings={posSettings} crmSettings={crmSettings} />
      <div className="pos-terminal-container" style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '16px', padding: '0 24px 24px' }}>
        {/* Left: Product catalog */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate('/pos')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'white', cursor: 'pointer', color: 'var(--color-text)' }} title="Retour au tableau de bord">
            <ArrowLeft size={18} />
          </button>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input 
              autoFocus 
              style={{ ...inputStyle, paddingLeft: '36px', fontSize: '16px' }} 
              placeholder="Scanner code-barres ou rechercher..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              onKeyDown={e => { 
                if (e.key === 'Enter') {
                  if (barcodeScannerService.isScannerActive()) return;
                  const query = search.trim();
                  if (query) {
                    if (filteredProducts.length === 1) {
                      addToCart(filteredProducts[0]);
                      setSearch('');
                    } else if (filteredProducts.length === 0) {
                      toast.error(`Produit introuvable : ${query}`, { duration: 3000 });
                      setSearch('');
                    }
                  }
                } 
              }} 
            />
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', alignContent: 'start' }}>
          {filteredProducts.slice(0, 50).map(p => (
            <button key={p.id} onClick={() => addToCart(p)} disabled={p.quantity <= 0} style={{ padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: p.quantity <= 0 ? 'var(--color-surface-alt)' : 'white', cursor: p.quantity <= 0 ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: p.quantity <= 0 ? 0.5 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><ProductImage product={p} size={56} rounded /></div>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px', lineHeight: '1.2' }}>{p.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>{p.reference}</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-primary)' }}>{p.sellingPrice.toLocaleString()} FCFA</div>
              <div style={{ fontSize: '11px', color: p.quantity <= 0 ? 'var(--color-error)' : 'var(--color-text-muted)', marginTop: '4px' }}>Stock: {p.quantity}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: Cart */}
      <div style={{ width: '420px', display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Panier ({cart.length})</h3>
            <button onClick={() => setShowSuspendedList(true)} style={{ background: 'var(--color-surface-alt)', border: 'none', borderRadius: 'var(--radius-lg)', padding: '4px 8px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--color-text)' }}>
              <Clock size={12} /> {suspendedCarts?.length || 0} en attente
            </button>
          </div>
          {cart.length > 0 && <button onClick={() => setCart([])} style={{ fontSize: '13px', color: 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer' }}>Vider</button>}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>Panier vide</div>
          ) : (
            cart.map((item, index) => (
              <div key={item.id} style={{ padding: '12px', borderBottom: '1px solid var(--color-surface-alt)', background: index === selectedCartIndex ? 'var(--color-primary-tint)' : 'transparent', borderRadius: index === selectedCartIndex ? 'var(--radius-md)' : '0', transition: 'background 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: index === selectedCartIndex ? 600 : 500, flex: 1, color: index === selectedCartIndex ? 'var(--color-primary-strong)' : 'inherit' }}>
                    {index === selectedCartIndex && <span style={{ marginRight: '8px' }}>▶</span>}
                    {item.name}
                  </div>
                  <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}><Trash2 size={14} /></button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <button onClick={() => updateCartQty(item.id, -1)} style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={12} /></button>
                  <input type="number" min="1" value={item.quantity} onChange={(e) => setExactCartQty(item.id, parseInt(e.target.value) || 1)} style={{ width: '48px', height: '28px', textAlign: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0 4px', fontSize: '14px', fontWeight: 500 }} />
                  <button onClick={() => updateCartQty(item.id, 1)} style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={12} /></button>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>x {item.unitPrice.toLocaleString()} FCFA</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: 'auto' }}>{item.total.toLocaleString()} FCFA</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select style={{ ...inputStyle, width: 'auto', fontSize: '12px', padding: '4px 8px' }} value={item.discountType} onChange={e => updateCartDiscountType(item.id, e.target.value as any)}>
                    <option value="none">Sans remise</option>
                    <option value="percent">% remise</option>
                    <option value="amount">Remise montant</option>
                  </select>
                  {item.discountType === 'percent' && <input style={{ ...inputStyle, width: '60px', fontSize: '12px', padding: '4px 8px' }} type="number" min="0" max="100" placeholder="%" value={item.discountPercent} onChange={e => updateCartDiscount(item.id, 'percent', Number(e.target.value))} />}
                  {item.discountType === 'amount' && <input style={{ ...inputStyle, width: '90px', fontSize: '12px', padding: '4px 8px' }} type="number" min="0" placeholder="FCFA" value={item.discountAmount} onChange={e => updateCartDiscount(item.id, 'amount', Number(e.target.value))} />}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}><span>Sous-total</span><span>{subtotal.toLocaleString()} FCFA</span></div>
          {cartDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--color-success)' }}><span>Remises articles</span><span>-{cartDiscount.toLocaleString()} FCFA</span></div>}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <select style={{ ...inputStyle, width: 'auto', fontSize: '13px' }} value={discountType} onChange={e => setDiscountType(e.target.value as any)}>
              <option value="none">Pas de remise globale</option>
              <option value="percent">Remise %</option>
              <option value="amount">Remise montant</option>
            </select>
            {discountType !== 'none' && <input style={{ ...inputStyle, width: '80px', fontSize: '13px' }} type="number" min="0" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} />}
          </div>
          {globalDiscount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--color-success)' }}><span>Remise globale</span><span>-{globalDiscount.toLocaleString()} FCFA</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 700, paddingTop: '8px', borderTop: '2px solid var(--color-border)' }}><span>Total</span><span>{total.toLocaleString()} FCFA</span></div>
        </div>

        {/* Payment button */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!openSession ? (
            <Button variant="warning" size="block" onClick={() => setShowOpenModal(true)}>Ouvrir la caisse</Button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" style={{ flex: 1, border: '1px solid var(--color-border)', background: 'white' }} disabled={cart.length === 0} onClick={() => setShowSuspendModal(true)}>En attente</Button>
              <Button variant="primary" style={{ flex: 2 }} disabled={cart.length === 0} onClick={() => setShowPayment(true)}>Payer</Button>
            </div>
          )}
        </div>
      </div>

      {/* Payment modal */}
      <Modal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        title="Paiement"
        width={400}
        footer={
          <>
            <Button variant="success" onClick={handlePayment}>Valider</Button>
            <Button variant="ghost" onClick={() => setShowPayment(false)}>Annuler</Button>
          </>
        }
      >
        <div style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '24px', color: 'var(--color-primary)' }}>{total.toLocaleString()} FCFA</div>
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', marginBottom: '4px', fontWeight: 500 }}>Mode de paiement</div>
          <select style={inputStyle} value={paymentMethod} onChange={e => { setPaymentMethod(e.target.value as any); setCashAmount(''); setMobileAmount(''); }}>
            <option value="Espèces">Espèces</option>
            <option value="Mobile Money">Mobile Money</option>
            <option value="Mixte">Mixte (Espèces + Mobile Money)</option>
          </select>
        </div>

        {(paymentMethod === 'Espèces' || paymentMethod === 'Mixte') && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', marginBottom: '4px', fontWeight: 500 }}>Montant reçu (Espèces)</div>
            <input 
              style={inputStyle} 
              type="text" 
              inputMode="numeric"
              placeholder="0"
              value={cashAmount} 
              onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ''); setCashAmount(val ? Number(val) : ''); }} 
              autoFocus
            />
          </div>
        )}

        {(paymentMethod === 'Mobile Money' || paymentMethod === 'Mixte') && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', marginBottom: '4px', fontWeight: 500 }}>Montant reçu (Mobile Money)</div>
            <input 
              style={inputStyle} 
              type="text" 
              inputMode="numeric"
              placeholder="0"
              value={mobileAmount} 
              onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ''); setMobileAmount(val ? Number(val) : ''); }} 
              autoFocus={paymentMethod === 'Mobile Money'}
            />
          </div>
        )}

        {(() => {
          const change = Math.max(0, ((Number(cashAmount) || 0) + (paymentMethod === 'Mixte' || paymentMethod === 'Mobile Money' ? (Number(mobileAmount) || 0) : 0)) - total);
          return (
            <div style={{ 
              marginTop: '24px', 
              padding: '16px', 
              borderRadius: 'var(--radius-md)', 
              background: change > 0 ? '#f0fdf4' : 'var(--color-surface-alt)', 
              border: change > 0 ? '1px solid #bbf7d0' : '1px solid var(--color-border)',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: change > 0 ? '#166534' : 'var(--color-text-muted)' }}>
                Monnaie à rendre :
              </span>
              <span style={{ fontSize: '24px', fontWeight: 800, color: change > 0 ? '#15803d' : 'var(--color-text-muted)' }}>
                {change.toLocaleString()} FCFA
              </span>
            </div>
          );
        })()}
      </Modal>

      {/* Open Cash Modal */}
      <Modal
        open={showOpenModal}
        onClose={() => { setShowOpenModal(false); setInitialFund(''); }}
        title="Ouvrir la caisse"
        width={400}
        footer={
          <>
            <Button 
              variant="success" 
              onClick={async () => {
                const fund = Number(initialFund);
                if (!isNaN(fund)) {
                  await addPosCashSession({ id: uuidv4(), cashierId: currentUser?.id, openedAt: new Date().toISOString(), initialFund: fund, status: 'Ouverte' });
                  setShowOpenModal(false);
                  setInitialFund('');
                }
              }}
            >Ouvrir</Button>
            <Button variant="ghost" onClick={() => { setShowOpenModal(false); setInitialFund(''); }}>Annuler</Button>
          </>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', marginBottom: '4px', display: 'block', fontWeight: 500 }}>Fonds de caisse initial (FCFA)</label>
          <input 
            type="text" 
            inputMode="numeric"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }} 
            value={initialFund} 
            onChange={e => setInitialFund(e.target.value.replace(/\D/g, ''))}
            onKeyDown={async e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const fund = Number(initialFund);
                if (!isNaN(fund)) {
                  await addPosCashSession({ id: uuidv4(), cashierId: currentUser?.id, openedAt: new Date().toISOString(), initialFund: fund, status: 'Ouverte' });
                  setShowOpenModal(false);
                  setInitialFund('');
                }
              }
            }}
            autoFocus 
          />
        </div>
      </Modal>

      {/* Suspend Modal */}
      <Modal
        open={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        title="Mettre le ticket en attente"
        width={400}
        footer={
          <>
            <Button variant="primary" onClick={handleSuspendCart}>Sauvegarder</Button>
            <Button variant="ghost" onClick={() => setShowSuspendModal(false)}>Annuler</Button>
          </>
        }
      >
        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '13px', marginBottom: '4px', display: 'block', fontWeight: 500 }}>Libellé (optionnel)</label>
          <input 
            type="text" 
            placeholder="Ex: Client pull rouge"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }} 
            value={suspendReference} 
            onChange={e => setSuspendReference(e.target.value)} 
            autoFocus 
          />
        </div>
      </Modal>

      {/* Suspended List Modal */}
      <Modal
        open={showSuspendedList}
        onClose={() => setShowSuspendedList(false)}
        title="Tickets en attente"
        width={600}
      >
        {(!suspendedCarts || suspendedCarts.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>Aucun ticket en attente.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {suspendedCarts.map(sCart => {
              const totalAmount = sCart.cart.reduce((sum, item) => sum + item.total, 0);
              const itemsCount = sCart.cart.reduce((sum, item) => sum + item.quantity, 0);
              return (
                <div key={sCart.id} style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{sCart.reference}</div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                      {new Date(sCart.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} &bull; {itemsCount} article(s) &bull; <strong style={{ color: 'var(--color-text)' }}>{totalAmount.toLocaleString()} FCFA</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="danger" size="sm" onClick={() => removeSuspendedCart(sCart.id)}>Supprimer</Button>
                    <Button variant="success" size="sm" onClick={() => handleResumeCart(sCart)}>Reprendre</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
      {/* Preview Modal (Mode Test) */}
      <Modal
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Prévisualisation du ticket (Mode Test)"
        width={400}
        footer={
          <>
            <Button variant="primary" onClick={async () => { 
              if (platform.isDesktop) {
                try {
                  await platform.pos.printReceipt({
                    ...receiptData,
                    settings: posSettings
                  });
                } catch (e: any) {
                  toast.error("Erreur d'impression: " + (e.message || e));
                }
              } else {
                setTimeout(() => { window.print(); }, 100); 
              }
              setShowPreviewModal(false); 
            }}>Imprimer</Button>
            <Button variant="ghost" onClick={() => setShowPreviewModal(false)}>Fermer</Button>
          </>
        }
      >
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '16px', background: '#f5f5f5', maxHeight: '60vh', overflowY: 'auto' }}>
          <ReceiptTicket data={receiptData} settings={posSettings} crmSettings={crmSettings} preview={true} />
        </div>
      </Modal>
      </div>
    </>
  );
}
