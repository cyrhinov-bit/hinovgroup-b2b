import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Save, FileText, Trash2, Percent, ArrowLeft, TrendingUp, 
  Calendar, ShieldCheck, CreditCard, Clock, FileCheck2, UserCheck
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { QuoteLine } from '../context/AppContext';
import { generateQuotePdf } from '../lib/pdfUtils';
import './QuoteCreation.css';

const COMMON_UNITS = [
  'Forfait',
  'Heure',
  'Jour',
  'Mois',
  'Session',
  'Unité',
  'Lot',
  'Page',
  'Projet',
  'Prestation'
];

const COMMON_PAYMENT_TERMS = [
  '50% à la commande, solde à la livraison',
  '30% à la commande, 70% à la livraison',
  '100% à la commande',
  'Comptant à réception de facture',
  'Paiement à 30 jours',
  'Paiement à 30 jours fin de mois',
  'Paiement en 3 échéances mensuelles'
];

export function QuoteCreation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');
  const affaireIdParam = searchParams.get('affaireId');
  const clientIdParam = searchParams.get('clientId');
  const serviceIdParam = searchParams.get('serviceId');
  const { clients, prestations, addQuote, updateQuote, services, quotes, settings, affaires, users } = useAppContext();
  const { currentUser } = useAuth();

  // Sequential quote number generator
  const nextSequentialNumber = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const prefix = `DV-${currentYear}-`;
    const yearQuotes = quotes.filter(q => q.quoteNumber && q.quoteNumber.startsWith(prefix));
    let maxSeq = 0;
    yearQuotes.forEach(q => {
      const parts = q.quoteNumber.split('-');
      if (parts.length >= 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    });
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
  }, [quotes]);

  // Load draft from localStorage if present
  const draftKey = 'quoteCreationDraft';
  const loadDraft = () => {
    try {
      const data = localStorage.getItem(draftKey);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  };

  const sourceQuote = editId ? quotes.find(q => q.id === editId) : null;

  // Form states
  const [clientId, setClientId] = useState(sourceQuote?.clientId || clientIdParam || '');
  const [affaireId, setAffaireId] = useState(sourceQuote?.affaireId || affaireIdParam || '');
  const [subject, setSubject] = useState(sourceQuote?.subject || '');
  const [serviceId, setServiceId] = useState(sourceQuote?.serviceId || serviceIdParam || (currentUser?.role === 'Responsable' ? (currentUser?.serviceId || '') : ''));
  const [style, setStyle] = useState<'Classique' | 'Moderne' | 'Minimaliste'>(sourceQuote?.style as any || 'Classique');
  const [accentColor, setAccentColor] = useState(sourceQuote?.accentColor || '#009688');
  const [discountPercent, setDiscountPercent] = useState<number>(sourceQuote?.discountPercent || 0);

  // Date and Validity
  const todayStr = new Date().toISOString().split('T')[0];
  const [quoteDate, setQuoteDate] = useState(sourceQuote?.date || todayStr);
  const [validityDays, setValidityDays] = useState<number>(settings.defaultValidity || 30);
  
  // Calculate validUntil based on quoteDate + validityDays
  const computeValidUntil = (baseDate: string, days: number) => {
    const d = new Date(baseDate || todayStr);
    d.setDate(d.getDate() + (Number(days) || 30));
    return d.toISOString().split('T')[0];
  };

  const [validUntil, setValidUntil] = useState(sourceQuote?.validUntil || computeValidUntil(sourceQuote?.date || todayStr, settings.defaultValidity || 30));

  // Payment terms, Notes, Signatory
  const [paymentTerms, setPaymentTerms] = useState(sourceQuote?.paymentTerms || '50% à la commande, solde à la livraison');
  const [notes, setNotes] = useState(sourceQuote?.notes || '');
  const [signatoryName, setSignatoryName] = useState(sourceQuote?.signatoryName || currentUser?.name || '');
  const [signatoryRole, setSignatoryRole] = useState(sourceQuote?.signatoryRole || currentUser?.role || 'Directeur Général');

  // Lines
  const [lines, setLines] = useState<Omit<QuoteLine, 'id'>[]>(
    sourceQuote?.lines.map(l => ({
      prestationId: l.prestationId,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit || 'Forfait',
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent || 0,
      total: l.total
    })) || []
  );

  // costPrice per line — UI only, never persisted into PDF
  const [lineCosts, setLineCosts] = useState<number[]>(
    sourceQuote?.lines.map(l => {
      const prestation = prestations.find(p => p.id === l.prestationId);
      return prestation?.costPrice || 0;
    }) || []
  );

  // Draft state persistence
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    if (!draftLoaded && !editId) {
      const draft = loadDraft();
      if (draft) {
        setClientId(draft.clientId || '');
        setAffaireId(draft.affaireId || '');
        setSubject(draft.subject || '');
        setServiceId(draft.serviceId || '');
        setStyle(draft.style || 'Classique');
        setAccentColor(draft.accentColor || '#009688');
        setDiscountPercent(draft.discountPercent ?? 0);
        setQuoteDate(draft.quoteDate || todayStr);
        setValidityDays(draft.validityDays || 30);
        setValidUntil(draft.validUntil || computeValidUntil(draft.quoteDate || todayStr, draft.validityDays || 30));
        setPaymentTerms(draft.paymentTerms || '50% à la commande, solde à la livraison');
        setNotes(draft.notes || '');
        setSignatoryName(draft.signatoryName || currentUser?.name || '');
        setSignatoryRole(draft.signatoryRole || currentUser?.role || 'Directeur Général');
        setLines(draft.lines || []);
        setLineCosts(draft.lineCosts || []);
      }
      setDraftLoaded(true);
    }
  }, [draftLoaded]);

  // Save draft on any change
  useEffect(() => {
    if (draftLoaded) {
      const draft = {
        clientId,
        affaireId,
        subject,
        serviceId,
        style,
        accentColor,
        discountPercent,
        quoteDate,
        validityDays,
        validUntil,
        paymentTerms,
        notes,
        signatoryName,
        signatoryRole,
        lines,
        lineCosts
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {}
    }
  }, [clientId, affaireId, subject, serviceId, style, accentColor, discountPercent, quoteDate, validityDays, validUntil, paymentTerms, notes, signatoryName, signatoryRole, lines, lineCosts, draftLoaded]);

  const handleValidityPreset = (days: number) => {
    setValidityDays(days);
    setValidUntil(computeValidUntil(quoteDate, days));
  };

  const handleAddLine = () => {
    setLines([...lines, { 
      prestationId: '', 
      description: '', 
      quantity: 1, 
      unit: 'Forfait', 
      unitPrice: '' as any, 
      discountPercent: 0, 
      total: 0 
    }]);
    setLineCosts([...lineCosts, 0]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tr = e.currentTarget.closest('tr');
      if (!tr) return;
      const inputs = Array.from(tr.querySelectorAll('input, select'));
      const index = inputs.indexOf(e.currentTarget);
      if (index > -1 && index < inputs.length - 1) {
        (inputs[index + 1] as HTMLElement).focus();
      }
    }
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
    setLineCosts(lineCosts.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof QuoteLine, value: any) => {
    const newLines = [...lines];
    const line = { ...newLines[index] };
    
    // @ts-ignore
    line[field] = value;

    if (field === 'prestationId') {
      const prestation = availablePrestations.find(p => p.id === value);
      if (prestation) {
        line.description = prestation.name;
        line.unitPrice = prestation.price;
        if (prestation.unit) {
          line.unit = prestation.unit;
        }
        // Auto-fill cost price from catalogue (UI-only)
        const newCosts = [...lineCosts];
        newCosts[index] = prestation.costPrice || 0;
        setLineCosts(newCosts);
      }
    }

    const q = Number(line.quantity) || 0;
    const p = Number(line.unitPrice) || 0;
    const rawTotal = q * p;
    const lineDiscount = Math.round((rawTotal * (line.discountPercent || 0)) / 100);
    line.total = Math.max(0, rawTotal - lineDiscount);
    newLines[index] = line;
    setLines(newLines);
  };

  const availablePrestations = (currentUser?.role === 'Directeur' || currentUser?.role === 'SuperAdmin')
    ? (serviceId ? prestations.filter(p => p.serviceId === serviceId) : prestations)
    : (currentUser?.serviceId ? prestations.filter(p => p.serviceId === currentUser.serviceId) : prestations);

  // Calculations
  const grossSubtotal = lines.reduce((acc, line) => acc + line.total, 0);
  const discountAmount = Math.round((grossSubtotal * (discountPercent || 0)) / 100);
  const netSubtotal = Math.max(0, grossSubtotal - discountAmount);
  const total = netSubtotal;

  // Margin calculations (UI-only, never in PDF)
  const totalCost = lines.reduce((acc, line, idx) => acc + (lineCosts[idx] || 0) * (Number(line.quantity) || 0), 0);
  const globalMargin = total - totalCost;
  const getMarginColor = (margin: number) => margin >= 0 ? 'var(--color-success)' : 'var(--color-error)';

  const handleSave = async (status: 'Brouillon' | 'Envoyé', preview: boolean = false) => {
    if (!clientId) {
      alert("Veuillez sélectionner un client");
      return;
    }

    if (currentUser?.role === 'Directeur' && !serviceId) {
      alert("Veuillez sélectionner un service");
      return;
    }

    if (lines.length === 0) {
      alert("Veuillez ajouter au moins une ligne de prestation au devis.");
      return;
    }

    const newId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const quoteNumber = sourceQuote?.quoteNumber || nextSequentialNumber;

    const quoteData = {
      id: sourceQuote?.id || newId,
      quoteNumber,
      clientId,
      commercialId: currentUser?.id || '',
      serviceId: currentUser?.role === 'Directeur' ? serviceId : (currentUser?.serviceId || ''),
      affaireId: affaireId || undefined,
      subject,
      lines: lines.map((l) => ({ ...l, id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() })),
      subtotal: netSubtotal,
      discountPercent: discountPercent || 0,
      discountAmount,
      total,
      status: sourceQuote ? sourceQuote.status : status,
      date: quoteDate || todayStr,
      validUntil: validUntil || undefined,
      paymentTerms: paymentTerms || undefined,
      notes: notes || undefined,
      signatoryName: signatoryName || undefined,
      signatoryRole: signatoryRole || undefined,
      style,
      accentColor
    };

    try {
      if (sourceQuote) {
        await updateQuote(sourceQuote.id, quoteData);
      } else {
        await addQuote(quoteData);
      }

      if (preview) {
        const client = clients.find(c => c.id === clientId);
        const pdfBlob = generateQuotePdf(quoteData, client, settings);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, '_blank');
      }
      localStorage.removeItem(draftKey);
      navigate('/devis');
    } catch (err) {
      console.error('Erreur lors de la sauvegarde du devis:', err);
      alert('Une erreur est survenue lors de la sauvegarde du devis.');
    }
  };

  const clientAffaires = affaires.filter(a => a.clientId === clientId);

  return (
    <div className="quote-creation">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Retour">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 style={{ margin: 0 }}>{sourceQuote ? `Modifier le devis ${sourceQuote.quoteNumber}` : 'Créer un nouveau devis'}</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                N° de référence prévu : <strong style={{ color: 'var(--color-primary)' }}>{sourceQuote?.quoteNumber || nextSequentialNumber}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card form-card">
        {/* 1. INFORMATIONS GÉNÉRALES */}
        <section className="form-section">
          <h3>
            <FileText size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Informations Générales
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Client *</label>
              <select className="form-control" value={clientId} onChange={e => {
                setClientId(e.target.value);
                setAffaireId('');
              }}>
                <option value="">Sélectionner un client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.contact}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Affaire rattachée (Optionnel)</label>
              <select 
                className="form-control" 
                value={affaireId} 
                onChange={e => setAffaireId(e.target.value)}
                disabled={!clientId}
              >
                <option value="">-- Aucune affaire rattachée --</option>
                {clientAffaires.map(a => (
                  <option key={a.id} value={a.id}>{a.reference} - {a.title}</option>
                ))}
              </select>
            </div>

            {currentUser?.role === 'Directeur' && (
              <div className="form-group">
                <label>Service concerné *</label>
                <select className="form-control" value={serviceId} onChange={e => setServiceId(e.target.value)}>
                  <option value="">Sélectionner un service...</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Objet / Titre du devis</label>
              <input type="text" className="form-control" placeholder="Ex: Prestation d'assistance comptable annuelle" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
          </div>
        </section>

        {/* 2. DATES & VALIDITÉ DU DEVIS */}
        <section className="form-section">
          <h3>
            <Calendar size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Dates & Validité de l'Offre
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Date d'émission</label>
              <input 
                type="date" 
                className="form-control" 
                value={quoteDate} 
                onChange={e => {
                  setQuoteDate(e.target.value);
                  setValidUntil(computeValidUntil(e.target.value, validityDays));
                }} 
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Date d'échéance / Fin de validité</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[15, 30, 60, 90].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => handleValidityPreset(days)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.72rem',
                        borderRadius: '4px',
                        border: '1px solid var(--color-border)',
                        background: validityDays === days ? 'var(--color-primary-tint)' : 'transparent',
                        color: validityDays === days ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        cursor: 'pointer'
                      }}
                    >
                      {days}j
                    </button>
                  ))}
                </div>
              </label>
              <input 
                type="date" 
                className="form-control" 
                value={validUntil} 
                onChange={e => setValidUntil(e.target.value)} 
              />
            </div>
          </div>
        </section>

        {/* 3. TABLEAU DES PRESTATIONS & LIGNES */}
        <section className="form-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>
              <FileCheck2 size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
              Prestations & Services
            </h3>
            <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Navigation clavier : <strong>Entrée</strong> passe à la cellule suivante
            </span>
          </div>

          <div className="table-responsive">
            <table className="prestations-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '180px' }}>Service (Catalogue)</th>
                  <th style={{ minWidth: '200px' }}>Description détaillée</th>
                  <th style={{ width: '80px' }}>Qté</th>
                  <th style={{ width: '110px' }}>Unité</th>
                  <th style={{ width: '120px' }}>Prix Unit. (FCFA)</th>
                  <th style={{ width: '90px' }}>Remise (%)</th>
                  <th style={{ width: '130px' }}>Total Net</th>
                  <th style={{ width: '130px', background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))' }} title="Colonne interne — masquée sur le PDF client">Marge 🔒</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const costPrice = lineCosts[idx] || 0;
                  const lineCostTotal = costPrice * (Number(line.quantity) || 0);
                  const lineMargin = line.total - lineCostTotal;
                  return (
                    <tr key={idx}>
                      <td>
                        <select className="table-input" value={line.prestationId} onChange={e => updateLine(idx, 'prestationId', e.target.value)} onKeyDown={handleKeyDown}>
                          <option value="">{availablePrestations.length === 0 ? 'Choisir...' : 'Catalogue...'}</option>
                          {availablePrestations.map(p => <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="text" className="table-input" placeholder="Détails de la prestation" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} onKeyDown={handleKeyDown} />
                      </td>
                      <td>
                        <input type="number" className="table-input" value={line.quantity} min="1" onChange={e => updateLine(idx, 'quantity', e.target.value === '' ? '' : Number(e.target.value))} onKeyDown={handleKeyDown} />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          list={`units-list-${idx}`} 
                          className="table-input" 
                          value={line.unit || ''} 
                          placeholder="Forfait"
                          onChange={e => updateLine(idx, 'unit', e.target.value)} 
                          onKeyDown={handleKeyDown} 
                        />
                        <datalist id={`units-list-${idx}`}>
                          {COMMON_UNITS.map(u => <option key={u} value={u} />)}
                        </datalist>
                      </td>
                      <td>
                        <input type="number" className="table-input" value={line.unitPrice} step="1" onChange={e => updateLine(idx, 'unitPrice', e.target.value === '' ? '' : Number(e.target.value))} onKeyDown={handleKeyDown} />
                      </td>
                      <td>
                        <input type="number" className="table-input" value={line.discountPercent || ''} min="0" max="100" placeholder="0%" onChange={e => updateLine(idx, 'discountPercent', Math.min(100, Math.max(0, Number(e.target.value))))} onKeyDown={handleKeyDown} />
                      </td>
                      <td>
                        <strong>{line.total.toLocaleString('fr-FR')} FCFA</strong>
                        {line.discountPercent && line.discountPercent > 0 ? (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)' }}>(-{line.discountPercent}%)</div>
                        ) : null}
                      </td>
                      <td style={{ background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))', verticalAlign: 'top', paddingTop: '8px' }}>
                        <input
                          type="number"
                          className="table-input"
                          placeholder="Coût unitaire"
                          min="0"
                          step="1"
                          value={lineCosts[idx] || ''}
                          onChange={e => {
                            const newCosts = [...lineCosts];
                            newCosts[idx] = Math.max(0, Number(e.target.value));
                            setLineCosts(newCosts);
                          }}
                          onKeyDown={handleKeyDown}
                          style={{ marginBottom: '4px', fontSize: '0.82rem' }}
                          title="Coût de revient unitaire (usage interne pour calcul de marge)"
                        />
                        {costPrice > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.80rem', color: getMarginColor(lineMargin) }}>
                              {lineMargin >= 0 ? '+' : ''}{lineMargin.toLocaleString('fr-FR')} FCFA
                            </span>
                          </div>
                        )}
                      </td>

                      <td>
                        <button className="icon-button text-error" onClick={() => handleRemoveLine(idx)} title="Supprimer la ligne"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>
                      Aucune prestation ajoutée. Cliquez sur le bouton ci-dessous pour ajouter une ligne.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={handleAddLine}>
            <Plus size={16} style={{ marginRight: '8px' }} /> Ajouter une ligne de prestation
          </button>

          {/* Margin summary — UI only, never in the PDF */}
          {totalCost > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))',
              border: `1px solid color-mix(in srgb, ${getMarginColor(globalMargin)} 30%, transparent)`,
              display: 'flex', flexDirection: 'column', gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: '2px' }}>
                <TrendingUp size={14} />
                Analyse de rentabilité prévisionnelle (usage interne — non visible sur le devis client)
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Montant de vente total (TTC/Net)</span>
                <span style={{ fontWeight: 600 }}>{total.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Coût de revient global</span>
                <span style={{ fontWeight: 600 }}>{totalCost.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderTop: '1px solid var(--color-border)', paddingTop: '6px', marginTop: '2px' }}>
                <span style={{ fontWeight: 600 }}>Marge brute prévisionnelle</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: getMarginColor(globalMargin) }}>
                  {globalMargin >= 0 ? '+' : ''}{globalMargin.toLocaleString('fr-FR')} FCFA
                  {total > 0 && ` (${Math.round((globalMargin / total) * 100)}%)`}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* 4. REMISE GLOBALE */}
        <section className="form-section">
          <h3>
            <Percent size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Remise Commerciale Globale
          </h3>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <div className="form-group">
              <label>Réduction globale (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="form-control"
                placeholder="Ex: 5"
                value={discountPercent || ''}
                onChange={e => {
                  const val = Math.min(100, Math.max(0, Number(e.target.value)));
                  setDiscountPercent(val);
                }}
              />
            </div>
            {discountPercent > 0 && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-secondary)', fontWeight: 500 }}>
                  Montant de la remise accordée : <strong>-{discountAmount.toLocaleString('fr-FR')} FCFA</strong> ({discountPercent}%)
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 5. MODALITÉS DE PAIEMENT & CONDITIONS PARTICULIÈRES */}
        <section className="form-section">
          <h3>
            <CreditCard size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Modalités de Règlement & Conditions Particulières
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Conditions de règlement</label>
              <input 
                type="text" 
                list="payment-terms-list" 
                className="form-control" 
                value={paymentTerms} 
                placeholder="Ex: 50% à la commande, solde à la livraison"
                onChange={e => setPaymentTerms(e.target.value)} 
              />
              <datalist id="payment-terms-list">
                {COMMON_PAYMENT_TERMS.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>

            <div className="form-group">
              <label>Notes ou clauses particulières (visibles sur le devis)</label>
              <textarea 
                className="form-control" 
                rows={2} 
                placeholder="Ex: Frais de déplacement inclus. Délai d'exécution : 15 jours ouvrés dès validation."
                value={notes} 
                onChange={e => setNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        </section>

        {/* 6. SIGNATAIRE & DESIGN */}
        <section className="form-section">
          <h3>
            <UserCheck size={18} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} />
            Signataire & Paramètres de Design
          </h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Nom du signataire responsable</label>
              <input 
                type="text" 
                list="signatories-list"
                className="form-control" 
                placeholder="Ex: M. GNONSKAN EVARISTE" 
                value={signatoryName} 
                onChange={e => setSignatoryName(e.target.value)} 
              />
              <datalist id="signatories-list">
                {users.map(u => <option key={u.id} value={u.name} />)}
              </datalist>
            </div>

            <div className="form-group">
              <label>Fonction / Rôle du signataire</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Ex: Directeur Général" 
                value={signatoryRole} 
                onChange={e => setSignatoryRole(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Style visuel (PDF / Portail)</label>
              <select className="form-control" value={style} onChange={e => setStyle(e.target.value as any)}>
                <option value="Classique">Classique (Standard)</option>
                <option value="Moderne">Moderne (Épuré et coloré)</option>
                <option value="Minimaliste">Minimaliste (Noir & Blanc)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Couleur principale</label>
              <input type="color" className="form-control" style={{ height: '42px', cursor: 'pointer' }} value={accentColor} onChange={e => setAccentColor(e.target.value)} />
            </div>
          </div>
        </section>

        {/* 7. TOTAUX */}
        <div className="totals-section">
          <div className="total-row">
            <span>Montant Brut</span>
            <span>{grossSubtotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
          {discountPercent > 0 && (
            <div className="total-row" style={{ color: 'var(--color-secondary)' }}>
              <span>Remise ({discountPercent}%)</span>
              <span>-{discountAmount.toLocaleString('fr-FR')} FCFA</span>
            </div>
          )}
          <div className="total-row grand-total">
            <span>Total Net</span>
            <span>{total.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>

        {/* 8. ACTIONS */}
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => {
            if (confirm("Réinitialiser tous les champs du devis ?")) {
              setClientId('');
              setAffaireId('');
              setSubject('');
              setServiceId('');
              setStyle('Classique');
              setAccentColor('#009688');
              setDiscountPercent(0);
              setQuoteDate(todayStr);
              setValidityDays(30);
              setValidUntil(computeValidUntil(todayStr, 30));
              setPaymentTerms('50% à la commande, solde à la livraison');
              setNotes('');
              setSignatoryName(currentUser?.name || '');
              setSignatoryRole(currentUser?.role || 'Directeur Général');
              setLines([]);
              setLineCosts([]);
              localStorage.removeItem(draftKey);
            }
          }} style={{ marginRight: '8px' }}>
            <Trash2 size={16} style={{ marginRight: '4px' }} /> Réinitialiser
          </button>
          <button className="btn btn-secondary" onClick={() => handleSave('Brouillon')}>
            <Save size={16} style={{ marginRight: '8px' }} /> Sauvegarder (Brouillon)
          </button>
          <button className="btn btn-primary" onClick={() => handleSave('Brouillon', true)} style={{ marginLeft: '8px' }}>
            <FileText size={16} style={{ marginRight: '8px' }} /> Générer & Prévisualiser le PDF
          </button>
        </div>
      </div>
    </div>
  );
}
