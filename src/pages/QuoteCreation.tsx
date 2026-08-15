import { useState } from 'react';
import { Plus, Save, FileText, Trash2, Percent } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { QuoteLine } from '../context/AppContext';
import './QuoteCreation.css';

export function QuoteCreation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');
  const { clients, prestations, addQuote, updateQuote, services, quotes } = useAppContext();
  const { currentUser } = useAuth();

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

  const handleAddLine = () => {
    setLines([...lines, { prestationId: '', description: '', quantity: 1, unitPrice: 0, discountPercent: 0, total: 0 }]);
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
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
      }
    }

    const rawTotal = line.quantity * line.unitPrice;
    const lineDiscount = Math.round((rawTotal * (line.discountPercent || 0)) / 100);
    line.total = Math.max(0, rawTotal - lineDiscount);
    newLines[index] = line;
    setLines(newLines);
  };

  const availablePrestations = currentUser?.role === 'Directeur'
    ? (serviceId ? prestations.filter(p => p.serviceId === serviceId) : prestations)
    : prestations.filter(p => p.serviceId === currentUser?.serviceId);

  // Calculations
  const grossSubtotal = lines.reduce((acc, line) => acc + line.total, 0);
  const discountAmount = Math.round((grossSubtotal * (discountPercent || 0)) / 100);
  const netSubtotal = Math.max(0, grossSubtotal - discountAmount);

  const total = netSubtotal;

  const handleSave = (status: 'Brouillon' | 'Envoyé', preview: boolean = false) => {
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

    if (sourceQuote) {
      updateQuote(sourceQuote.id, quoteData);
    } else {
      addQuote(quoteData);
    }

    if (preview) {
      navigate(`/portail-client/${sourceQuote?.id || newId}`);
    } else {
      navigate('/devis');
    }
  };

  return (
    <div className="quote-creation">
      <div className="page-header">
        <h2>{sourceQuote ? `Modifier le devis ${sourceQuote.quoteNumber}` : 'Créer un nouveau devis'}</h2>
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
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td>
                    <select className="table-input" value={line.prestationId} onChange={e => updateLine(idx, 'prestationId', e.target.value)}>
                      <option value="">Choisir...</option>
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
                  <td>
                    <button className="icon-button text-error" onClick={() => handleRemoveLine(idx)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)' }}>Aucune ligne. Cliquez sur "Ajouter une ligne" pour commencer.</td>
                </tr>
              )}
            </tbody>
          </table>
</div>
          <button className="btn btn-outline" style={{ marginTop: '16px' }} onClick={handleAddLine}>
            <Plus size={16} style={{ marginRight: '8px' }} /> Ajouter une ligne
          </button>
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
        </div>

        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => handleSave('Brouillon')}>
            <Save size={16} style={{ marginRight: '8px' }} /> Sauvegarder (Brouillon)
          </button>
          <button className="btn btn-primary" onClick={() => handleSave('Brouillon', true)}>
            <FileText size={16} style={{ marginRight: '8px' }} /> Générer & Prévisualiser
          </button>
        </div>
      </div>
    </div>
  );
}
