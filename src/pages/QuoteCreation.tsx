import { useState, useEffect } from 'react';
import { Plus, Save, FileText, Trash2, Percent, ArrowLeft, TrendingUp } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { QuoteLine } from '../context/AppContext';
import { generateQuotePdf } from '../lib/pdfUtils';
import './QuoteCreation.css';

export function QuoteCreation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');
  const { clients, prestations, addQuote, updateQuote, services, quotes, settings } = useAppContext();
  const { currentUser } = useAuth();

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

  const [clientId, setClientId] = useState(sourceQuote?.clientId || '');
  const [subject, setSubject] = useState(sourceQuote?.subject || '');
  const [serviceId, setServiceId] = useState(sourceQuote?.serviceId || (currentUser?.role === 'Responsable' ? (currentUser?.serviceId || '') : ''));
  const [style, setStyle] = useState<'Classique' | 'Moderne' | 'Minimaliste'>(sourceQuote?.style as any || 'Classique');
  const [accentColor, setAccentColor] = useState(sourceQuote?.accentColor || '#009688');
  const [discountPercent, setDiscountPercent] = useState<number>(sourceQuote?.discountPercent || 0);
  const [lines, setLines] = useState<Omit<QuoteLine, 'id'>[]>(
    sourceQuote?.lines.map(l => ({
      prestationId: l.prestationId,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPercent: l.discountPercent || 0,
      total: l.total
    })) || []
  );

  // costPrice per line — UI only, never persisted into Quote or PDF
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
        setSubject(draft.subject || '');
        setServiceId(draft.serviceId || '');
        setStyle(draft.style || 'Classique');
        setAccentColor(draft.accentColor || '#009688');
        setDiscountPercent(draft.discountPercent ?? 0);
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
        subject,
        serviceId,
        style,
        accentColor,
        discountPercent,
        lines,
        lineCosts
      };
      try {
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {}
    }
  }, [clientId, subject, serviceId, style, accentColor, discountPercent, lines, lineCosts, draftLoaded]);

  const handleAddLine = () => {
    setLines([...lines, { prestationId: '', description: '', quantity: 1, unitPrice: 0, discountPercent: 0, total: 0 }]);
    setLineCosts([...lineCosts, 0]);
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
        // Auto-fill cost price from catalogue (UI-only)
        const newCosts = [...lineCosts];
        newCosts[index] = prestation.costPrice || 0;
        setLineCosts(newCosts);
      }
    }

    const rawTotal = line.quantity * line.unitPrice;
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
  const totalCost = lines.reduce((acc, line, idx) => acc + (lineCosts[idx] || 0) * line.quantity, 0);
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

    const newId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const now = new Date();
    const seq = (now.getTime() % 10000).toString().padStart(4, '0');
    const quoteData = {
      id: sourceQuote?.id || newId,
      quoteNumber: sourceQuote?.quoteNumber || `DV-${now.getFullYear()}-${seq}`,
      clientId,
      commercialId: currentUser?.id || '',
      serviceId: currentUser?.role === 'Directeur' ? serviceId : (currentUser?.serviceId || ''),
      subject,
      lines: lines.map((l) => ({ ...l, id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() })),
      subtotal: netSubtotal,
      discountPercent: discountPercent || 0,
      discountAmount,
      total,
      status: sourceQuote ? sourceQuote.status : status,
      date: sourceQuote?.date || now.toISOString().split('T')[0],
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

  return (
    <div className="quote-creation">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-outline" onClick={() => navigate(-1)} style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Retour">
            <ArrowLeft size={18} />
          </button>
          <h2>{sourceQuote ? `Modifier le devis ${sourceQuote.quoteNumber}` : 'Créer un nouveau devis'}</h2>
        </div>
      </div>

      <div className="card form-card">
        <section className="form-section">
          <h3>Informations Générales</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Client *</label>
              <select className="form-control" value={clientId} onChange={e => setClientId(e.target.value)}>
                <option value="">Sélectionner un client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.contact}</option>)}
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
              <label>Objet du devis</label>
              <input type="text" className="form-control" placeholder="Ex: Refonte site web" value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
          </div>
        </section>

        <section className="form-section">
          <h3>Prestations</h3>
          <div className="table-responsive">
            <table className="prestations-table">
              <thead>
                <tr>
                  <th>Service (Catalogue)</th>
                  <th>Description</th>
                  <th style={{ width: '90px' }}>Qté</th>
                  <th style={{ width: '130px' }}>Prix Unitaire</th>
                  <th style={{ width: '100px' }}>Remise (%)</th>
                  <th style={{ width: '140px' }}>Total Net</th>
                  <th style={{ width: '130px', background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))' }} title="Colonne interne — non visible sur le devis PDF">Marge 🔒</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => {
                  const costPrice = lineCosts[idx] || 0;
                  const lineCostTotal = costPrice * line.quantity;
                  const lineMargin = line.total - lineCostTotal;
                  return (
                    <tr key={idx}>
                      <td>
                        <select className="table-input" value={line.prestationId} onChange={e => updateLine(idx, 'prestationId', e.target.value)}>
                          <option value="">{availablePrestations.length === 0 ? 'Aucune prestation disponible...' : 'Choisir...'}</option>
                          {availablePrestations.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="text" className="table-input" value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" className="table-input" value={line.quantity} min="1" onChange={e => updateLine(idx, 'quantity', Number(e.target.value))} />
                      </td>
                      <td>
                        <input type="number" className="table-input" value={line.unitPrice} step="0.01" onChange={e => updateLine(idx, 'unitPrice', Number(e.target.value))} />
                      </td>
                      <td>
                        <input type="number" className="table-input" value={line.discountPercent || ''} min="0" max="100" placeholder="0%" onChange={e => updateLine(idx, 'discountPercent', Math.min(100, Math.max(0, Number(e.target.value))))} />
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
                          placeholder="Prix d'achat unit."
                          min="0"
                          step="0.01"
                          value={lineCosts[idx] || ''}
                          onChange={e => {
                            const newCosts = [...lineCosts];
                            newCosts[idx] = Math.max(0, Number(e.target.value));
                            setLineCosts(newCosts);
                          }}
                          style={{ marginBottom: '4px', fontSize: '0.82rem' }}
                          title="Prix d'achat unitaire (usage interne uniquement)"
                        />
                        {costPrice > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.82rem', color: getMarginColor(lineMargin) }}>
                              Marge : {lineMargin >= 0 ? '+' : ''}{lineMargin.toLocaleString('fr-FR')} FCFA
                            </span>
                          </div>
                        )}
                      </td>

                      <td>
                        <button className="icon-button text-error" onClick={() => handleRemoveLine(idx)}><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)' }}>Aucune ligne. Cliquez sur "Ajouter une ligne" pour commencer.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={handleAddLine}>
            <Plus size={16} style={{ marginRight: '8px' }} /> Ajouter une ligne
          </button>
          {availablePrestations.length === 0 && (
            <p style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              💡 Aucune prestation dans le catalogue. Vous pouvez saisir manuellement la description et le prix, ou ajouter des prestations dans la page « Prestations ».
            </p>
          )}
        </section>

            

        <section className="form-section">
          <h3>Remise & Réduction</h3>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Percent size={16} color="var(--color-primary)" /> Réduction (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                className="form-control"
                placeholder="Ex: 10"
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

        <section className="form-section">
          <h3>Paramètres de design</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Style du devis (Portail Client)</label>
              <select className="form-control" value={style} onChange={e => setStyle(e.target.value as any)}>
                <option value="Classique">Classique (Standard)</option>
                <option value="Moderne">Moderne (Épuré et coloré)</option>
                <option value="Minimaliste">Minimaliste (Noir & Blanc)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Couleur principale du devis</label>
              <input type="color" className="form-control" style={{ height: '42px', cursor: 'pointer' }} value={accentColor} onChange={e => setAccentColor(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Signature & Cachet</label>
              <select className="form-control">
                <option>Signature par défaut + Cachet de l'entreprise</option>
              </select>
            </div>
          </div>
        </section>

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
            <span>Total</span>
            <span>{total.toLocaleString('fr-FR')} FCFA</span>
          </div>

          {/* Margin summary — UI only, never in the PDF */}
          {totalCost > 0 && (
            <div style={{
              marginTop: '12px',
              padding: '12px 16px',
              borderRadius: '8px',
              background: 'color-mix(in srgb, var(--color-success) 8%, var(--color-surface))',
              border: `1px solid color-mix(in srgb, ${getMarginColor(globalMargin)} 30%, transparent)`,
              display: 'flex', flexDirection: 'column', gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500, marginBottom: '2px' }}>
                <TrendingUp size={14} />
                Analyse de rentabilité (usage interne — non visible sur le devis)
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Prix de vente total</span>
                <span style={{ fontWeight: 600 }}>{total.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>Coût d'achat total</span>
                <span style={{ fontWeight: 600 }}>{totalCost.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderTop: '1px solid var(--color-border)', paddingTop: '6px', marginTop: '2px' }}>
                <span style={{ fontWeight: 600 }}>Marge globale</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: getMarginColor(globalMargin) }}>
                  {globalMargin >= 0 ? '+' : ''}{globalMargin.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => {
            setClientId('');
            setSubject('');
            setServiceId('');
            setStyle('Classique');
            setAccentColor('#009688');
            setDiscountPercent(0);
            setLines([]);
            setLineCosts([]);
            localStorage.removeItem(draftKey);
          }} style={{ marginRight: '8px' }}>
            <Trash2 size={16} style={{ marginRight: '4px' }} /> Réinitialiser le formulaire
          </button>
          <button className="btn btn-secondary" onClick={() => handleSave('Brouillon')}>
            <Save size={16} style={{ marginRight: '8px' }} /> Sauvegarder (Brouillon)
          </button>
          <button className="btn btn-primary" onClick={() => handleSave('Brouillon', true)} style={{ marginLeft: '8px' }}>
            <FileText size={16} style={{ marginRight: '8px' }} /> Générer & Prévisualiser
          </button>
        </div>
      </div>
    </div>
  );
}
