import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Receipt, 
  DollarSign, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Download, 
  Eye, 
  CreditCard, 
  Send, 
  Trash2, 
  Edit3, 
  FileText, 
  TrendingUp, 
  Percent, 
  X, 
  Check, 
  Building2, 
  User, 
  RotateCcw,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type { Quote, QuoteLine, PaymentMethod } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { generateInvoicePdf, downloadBlob } from '../lib/pdfUtils';
import type { Invoice, InvoiceItem, InvoicePayment, InvoiceStatus } from '../types/crmModules';
import toast from 'react-hot-toast';

type TabType = 'ALL' | 'TO_PAY' | 'OVERDUE' | 'PAID' | 'PAYMENTS_JOURNAL';
type PeriodFilter = 'ALL' | 'TODAY' | '7_DAYS' | 'THIS_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR';

export function Factures() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { 
    invoices, 
    invoicePayments, 
    quotes, 
    clients, 
    services, 
    users, 
    settings,
    addInvoice, 
    updateInvoice, 
    updateInvoiceStatus, 
    deleteInvoice, 
    addInvoicePayment, 
    deleteInvoicePayment 
  } = useAppContext();
  const { confirm } = useConfirm();

  // URL Params & Tabs
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [commercialFilter, setCommercialFilter] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Form State for Invoice Creation / Edit
  const [formQuoteId, setFormQuoteId] = useState<string>('');
  const [formClientId, setFormClientId] = useState<string>('');
  const [formCommercialId, setFormCommercialId] = useState<string>('');
  const [formServiceId, setFormServiceId] = useState<string>('');
  const [formIssueDate, setFormIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDeliveryDate, setFormDeliveryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formPaymentTerms, setFormPaymentTerms] = useState<string>('30 jours');
  const [formDueDate, setFormDueDate] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formCommissionRate, setFormCommissionRate] = useState<number>(10);
  const [formItems, setFormItems] = useState<InvoiceItem[]>([]);

  // Form State for Payment Modal
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<string>('Espèces');
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  const isDirector = currentUser?.role === 'Directeur' || currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Directeur adjoint';
  const isResponsable = currentUser?.role === 'Responsable';

  // Helper functions
  const getClient = (id: string) => clients.find(c => c.id === id);
  const getClientName = (id: string) => getClient(id)?.company || getClient(id)?.name || 'Client inconnu';
  const getServiceName = (id?: string) => services.find(s => s.id === id)?.name || '-';
  const getUserName = (id?: string) => users.find(u => u.id === id)?.name || 'Non assigné';
  const getQuote = (id?: string) => quotes.find(q => q.id === id);

  // Helper to compute payments for an invoice
  const getPaymentsForInvoice = (invoiceId: string) => {
    return invoicePayments.filter(p => p.invoiceId === invoiceId);
  };

  const getAmountPaidForInvoice = (invoiceId: string) => {
    return getPaymentsForInvoice(invoiceId).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  };

  const getRemainingForInvoice = (invoice: Invoice) => {
    const paid = getAmountPaidForInvoice(invoice.id);
    return Math.max(0, invoice.totalAmount - paid);
  };

  const getDaysOverdue = (dueDateStr: string): number => {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  // Auto calculate due date when delivery date or payment terms change
  const calculateDueDate = (deliveryDateStr: string, terms: string): string => {
    if (!deliveryDateStr) return '';
    const date = new Date(deliveryDateStr);
    if (isNaN(date.getTime())) return '';

    let daysToAdd = 30;
    if (terms === '7 jours') daysToAdd = 7;
    else if (terms === '15 jours') daysToAdd = 15;
    else if (terms === '30 jours') daysToAdd = 30;
    else if (terms === '45 jours') daysToAdd = 45;
    else if (terms === '60 jours') daysToAdd = 60;
    else if (terms === 'Comptant / Réception') daysToAdd = 0;

    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  };

  // Handle URL param to auto open creation from quote
  useEffect(() => {
    const createQuoteId = searchParams.get('createFromQuoteId');
    if (createQuoteId) {
      const quote = quotes.find(q => q.id === createQuoteId);
      if (quote) {
        openCreateModalFromQuote(quote);
      }
    }
  }, [searchParams, quotes]);

  const openCreateModalFromQuote = (quote: Quote) => {
    setEditingInvoiceId(null);
    setFormQuoteId(quote.id);
    setFormClientId(quote.clientId);
    setFormCommercialId(quote.commercialId || currentUser?.id || '');
    setFormServiceId(quote.serviceId || '');
    const today = new Date().toISOString().split('T')[0];
    setFormIssueDate(today);
    setFormDeliveryDate(today);
    setFormPaymentTerms(quote.paymentTerms || '30 jours');
    setFormDueDate(calculateDueDate(today, quote.paymentTerms || '30 jours'));
    setFormNotes(quote.notes || '');
    setFormCommissionRate(settings.commissionRate || 10);

    // Populate lines with cost prices
    const items: InvoiceItem[] = (quote.lines || []).map((l: QuoteLine) => ({
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
      invoiceId: '',
      prestationId: l.prestationId || undefined,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      costPrice: l.costPrice || 0,
      discountPercent: l.discountPercent || 0,
      taxRate: 0,
      total: l.total
    }));
    setFormItems(items);
    setIsCreateModalOpen(true);
  };

  const handleOpenNewInvoice = () => {
    setEditingInvoiceId(null);
    setFormQuoteId('');
    setFormClientId('');
    setFormCommercialId(currentUser?.id || '');
    setFormServiceId(currentUser?.serviceId || '');
    const today = new Date().toISOString().split('T')[0];
    setFormIssueDate(today);
    setFormDeliveryDate(today);
    setFormPaymentTerms('30 jours');
    setFormDueDate(calculateDueDate(today, '30 jours'));
    setFormNotes('');
    setFormCommissionRate(settings.commissionRate || 10);
    setFormItems([]);
    setIsCreateModalOpen(true);
  };

  const handleSelectQuoteInForm = (quoteId: string) => {
    setFormQuoteId(quoteId);
    if (!quoteId) return;
    const quote = quotes.find(q => q.id === quoteId);
    if (quote) {
      setFormClientId(quote.clientId);
      setFormCommercialId(quote.commercialId);
      setFormServiceId(quote.serviceId || '');
      setFormPaymentTerms(quote.paymentTerms || '30 jours');
      setFormDueDate(calculateDueDate(formDeliveryDate, quote.paymentTerms || '30 jours'));
      setFormNotes(quote.notes || '');
      const items: InvoiceItem[] = (quote.lines || []).map((l: QuoteLine) => ({
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
        invoiceId: '',
        prestationId: l.prestationId || undefined,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        costPrice: l.costPrice || 0,
        discountPercent: l.discountPercent || 0,
        taxRate: 0,
        total: l.total
      }));
      setFormItems(items);
    }
  };

  // Calculate Form Totals
  const formSubtotal = useMemo(() => {
    return formItems.reduce((sum, it) => sum + (Number(it.unitPrice) * Number(it.quantity)), 0);
  }, [formItems]);

  const formTotalAmount = useMemo(() => {
    return formItems.reduce((sum, it) => sum + Number(it.total), 0);
  }, [formItems]);

  const formCostAmount = useMemo(() => {
    return formItems.reduce((sum, it) => sum + (Number(it.costPrice || 0) * Number(it.quantity)), 0);
  }, [formItems]);

  const formGrossMargin = formTotalAmount - formCostAmount;
  const formCommissionAmount = formGrossMargin > 0 ? Math.round(formGrossMargin * (formCommissionRate / 100)) : 0;
  const formHinovMargin = formGrossMargin - formCommissionAmount;

  // Save Invoice
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClientId) {
      toast.error('Veuillez sélectionner un client.');
      return;
    }
    if (formItems.length === 0) {
      toast.error('Veuillez ajouter au moins une prestation / ligne de facture.');
      return;
    }

    try {
      const year = new Date(formIssueDate).getFullYear();
      const nextSeq = (invoices.length + 1).toString().padStart(4, '0');
      const invoiceNumber = editingInvoiceId 
        ? (invoices.find(i => i.id === editingInvoiceId)?.invoiceNumber || `FAC-${year}-${nextSeq}`)
        : `FAC-${year}-${nextSeq}`;

      const invoiceData = {
        invoiceNumber,
        quoteId: formQuoteId || undefined,
        clientId: formClientId,
        commercialId: formCommercialId || currentUser?.id,
        serviceId: formServiceId || undefined,
        issueDate: formIssueDate,
        deliveryDate: formDeliveryDate || undefined,
        paymentTerms: formPaymentTerms,
        dueDate: formDueDate || calculateDueDate(formDeliveryDate, formPaymentTerms),
        subtotal: formSubtotal,
        taxAmount: 0,
        discountAmount: Math.max(0, formSubtotal - formTotalAmount),
        totalAmount: formTotalAmount,
        costAmount: formCostAmount,
        commissionRate: formCommissionRate,
        commissionAmount: formCommissionAmount,
        grossMargin: formGrossMargin,
        hinovMargin: formHinovMargin,
        status: (editingInvoiceId ? invoices.find(i => i.id === editingInvoiceId)?.status : 'ÉMISE') as InvoiceStatus,
        notes: formNotes || undefined,
        items: formItems
      };

      if (editingInvoiceId) {
        await updateInvoice(editingInvoiceId, invoiceData);
        toast.success(`Facture ${invoiceNumber} mise à jour avec succès !`);
      } else {
        await addInvoice(invoiceData);
        toast.success(`Facture ${invoiceNumber} créée avec succès !`);
      }

      setIsCreateModalOpen(false);
      setEditingInvoiceId(null);
    } catch (err) {
      console.error('Erreur sauvegarde facture:', err);
      toast.error('Une erreur est survenue lors de l\'enregistrement de la facture.');
    }
  };

  // Open Payment Modal
  const handleOpenPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const remaining = getRemainingForInvoice(invoice);
    setPayAmount(remaining);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayMethod('Espèces');
    setPayRef('');
    setPayNotes('');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (payAmount <= 0) {
      toast.error('Veuillez saisir un montant de paiement supérieur à zéro.');
      return;
    }

    const remaining = getRemainingForInvoice(selectedInvoice);
    if (payAmount > remaining) {
      toast.error(`Le montant saisi (${payAmount.toLocaleString('fr-FR')} FCFA) dépasse le reste à payer (${remaining.toLocaleString('fr-FR')} FCFA).`);
      return;
    }

    try {
      await addInvoicePayment({
        invoiceId: selectedInvoice.id,
        amount: payAmount,
        paymentDate: payDate,
        paymentMethod: payMethod,
        reference: payRef || undefined,
        notes: payNotes || undefined,
        createdBy: currentUser?.id
      });

      toast.success(`Paiement de ${payAmount.toLocaleString('fr-FR')} FCFA enregistré avec succès !`);
      setIsPaymentModalOpen(false);
      setSelectedInvoice(null);
    } catch (err) {
      console.error('Erreur enregistrement paiement:', err);
      toast.error('Erreur lors de l\'enregistrement du paiement.');
    }
  };

  // Open Reminder Modal
  const handleOpenReminderModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsReminderModalOpen(true);
  };

  const handleSendWhatsAppReminder = (invoice: Invoice) => {
    const client = getClient(invoice.clientId);
    if (!client?.phone) {
      toast.error('Ce client n\'a pas de numéro de téléphone enregistré.');
      return;
    }
    const cleanPhone = client.phone.replace(/[^0-9]/g, '');
    const remaining = getRemainingForInvoice(invoice);
    const message = `Bonjour ${client.name},\n\nNous vous contactons concernant votre facture N° ${invoice.invoiceNumber} du ${invoice.issueDate}.\nLe montant restant à régler est de : ${remaining.toLocaleString('fr-FR')} FCFA.\nDate d'échéance : ${invoice.dueDate}.\n\nMerci de bien vouloir procéder au règlement dès que possible.\nCordialement,\n${settings.companyName || 'HINOV'}`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Filtered Invoices
  const allowedInvoices = useMemo(() => {
    if (isDirector) return invoices;
    if (isResponsable) {
      return invoices.filter(i => i.serviceId === currentUser?.serviceId || i.commercialId === currentUser?.id);
    }
    return invoices.filter(i => i.commercialId === currentUser?.id);
  }, [invoices, isDirector, isResponsable, currentUser]);

  const allowedQuotes = useMemo(() => {
    if (isDirector) return quotes;
    if (isResponsable) {
      return quotes.filter(q => q.serviceId === currentUser?.serviceId || q.commercialId === currentUser?.id);
    }
    return quotes.filter(q => q.commercialId === currentUser?.id);
  }, [quotes, isDirector, isResponsable, currentUser]);

  const allowedClients = useMemo(() => {
    if (isDirector) return clients;
    return clients.filter(c => c.commercialId === currentUser?.id);
  }, [clients, isDirector, currentUser]);

  const filteredInvoices = useMemo(() => {
    return allowedInvoices.filter(inv => {
      const client = getClient(inv.clientId);
      const clientName = (client?.name || '') + ' ' + (client?.company || '');
      const quote = getQuote(inv.quoteId);
      const quoteNum = quote?.quoteNumber || '';
      const commercial = getUserName(inv.commercialId);

      // Search
      const searchMatch = !searchTerm || 
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quoteNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
        commercial.toLowerCase().includes(searchTerm.toLowerCase());

      if (!searchMatch) return false;

      // Status
      if (statusFilter && inv.status !== statusFilter) return false;

      // Service
      if (serviceFilter && inv.serviceId !== serviceFilter) return false;

      // Commercial
      if (commercialFilter && inv.commercialId !== commercialFilter) return false;

      // Tab Filtering
      const remaining = getRemainingForInvoice(inv);
      const daysOverdue = getDaysOverdue(inv.dueDate);
      const isOverdue = daysOverdue > 0 && remaining > 0 && inv.status !== 'ANNULÉE' && inv.status !== 'BROUILLON';

      if (activeTab === 'TO_PAY') {
        if (remaining <= 0 || inv.status === 'PAYÉE' || inv.status === 'ANNULÉE') return false;
      } else if (activeTab === 'OVERDUE') {
        if (!isOverdue) return false;
      } else if (activeTab === 'PAID') {
        if (remaining > 0 || inv.status !== 'PAYÉE') return false;
      }

      return true;
    });
  }, [allowedInvoices, searchTerm, statusFilter, serviceFilter, commercialFilter, activeTab, clients, quotes, users, invoicePayments]);

  // Global KPIs based on allowed invoices
  const globalKpis = useMemo(() => {
    let totalInvoiced = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    let totalOverdue = 0;
    let countPaid = 0;
    let countPartial = 0;
    let countOverdue = 0;
    let countTotal = allowedInvoices.length;

    allowedInvoices.forEach(inv => {
      if (inv.status === 'ANNULÉE') return;
      totalInvoiced += Number(inv.totalAmount || 0);
      const paid = getAmountPaidForInvoice(inv.id);
      totalCollected += paid;
      const rem = Math.max(0, inv.totalAmount - paid);
      totalRemaining += rem;

      const daysOverdue = getDaysOverdue(inv.dueDate);
      if (daysOverdue > 0 && rem > 0) {
        totalOverdue += rem;
        countOverdue++;
      }

      if (rem === 0 && inv.totalAmount > 0) countPaid++;
      else if (paid > 0 && rem > 0) countPartial++;
    });

    const recoveryRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

    return {
      totalInvoiced,
      totalCollected,
      totalRemaining,
      totalOverdue,
      countTotal,
      countPaid,
      countPartial,
      countOverdue,
      recoveryRate
    };
  }, [allowedInvoices, invoicePayments]);

  // Badge Status Renderer
  const renderStatusBadge = (status: InvoiceStatus, dueDate: string, remaining: number) => {
    const daysOverdue = getDaysOverdue(dueDate);
    if (status === 'ANNULÉE') {
      return <span className="badge-status bg-gray-100 text-gray-700">ANNULÉE</span>;
    }
    if (status === 'BROUILLON') {
      return <span className="badge-status bg-slate-100 text-slate-700">BROUILLON</span>;
    }
    if (status === 'PAYÉE' || remaining === 0) {
      return <span className="badge-status bg-emerald-100 text-emerald-800 font-bold">✓ PAYÉE</span>;
    }
    if (daysOverdue > 0) {
      return (
        <span className="badge-status bg-rose-100 text-rose-800 font-bold flex items-center gap-1">
          <AlertTriangle size={12} /> EN RETARD (+{daysOverdue}j)
        </span>
      );
    }
    if (status === 'PARTIELLEMENT_PAYÉE') {
      return <span className="badge-status bg-amber-100 text-amber-800 font-semibold">PARTIELLEMENT PAYÉE</span>;
    }
    return <span className="badge-status bg-blue-100 text-blue-800">ÉMISE</span>;
  };

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* ─── HEADER & ACTIONS ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: '#E0F2FE', color: '#0284C7', borderRadius: '8px' }}>
              <Receipt size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                Facturation & Suivi des Impayés
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Gestion des factures clients, encaissements multiples, échéances et rentabilité
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600, borderRadius: '8px', backgroundColor: '#0284C7' }}
            onClick={handleOpenNewInvoice}
          >
            <Plus size={18} />
            Nouvelle Facture
          </button>
        </div>
      </div>

      {/* ─── KPIS CARDS (5 CARDS) ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* Total Facturé */}
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #0284C7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Facturé</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text)', marginTop: '4px' }}>
                {globalKpis.totalInvoiced.toLocaleString('fr-FR')} <span style={{ fontSize: '0.85rem' }}>FCFA</span>
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', background: '#E0F2FE', color: '#0284C7' }}>
              <FileText size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            {globalKpis.countTotal} factures émises au total
          </div>
        </div>

        {/* Total Encaissé */}
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>Total Encaissé</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                {globalKpis.totalCollected.toLocaleString('fr-FR')} <span style={{ fontSize: '0.85rem' }}>FCFA</span>
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', background: '#D1FAE5', color: '#059669' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '8px' }}>
            {globalKpis.countPaid} factures soldées à 100%
          </div>
        </div>

        {/* Reste à Recouvrer */}
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>Reste à Recouvrer</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>
                {globalKpis.totalRemaining.toLocaleString('fr-FR')} <span style={{ fontSize: '0.85rem' }}>FCFA</span>
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', background: '#FEF3C7', color: '#D97706' }}>
              <Clock size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            {globalKpis.countPartial} factures avec acomptes partiels
          </div>
        </div>

        {/* Total en Retard / Impayés */}
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #EF4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>Impayés / En Retard</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
                {globalKpis.totalOverdue.toLocaleString('fr-FR')} <span style={{ fontSize: '0.85rem' }}>FCFA</span>
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', background: '#FEE2E2', color: '#DC2626' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#DC2626', fontWeight: 600, marginTop: '8px' }}>
            {globalKpis.countOverdue} factures dont l'échéance est dépassée
          </div>
        </div>

        {/* Taux de Recouvrement */}
        <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase' }}>Taux de Recouvrement</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>
                {globalKpis.recoveryRate}%
              </div>
            </div>
            <div style={{ padding: '8px', borderRadius: '8px', background: '#EDE9FE', color: '#7C3AED' }}>
              <Percent size={20} />
            </div>
          </div>
          <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
            <div style={{ width: `${globalKpis.recoveryRate}%`, height: '100%', background: '#7C3AED', borderRadius: '3px' }} />
          </div>
        </div>

      </div>

      {/* ─── ONGLET DE NAVIGATION ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          className={`tab-btn ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
          style={{
            padding: '10px 18px',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'ALL' ? 700 : 500,
            borderBottom: activeTab === 'ALL' ? '3px solid #0284C7' : 'none',
            color: activeTab === 'ALL' ? '#0284C7' : 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          📄 Toutes les factures ({allowedInvoices.length})
        </button>

        <button
          className={`tab-btn ${activeTab === 'TO_PAY' ? 'active' : ''}`}
          onClick={() => setActiveTab('TO_PAY')}
          style={{
            padding: '10px 18px',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'TO_PAY' ? 700 : 500,
            borderBottom: activeTab === 'TO_PAY' ? '3px solid #D97706' : 'none',
            color: activeTab === 'TO_PAY' ? '#D97706' : 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          ⏳ À encaisser / Partielles ({allowedInvoices.filter(i => getRemainingForInvoice(i) > 0 && i.status !== 'ANNULÉE').length})
        </button>

        <button
          className={`tab-btn ${activeTab === 'OVERDUE' ? 'active' : ''}`}
          onClick={() => setActiveTab('OVERDUE')}
          style={{
            padding: '10px 18px',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'OVERDUE' ? 700 : 500,
            borderBottom: activeTab === 'OVERDUE' ? '3px solid #DC2626' : 'none',
            color: activeTab === 'OVERDUE' ? '#DC2626' : 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          ⚠️ Suivi des Impayés ({globalKpis.countOverdue})
        </button>

        <button
          className={`tab-btn ${activeTab === 'PAID' ? 'active' : ''}`}
          onClick={() => setActiveTab('PAID')}
          style={{
            padding: '10px 18px',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'PAID' ? 700 : 500,
            borderBottom: activeTab === 'PAID' ? '3px solid #059669' : 'none',
            color: activeTab === 'PAID' ? '#059669' : 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          ✓ Factures Payées ({globalKpis.countPaid})
        </button>

        <button
          className={`tab-btn ${activeTab === 'PAYMENTS_JOURNAL' ? 'active' : ''}`}
          onClick={() => setActiveTab('PAYMENTS_JOURNAL')}
          style={{
            padding: '10px 18px',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'PAYMENTS_JOURNAL' ? 700 : 500,
            borderBottom: activeTab === 'PAYMENTS_JOURNAL' ? '3px solid #6366F1' : 'none',
            color: activeTab === 'PAYMENTS_JOURNAL' ? '#6366F1' : 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          💳 Journal des Encaissements ({invoicePayments.length})
        </button>
      </div>

      {/* ─── FILTRES ET RECHERCHE ─────────────────────────────── */}
      {activeTab !== 'PAYMENTS_JOURNAL' && (
        <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            
            {/* Barre de recherche */}
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="N° facture, client, N° devis..."
                className="table-input"
                style={{ width: '100%', paddingLeft: '36px', fontSize: '0.85rem' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Statut */}
            <div>
              <select
                className="table-input"
                style={{ width: '100%', fontSize: '0.85rem' }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="">🏷️ Tous les statuts</option>
                <option value="ÉMISE">ÉMISE</option>
                <option value="PARTIELLEMENT_PAYÉE">PARTIELLEMENT PAYÉE</option>
                <option value="PAYÉE">PAYÉE</option>
                <option value="EN_RETARD">EN RETARD</option>
                <option value="BROUILLON">BROUILLON</option>
                <option value="ANNULÉE">ANNULÉE</option>
              </select>
            </div>

            {/* Service */}
            {isDirector && (
              <div>
                <select
                  className="table-input"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                  value={serviceFilter}
                  onChange={e => setServiceFilter(e.target.value)}
                >
                  <option value="">🏢 Tous les services</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Commercial */}
            {(isDirector || isResponsable) && (
              <div>
                <select
                  className="table-input"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                  value={commercialFilter}
                  onChange={e => setCommercialFilter(e.target.value)}
                >
                  <option value="">👤 Tous les commerciaux</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ─── VUE 1 : TABLEAU DES FACTURES ─────────────────────── */}
      {activeTab !== 'PAYMENTS_JOURNAL' && (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>N° Facture</th>
                  <th>Client</th>
                  <th>Réf. Devis</th>
                  <th>Commercial / Service</th>
                  <th>Échéance</th>
                  <th style={{ textAlign: 'right' }}>Total Facturé</th>
                  <th style={{ textAlign: 'right' }}>Payé</th>
                  <th style={{ textAlign: 'right' }}>Reste à payer</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const client = getClient(inv.clientId);
                  const quote = getQuote(inv.quoteId);
                  const paidAmount = getAmountPaidForInvoice(inv.id);
                  const remaining = Math.max(0, inv.totalAmount - paidAmount);
                  const daysOverdue = getDaysOverdue(inv.dueDate);

                  return (
                    <tr key={inv.id} style={{ backgroundColor: daysOverdue > 0 && remaining > 0 ? 'rgba(254, 242, 242, 0.5)' : undefined }}>
                      
                      {/* N° Facture */}
                      <td data-label="N° Facture">
                        <div 
                          style={{ fontWeight: 800, color: '#0284C7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => { setSelectedInvoice(inv); setIsDetailModalOpen(true); }}
                        >
                          <Receipt size={14} />
                          {inv.invoiceNumber}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                          Émise le {inv.issueDate}
                        </div>
                      </td>

                      {/* Client */}
                      <td data-label="Client">
                        <div style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                          {getClientName(inv.clientId)}
                        </div>
                        {client?.phone && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            📞 {client.phone}
                          </div>
                        )}
                      </td>

                      {/* Réf. Devis */}
                      <td data-label="Réf. Devis">
                        {quote ? (
                          <span 
                            style={{ fontSize: '0.8rem', fontWeight: 600, color: '#D97706', cursor: 'pointer', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}
                            onClick={() => navigate(`/devis`)}
                            title="Voir le devis d'origine"
                          >
                            {quote.quoteNumber}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>-</span>
                        )}
                      </td>

                      {/* Commercial & Service */}
                      <td data-label="Commercial / Service">
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{getUserName(inv.commercialId)}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{getServiceName(inv.serviceId)}</div>
                      </td>

                      {/* Échéance */}
                      <td data-label="Échéance">
                        <div style={{ fontSize: '0.85rem', fontWeight: daysOverdue > 0 && remaining > 0 ? 700 : 500, color: daysOverdue > 0 && remaining > 0 ? '#DC2626' : 'var(--color-text)' }}>
                          {inv.dueDate || '-'}
                        </div>
                        {daysOverdue > 0 && remaining > 0 ? (
                          <div style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 700 }}>
                            Retard: +{daysOverdue} j
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            {inv.paymentTerms || '30 jours'}
                          </div>
                        )}
                      </td>

                      {/* Total Facturé */}
                      <td data-label="Total Facturé" style={{ textAlign: 'right', fontWeight: 700 }}>
                        {inv.totalAmount.toLocaleString('fr-FR')} FCFA
                      </td>

                      {/* Payé */}
                      <td data-label="Payé" style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                        {paidAmount.toLocaleString('fr-FR')} FCFA
                      </td>

                      {/* Reste à Payer */}
                      <td data-label="Reste à Payer" style={{ textAlign: 'right', fontWeight: 800, color: remaining > 0 ? '#DC2626' : '#059669' }}>
                        {remaining.toLocaleString('fr-FR')} FCFA
                      </td>

                      {/* Statut */}
                      <td data-label="Statut">
                        {renderStatusBadge(inv.status, inv.dueDate, remaining)}
                      </td>

                      {/* Actions */}
                      <td data-label="Actions">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                          
                          {/* Voir détails */}
                          <button
                            className="icon-button"
                            style={{ color: '#0284C7', background: '#E0F2FE', padding: '6px', borderRadius: '4px' }}
                            title="Consulter la fiche détaillée"
                            onClick={() => { setSelectedInvoice(inv); setIsDetailModalOpen(true); }}
                          >
                            <Eye size={16} />
                          </button>

                          {/* Enregistrer paiement */}
                          {remaining > 0 && inv.status !== 'ANNULÉE' && (
                            <button
                              className="icon-button"
                              style={{ color: '#059669', background: '#D1FAE5', padding: '6px', borderRadius: '4px' }}
                              title="Enregistrer un paiement"
                              onClick={() => handleOpenPaymentModal(inv)}
                            >
                              <DollarSign size={16} />
                            </button>
                          )}

                          {/* Télécharger PDF */}
                          <button
                            className="icon-button"
                            style={{ color: '#4F46E5', background: '#EEF2FF', padding: '6px', borderRadius: '4px' }}
                            title="Télécharger Facture PDF"
                            onClick={() => {
                              const quote = getQuote(inv.quoteId);
                              const client = getClient(inv.clientId);
                              const payments = getPaymentsForInvoice(inv.id);
                              const blob = generateInvoicePdf(inv, client, quote, settings, payments);
                              downloadBlob(blob, `Facture_${inv.invoiceNumber}.pdf`);
                            }}
                          >
                            <Download size={16} />
                          </button>

                          {/* Relancer client */}
                          {remaining > 0 && (
                            <button
                              className="icon-button"
                              style={{ color: '#2563EB', background: '#EFF6FF', padding: '6px', borderRadius: '4px' }}
                              title="Relancer le client (WhatsApp / Message)"
                              onClick={() => handleOpenReminderModal(inv)}
                            >
                              <Send size={16} />
                            </button>
                          )}

                          {/* Supprimer (Directeur / Admin) */}
                          {isDirector && (
                            <button
                              className="icon-button"
                              style={{ color: '#DC2626', background: '#FEE2E2', padding: '6px', borderRadius: '4px' }}
                              title="Supprimer la facture"
                              onClick={() => {
                                confirm({
                                  title: 'Supprimer la facture',
                                  message: `Voulez-vous vraiment supprimer définitivement la facture ${inv.invoiceNumber} et tous ses règlements associés ?`,
                                  confirmLabel: 'Supprimer',
                                  variant: 'danger',
                                  onConfirm: () => deleteInvoice(inv.id)
                                });
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })}

                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-muted)' }}>
                      Aucune facture trouvée pour les filtres sélectionnés.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── VUE 2 : JOURNAL DES PAIEMENTS ────────────────────── */}
      {activeTab === 'PAYMENTS_JOURNAL' && (
        <div className="card">
          <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
              Journal de tous les règlements clients
            </h3>
            <div style={{ fontWeight: 700, color: '#059669', fontSize: '1.1rem' }}>
              Total des encaissements : {invoicePayments.reduce((s, p) => s + Number(p.amount || 0), 0).toLocaleString('fr-FR')} FCFA
            </div>
          </div>
          <div className="table-responsive">
            <table className="data-table responsive-table">
              <thead>
                <tr>
                  <th>N° Paiement</th>
                  <th>Date</th>
                  <th>Facture associée</th>
                  <th>Client</th>
                  <th>Mode de règlement</th>
                  <th>Référence</th>
                  <th style={{ textAlign: 'right' }}>Montant encaissé</th>
                  {isDirector && <th style={{ textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invoicePayments.map(p => {
                  const inv = invoices.find(i => i.id === p.invoiceId);
                  const client = inv ? getClient(inv.clientId) : null;
                  return (
                    <tr key={p.id}>
                      <td data-label="N° Paiement" style={{ fontWeight: 700, color: '#6366F1' }}>
                        {p.paymentNumber || `PAY-${p.id.slice(0, 6).toUpperCase()}`}
                      </td>
                      <td data-label="Date">{p.paymentDate}</td>
                      <td data-label="Facture">
                        {inv ? (
                          <span 
                            style={{ fontWeight: 700, color: '#0284C7', cursor: 'pointer' }}
                            onClick={() => { setSelectedInvoice(inv); setIsDetailModalOpen(true); }}
                          >
                            {inv.invoiceNumber}
                          </span>
                        ) : 'Facture supprimée'}
                      </td>
                      <td data-label="Client">
                        <strong>{client?.company || client?.name || '-'}</strong>
                      </td>
                      <td data-label="Mode">
                        <span className="badge-status bg-slate-100 text-slate-800">
                          {p.paymentMethod || 'Espèces'}
                        </span>
                      </td>
                      <td data-label="Référence" style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {p.reference || '-'}
                      </td>
                      <td data-label="Montant" style={{ textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                        {p.amount.toLocaleString('fr-FR')} FCFA
                      </td>
                      {isDirector && (
                        <td data-label="Actions" style={{ textAlign: 'center' }}>
                          <button
                            className="icon-button"
                            style={{ color: '#DC2626', background: '#FEE2E2', padding: '6px', borderRadius: '4px' }}
                            title="Annuler / Supprimer ce règlement"
                            onClick={() => {
                              confirm({
                                title: 'Supprimer ce règlement',
                                message: `Voulez-vous supprimer ce paiement de ${p.amount.toLocaleString('fr-FR')} FCFA ? Le solde de la facture sera réajusté.`,
                                confirmLabel: 'Supprimer',
                                variant: 'danger',
                                onConfirm: () => deleteInvoicePayment(p.id)
                              });
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {invoicePayments.length === 0 && (
                  <tr>
                    <td colSpan={isDirector ? 8 : 7} style={{ textAlign: 'center', padding: '36px', color: 'var(--color-text-muted)' }}>
                      Aucun encaissement enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ─── MODAL : CRÉATION / MODIFICATION FACTURE ─────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isCreateModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-content card" style={{ maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: '#E0F2FE', color: '#0284C7', borderRadius: '8px' }}>
                  <Receipt size={22} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                  {editingInvoiceId ? 'Modifier la Facture' : 'Créer une Facture Client'}
                </h2>
              </div>
              <button className="icon-button" onClick={() => setIsCreateModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice}>
              
              {/* Option Devis d'origine */}
              <div style={{ marginBottom: '16px', background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: '#0284C7' }}>
                  📋 Facturer à partir d'un devis existant (Recommandé) :
                </label>
                <select
                  className="table-input"
                  style={{ width: '100%', fontSize: '0.9rem' }}
                  value={formQuoteId}
                  onChange={e => handleSelectQuoteInForm(e.target.value)}
                >
                  <option value="">-- Sélectionner un devis accepté --</option>
                  {allowedQuotes.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.quoteNumber} — {getClientName(q.clientId)} — {q.total.toLocaleString('fr-FR')} FCFA ({q.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ligne 1 : Client & Service & Commercial */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Client *</label>
                  <select
                    required
                    className="table-input"
                    style={{ width: '100%' }}
                    value={formClientId}
                    onChange={e => setFormClientId(e.target.value)}
                  >
                    <option value="">-- Choisir un client --</option>
                    {allowedClients.map(c => (
                      <option key={c.id} value={c.id}>{c.company || c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Commercial en charge</label>
                  <select
                    className="table-input"
                    style={{ width: '100%' }}
                    value={formCommercialId}
                    onChange={e => setFormCommercialId(e.target.value)}
                  >
                    <option value="">-- Sélectionner --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Service / Département</label>
                  <select
                    className="table-input"
                    style={{ width: '100%' }}
                    value={formServiceId}
                    onChange={e => setFormServiceId(e.target.value)}
                  >
                    <option value="">-- Sélectionner un service --</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ligne 2 : Dates & Conditions de règlement */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Date d'émission *</label>
                  <input
                    type="date"
                    required
                    className="table-input"
                    style={{ width: '100%' }}
                    value={formIssueDate}
                    onChange={e => setFormIssueDate(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Date de livraison</label>
                  <input
                    type="date"
                    className="table-input"
                    style={{ width: '100%' }}
                    value={formDeliveryDate}
                    onChange={e => {
                      setFormDeliveryDate(e.target.value);
                      setFormDueDate(calculateDueDate(e.target.value, formPaymentTerms));
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Conditions de paiement</label>
                  <select
                    className="table-input"
                    style={{ width: '100%' }}
                    value={formPaymentTerms}
                    onChange={e => {
                      setFormPaymentTerms(e.target.value);
                      setFormDueDate(calculateDueDate(formDeliveryDate, e.target.value));
                    }}
                  >
                    <option value="Comptant / Réception">Comptant / Réception (0 jour)</option>
                    <option value="7 jours">7 jours</option>
                    <option value="15 jours">15 jours</option>
                    <option value="30 jours">30 jours (défaut)</option>
                    <option value="45 jours">45 jours</option>
                    <option value="60 jours">60 jours</option>
                    <option value="Personnalisé">Personnalisé</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Date d'échéance calculée *</label>
                  <input
                    type="date"
                    required
                    className="table-input"
                    style={{ width: '100%', fontWeight: 700, color: '#0284C7' }}
                    value={formDueDate}
                    onChange={e => setFormDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Lignes de Facture */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Prestations / Articles facturés</h4>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                    onClick={() => {
                      setFormItems([
                        ...formItems,
                        {
                          id: Math.random().toString(),
                          invoiceId: '',
                          description: '',
                          quantity: 1,
                          unitPrice: 0,
                          costPrice: 0,
                          discountPercent: 0,
                          taxRate: 0,
                          total: 0
                        }
                      ]);
                    }}
                  >
                    + Ajouter une ligne
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Désignation</th>
                        <th style={{ width: '70px' }}>Qté</th>
                        <th style={{ width: '120px' }}>Prix Vente (FCFA)</th>
                        <th style={{ width: '120px' }}>Coût Achat (FCFA)</th>
                        <th style={{ width: '120px', textAlign: 'right' }}>Total Ligne</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formItems.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td>
                            <input
                              type="text"
                              required
                              placeholder="Description de la prestation..."
                              className="table-input"
                              style={{ width: '100%' }}
                              value={item.description}
                              onChange={e => {
                                const next = [...formItems];
                                next[idx].description = e.target.value;
                                setFormItems(next);
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              className="table-input"
                              style={{ width: '100%' }}
                              value={item.quantity}
                              onChange={e => {
                                const next = [...formItems];
                                const qty = Number(e.target.value) || 1;
                                next[idx].quantity = qty;
                                next[idx].total = qty * next[idx].unitPrice;
                                setFormItems(next);
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              className="table-input"
                              style={{ width: '100%' }}
                              value={item.unitPrice}
                              onChange={e => {
                                const next = [...formItems];
                                const up = Number(e.target.value) || 0;
                                next[idx].unitPrice = up;
                                next[idx].total = up * next[idx].quantity;
                                setFormItems(next);
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              placeholder="Coût direct"
                              className="table-input"
                              style={{ width: '100%' }}
                              value={item.costPrice || 0}
                              onChange={e => {
                                const next = [...formItems];
                                next[idx].costPrice = Number(e.target.value) || 0;
                                setFormItems(next);
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {item.total.toLocaleString('fr-FR')} FCFA
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-button"
                              style={{ color: '#DC2626' }}
                              onClick={() => {
                                setFormItems(formItems.filter((_, i) => i !== idx));
                              }}
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formItems.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)' }}>
                            Aucune prestation ajoutée. Cliquez sur "+ Ajouter une ligne" ou sélectionnez un devis.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Récapitulatif Financier & Rentabilité Métier HINOV */}
              <div style={{ background: '#F8FAFC', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', marginBottom: '10px', textTransform: 'uppercase' }}>
                  📊 Synthèse Financière & Rentabilité Prévisionnelle
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Montant Facturé</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284C7' }}>
                      {formTotalAmount.toLocaleString('fr-FR')} FCFA
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Coût Total Achat</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#DC2626' }}>
                      {formCostAmount.toLocaleString('fr-FR')} FCFA
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Marge Brute</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: formGrossMargin >= 0 ? '#059669' : '#DC2626' }}>
                      {formGrossMargin.toLocaleString('fr-FR')} FCFA
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Prime Commerciale (10%)</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#D97706' }}>
                      {formCommissionAmount.toLocaleString('fr-FR')} FCFA
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Marge Nette HINOV</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4F46E5' }}>
                      {formHinovMargin.toLocaleString('fr-FR')} FCFA
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Notes / Instructions de virement</label>
                <textarea
                  rows={2}
                  className="table-input"
                  style={{ width: '100%' }}
                  placeholder="Informations supplémentaires ou coordonnées bancaires..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                />
              </div>

              {/* Boutons d'action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0284C7', fontWeight: 700 }}
                >
                  {editingInvoiceId ? 'Enregistrer les modifications' : 'Émettre la facture'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ─── MODAL : FICHE DÉTAILLÉE DE FACTURE ──────────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isDetailModalOpen && selectedInvoice && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-content card" style={{ maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', borderRadius: '12px' }}>
            
            {/* Header Fiche */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0284C7' }}>
                    Facture {selectedInvoice.invoiceNumber}
                  </h2>
                  {renderStatusBadge(selectedInvoice.status, selectedInvoice.dueDate, getRemainingForInvoice(selectedInvoice))}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  Client : <strong>{getClientName(selectedInvoice.clientId)}</strong> | Émise le {selectedInvoice.issueDate}
                </div>
              </div>
              <button className="icon-button" onClick={() => { setIsDetailModalOpen(false); setSelectedInvoice(null); }}>
                <X size={20} />
              </button>
            </div>

            {/* Infos Clés */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Échéance & Conditions</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
                  {selectedInvoice.dueDate}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Conditions : {selectedInvoice.paymentTerms || '30 jours'}
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Commercial & Service</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginTop: '2px' }}>
                  {getUserName(selectedInvoice.commercialId)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {getServiceName(selectedInvoice.serviceId)}
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Devis d'origine</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#D97706', marginTop: '2px' }}>
                  {getQuote(selectedInvoice.quoteId)?.quoteNumber || selectedInvoice.quoteId || 'Facture directe'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Livraison : {selectedInvoice.deliveryDate || '-'}
                </div>
              </div>
            </div>

            {/* Lignes de Prestations */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 700 }}>Prestations facturées</h4>
              <div className="table-responsive">
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Désignation</th>
                      <th style={{ textAlign: 'center' }}>Qté</th>
                      <th style={{ textAlign: 'right' }}>Prix Unitaire</th>
                      <th style={{ textAlign: 'right' }}>Coût d'Achat</th>
                      <th style={{ textAlign: 'right' }}>Total Ligne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedInvoice.items || []).map((it, i) => (
                      <tr key={it.id || i}>
                        <td>{it.description}</td>
                        <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{it.unitPrice.toLocaleString('fr-FR')} FCFA</td>
                        <td style={{ textAlign: 'right', color: '#DC2626' }}>{(it.costPrice || 0).toLocaleString('fr-FR')} FCFA</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{it.total.toLocaleString('fr-FR')} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rentabilité Métier HINOV */}
            <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 800, color: '#4338CA', marginBottom: '10px', textTransform: 'uppercase' }}>
                <TrendingUp size={16} /> Analyse de Rentabilité Métier (HINOV ERP)
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#6366F1' }}>Montant Facturé</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1E1B4B' }}>
                    {selectedInvoice.totalAmount.toLocaleString('fr-FR')} FCFA
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#6366F1' }}>Coût Réel (Achat)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#DC2626' }}>
                    {(selectedInvoice.costAmount || 0).toLocaleString('fr-FR')} FCFA
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#6366F1' }}>Marge Brute</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669' }}>
                    {(selectedInvoice.grossMargin || (selectedInvoice.totalAmount - (selectedInvoice.costAmount || 0))).toLocaleString('fr-FR')} FCFA
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#6366F1' }}>Prime Commercial (10%)</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#D97706' }}>
                    {(selectedInvoice.commissionAmount || 0).toLocaleString('fr-FR')} FCFA
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: '#6366F1' }}>Marge Nette HINOV</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#4338CA' }}>
                    {(selectedInvoice.hinovMargin || ((selectedInvoice.grossMargin || 0) - (selectedInvoice.commissionAmount || 0))).toLocaleString('fr-FR')} FCFA
                  </div>
                </div>
              </div>
            </div>

            {/* Historique des Règlements */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                  Règlements & Acomptes ({getPaymentsForInvoice(selectedInvoice.id).length})
                </h4>
                {getRemainingForInvoice(selectedInvoice) > 0 && selectedInvoice.status !== 'ANNULÉE' && (
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '4px 12px', background: '#059669' }}
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenPaymentModal(selectedInvoice);
                    }}
                  >
                    + Enregistrer un encaissement
                  </button>
                )}
              </div>

              <div className="table-responsive">
                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>N° Reçu</th>
                      <th>Mode</th>
                      <th>Référence</th>
                      <th style={{ textAlign: 'right' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPaymentsForInvoice(selectedInvoice.id).map(p => (
                      <tr key={p.id}>
                        <td>{p.paymentDate}</td>
                        <td style={{ fontWeight: 600, color: '#6366F1' }}>{p.paymentNumber || `PAY-${p.id.slice(0, 6)}`}</td>
                        <td>{p.paymentMethod}</td>
                        <td style={{ color: 'var(--color-text-muted)' }}>{p.reference || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          {p.amount.toLocaleString('fr-FR')} FCFA
                        </td>
                      </tr>
                    ))}
                    {getPaymentsForInvoice(selectedInvoice.id).length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)' }}>
                          Aucun paiement enregistré à ce jour.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    const quote = getQuote(selectedInvoice.quoteId);
                    const client = getClient(selectedInvoice.clientId);
                    const payments = getPaymentsForInvoice(selectedInvoice.id);
                    const blob = generateInvoicePdf(selectedInvoice, client, quote, settings, payments);
                    downloadBlob(blob, `Facture_${selectedInvoice.invoiceNumber}.pdf`);
                  }}
                >
                  <Download size={16} /> Télécharger PDF
                </button>
                {getRemainingForInvoice(selectedInvoice) > 0 && (
                  <button
                    className="btn btn-secondary"
                    style={{ color: '#2563EB' }}
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenReminderModal(selectedInvoice);
                    }}
                  >
                    <Send size={16} /> Relancer Client
                  </button>
                )}
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => { setIsDetailModalOpen(false); setSelectedInvoice(null); }}
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ─── MODAL : ENREGISTRER UN PAIEMENT ─────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-content card" style={{ maxWidth: '520px', width: '100%', padding: '24px', borderRadius: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '8px', background: '#D1FAE5', color: '#059669', borderRadius: '8px' }}>
                  <CreditCard size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Enregistrer un Règlement
                </h3>
              </div>
              <button className="icon-button" onClick={() => setIsPaymentModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayment}>
              
              {/* Récap Facture */}
              <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Facture : <strong>{selectedInvoice.invoiceNumber}</strong></div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Client : <strong>{getClientName(selectedInvoice.clientId)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.9rem' }}>
                  <span>Montant facture : <strong>{selectedInvoice.totalAmount.toLocaleString('fr-FR')} FCFA</strong></span>
                  <span style={{ color: '#DC2626', fontWeight: 800 }}>Reste : {getRemainingForInvoice(selectedInvoice).toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>

              {/* Montant */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>
                  Montant encaissé (FCFA) *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    required
                    min="1"
                    max={getRemainingForInvoice(selectedInvoice)}
                    className="table-input"
                    style={{ flex: 1, fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}
                    value={payAmount}
                    onChange={e => setPayAmount(Number(e.target.value) || 0)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                    onClick={() => setPayAmount(getRemainingForInvoice(selectedInvoice))}
                  >
                    Solde total
                  </button>
                </div>
              </div>

              {/* Mode de règlement & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Mode de règlement *</label>
                  <select
                    className="table-input"
                    style={{ width: '100%' }}
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Virement bancaire">Virement bancaire</option>
                    <option value="Mobile Money">Mobile Money (Wave / OM / Moov / MTN)</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Carte bancaire">Carte bancaire</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Date du règlement *</label>
                  <input
                    type="date"
                    required
                    className="table-input"
                    style={{ width: '100%' }}
                    value={payDate}
                    onChange={e => setPayDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Référence */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Référence de transaction / N° Chèque / Reçu
                </label>
                <input
                  type="text"
                  placeholder="Ex: VIR-849204, CHQ-0029, Wave TX-99..."
                  className="table-input"
                  style={{ width: '100%' }}
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Commentaire / Observations</label>
                <input
                  type="text"
                  placeholder="Observations facultatives..."
                  className="table-input"
                  style={{ width: '100%' }}
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsPaymentModalOpen(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#059669', fontWeight: 700 }}
                >
                  Valider l'encaissement
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ─── MODAL : RELANCE CLIENT (IMPAYÉS) ────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isReminderModalOpen && selectedInvoice && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-content card" style={{ maxWidth: '520px', width: '100%', padding: '24px', borderRadius: '12px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ padding: '8px', background: '#EFF6FF', color: '#2563EB', borderRadius: '8px' }}>
                  <Send size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Relancer le Client pour Impayé
                </h3>
              </div>
              <button className="icon-button" onClick={() => setIsReminderModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', margin: '0 0 12px' }}>
                Envoyez un message de relance rapide au client <strong>{getClientName(selectedInvoice.clientId)}</strong> concernant la facture <strong>{selectedInvoice.invoiceNumber}</strong>.
              </p>

              <div style={{ background: '#FEF2F2', padding: '12px', borderRadius: '8px', border: '1px solid #FECACA', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#DC2626' }}>
                  Solde impayé : {getRemainingForInvoice(selectedInvoice).toLocaleString('fr-FR')} FCFA
                </div>
                <div style={{ fontSize: '0.8rem', color: '#991B1B', marginTop: '2px' }}>
                  Date d'échéance dépassée : {selectedInvoice.dueDate} (+{getDaysOverdue(selectedInvoice.dueDate)} jours)
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', background: '#25D366', fontWeight: 700 }}
                  onClick={() => handleSendWhatsAppReminder(selectedInvoice)}
                >
                  <MessageSquare size={18} />
                  Relancer par WhatsApp
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIsReminderModalOpen(false)}
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
