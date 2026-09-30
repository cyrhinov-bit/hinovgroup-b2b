import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Upload,
  FileSpreadsheet,
  RefreshCw,
  Share2,
  ChevronRight,
  ShieldCheck,
  Briefcase,
  Layers,
  HelpCircle
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAppContext } from '../context/AppContext';
import type { Quote, QuoteLine } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { generateInvoicePdf, downloadBlob } from '../lib/pdfUtils';
import type { Invoice, InvoiceItem, InvoicePayment, InvoiceStatus } from '../types/crmModules';
import toast from 'react-hot-toast';

const MONTH_NAMES = [
  { num: 1, name: 'Janvier', short: 'Jan' },
  { num: 2, name: 'Février', short: 'Fév' },
  { num: 3, name: 'Mars', short: 'Mar' },
  { num: 4, name: 'Avril', short: 'Avr' },
  { num: 5, name: 'Mai', short: 'Mai' },
  { num: 6, name: 'Juin', short: 'Juin' },
  { num: 7, name: 'Juillet', short: 'Juil' },
  { num: 8, name: 'Août', short: 'Août' },
  { num: 9, name: 'Septembre', short: 'Sept' },
  { num: 10, name: 'Octobre', short: 'Oct' },
  { num: 11, name: 'Novembre', short: 'Nov' },
  { num: 12, name: 'Décembre', short: 'Déc' },
];

const PREDEFINED_SERVICES = [
  'INFORMATIQUE',
  'IMPRIMERIE',
  'ÉVÉNEMENTIEL',
  'MAINTENANCE',
  'BTP & LOGISTIQUE',
  'FOURNITURES',
  'AUTRE'
];

export function Factures() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser: authUser } = useAuth();
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

  const currentUser = users.find(u => u.id === authUser?.id) || authUser;
  const { confirm } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Période de suivi (Année & Mois)
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // Défaut Septembre (9) pour correspondre au fichier suivi

  // Filtres & Recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [commercialFilter, setCommercialFilter] = useState<string>('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Form State for Invoice / Tracking row
  const [formQuoteId, setFormQuoteId] = useState<string>('');
  const [formClientId, setFormClientId] = useState<string>('');
  const [formClientName, setFormClientName] = useState<string>('');
  const [formCommercialId, setFormCommercialId] = useState<string>('');
  const [formCommercialName, setFormCommercialName] = useState<string>('');
  const [formServiceId, setFormServiceId] = useState<string>('');
  const [formServiceName, setFormServiceName] = useState<string>('INFORMATIQUE');
  const [formCategory, setFormCategory] = useState<string>('');
  const [formDeliveryDate, setFormDeliveryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formPaymentDate, setFormPaymentDate] = useState<string>('');
  const [formAmountToPay, setFormAmountToPay] = useState<number>(0);
  const [formAmountUsed, setFormAmountUsed] = useState<number>(0);
  const [formCommissionRate, setFormCommissionRate] = useState<number>(10);
  const [formAmountPaid, setFormAmountPaid] = useState<number>(0);
  const [formNotes, setFormNotes] = useState<string>('');

  // Form State for Payment Modal
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<string>('Espèces');
  const [payRef, setPayRef] = useState<string>('');
  const [payNotes, setPayNotes] = useState<string>('');

  const isDirector = currentUser?.role === 'Directeur' || currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Directeur adjoint';
  const isResponsable = currentUser?.role === 'Responsable';

  // Helper functions
  const getClient = (id?: string) => clients.find(c => c.id === id);
  const getClientDisplayName = (inv: Invoice) => {
    if (inv.clientName) return inv.clientName;
    if (inv.clientId) {
      const c = getClient(inv.clientId);
      return c?.company || c?.name || 'Client';
    }
    return inv.notes?.split(' - ')[0] || 'Client divers';
  };

  const getCommercialDisplayName = (inv: Invoice) => {
    if (inv.commercialName) return inv.commercialName;
    if (inv.commercialId) {
      const u = users.find(user => user.id === inv.commercialId);
      return u?.name || 'Commercial';
    }
    return '-';
  };

  const getServiceDisplayName = (inv: Invoice) => {
    if (inv.serviceName) return inv.serviceName;
    if (inv.serviceId) {
      const s = services.find(srv => srv.id === inv.serviceId);
      return s?.name || '-';
    }
    return 'GÉNÉRAL';
  };

  // Live calculations for Form
  const formGrossMargin = useMemo(() => {
    return Math.max(0, formAmountToPay - formAmountUsed);
  }, [formAmountToPay, formAmountUsed]);

  const formCommissionAmount = useMemo(() => {
    if (!formCommercialName && !formCommercialId) return 0;
    return formGrossMargin > 0 ? Math.round(formGrossMargin * (formCommissionRate / 100)) : 0;
  }, [formGrossMargin, formCommissionRate, formCommercialName, formCommercialId]);

  const formHinovMargin = useMemo(() => {
    return formGrossMargin - formCommissionAmount;
  }, [formGrossMargin, formCommissionAmount]);

  const formRemainingAmount = useMemo(() => {
    return Math.max(0, formAmountToPay - formAmountPaid);
  }, [formAmountToPay, formAmountPaid]);

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
    const client = clients.find(c => c.id === quote.clientId);
    setFormClientName(client?.company || client?.name || '');
    setFormCommercialId(quote.commercialId || currentUser?.id || '');
    const comm = users.find(u => u.id === (quote.commercialId || currentUser?.id));
    setFormCommercialName(comm?.name || '');
    setFormServiceId(quote.serviceId || '');
    const srv = services.find(s => s.id === quote.serviceId);
    setFormServiceName(srv?.name || 'INFORMATIQUE');
    setFormCategory(quote.lines?.[0]?.description || '');
    const today = new Date().toISOString().split('T')[0];
    setFormDeliveryDate(today);
    setFormPaymentDate('');
    setFormAmountToPay(quote.total || 0);
    const estimatedCost = (quote.lines || []).reduce((sum, l) => sum + ((l.costPrice || 0) * (l.quantity || 1)), 0);
    setFormAmountUsed(estimatedCost);
    setFormCommissionRate(10);
    setFormAmountPaid(0);
    setFormNotes(quote.notes || `Devis N° ${quote.quoteNumber}`);
    setIsCreateModalOpen(true);
  };

  const handleOpenNewTrackingRow = () => {
    setEditingInvoiceId(null);
    setFormQuoteId('');
    setFormClientId('');
    setFormClientName('');
    setFormCommercialId(currentUser?.id || '');
    setFormCommercialName(currentUser?.name || '');
    setFormServiceId(currentUser?.serviceId || '');
    const currentSrv = services.find(s => s.id === currentUser?.serviceId);
    setFormServiceName(currentSrv?.name || 'INFORMATIQUE');
    setFormCategory('');
    const defaultDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
    setFormDeliveryDate(defaultDate);
    setFormPaymentDate('');
    setFormAmountToPay(0);
    setFormAmountUsed(0);
    setFormCommissionRate(10);
    setFormAmountPaid(0);
    setFormNotes('');
    setIsCreateModalOpen(true);
  };

  const handleEditTrackingRow = (inv: Invoice) => {
    setEditingInvoiceId(inv.id);
    setFormQuoteId(inv.quoteId || '');
    setFormClientId(inv.clientId || '');
    setFormClientName(getClientDisplayName(inv));
    setFormCommercialId(inv.commercialId || '');
    setFormCommercialName(getCommercialDisplayName(inv));
    setFormServiceId(inv.serviceId || '');
    setFormServiceName(getServiceDisplayName(inv));
    setFormCategory(inv.category || '');
    setFormDeliveryDate(inv.deliveryDate || inv.issueDate || new Date().toISOString().split('T')[0]);
    setFormPaymentDate(inv.paymentDate || '');
    setFormAmountToPay(inv.totalAmount || 0);
    setFormAmountUsed(inv.costAmount || 0);
    setFormCommissionRate(inv.commissionRate ?? 10);
    setFormAmountPaid(inv.amountPaid ?? 0);
    setFormNotes(inv.notes || '');
    setIsCreateModalOpen(true);
  };

  // Enregistrement / Mise à jour d'une ligne de suivi
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formClientName.trim()) {
      toast.error('Veuillez renseigner le Client / Affaire.');
      return;
    }

    if (formAmountToPay <= 0) {
      toast.error('Le montant à payer doit être supérieur à zéro.');
      return;
    }

    const deliveryDateObj = new Date(formDeliveryDate || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`);
    const periodYear = !isNaN(deliveryDateObj.getFullYear()) ? deliveryDateObj.getFullYear() : selectedYear;
    const periodMonth = !isNaN(deliveryDateObj.getMonth()) ? deliveryDateObj.getMonth() + 1 : selectedMonth;

    const grossMargin = Math.max(0, formAmountToPay - formAmountUsed);
    const commissionAmount = (formCommercialName || formCommercialId) && grossMargin > 0
      ? Math.round(grossMargin * (formCommissionRate / 100))
      : 0;
    const hinovMargin = grossMargin - commissionAmount;
    const remainingAmount = Math.max(0, formAmountToPay - formAmountPaid);

    const invoiceNumber = editingInvoiceId 
      ? (invoices.find(i => i.id === editingInvoiceId)?.invoiceNumber || `FAC-${periodYear}-${String(periodMonth).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`)
      : `FAC-${periodYear}-${String(periodMonth).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const invoicePayload: Partial<Invoice> = {
      invoiceNumber,
      quoteId: formQuoteId || undefined,
      clientId: formClientId || undefined,
      clientName: formClientName.trim(),
      commercialId: formCommercialId || undefined,
      commercialName: formCommercialName.trim() || undefined,
      serviceId: formServiceId || undefined,
      serviceName: formServiceName.trim() || 'INFORMATIQUE',
      category: formCategory.trim() || undefined,
      periodYear,
      periodMonth,
      deliveryDate: formDeliveryDate,
      issueDate: formDeliveryDate,
      paymentDate: formPaymentDate || undefined,
      dueDate: formDeliveryDate,
      paymentTerms: '30 jours',
      subtotal: formAmountToPay,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: formAmountToPay,
      costAmount: formAmountUsed,
      commissionRate: formCommissionRate,
      commissionAmount,
      grossMargin,
      hinovMargin,
      amountPaid: formAmountPaid,
      remainingAmount,
      status: remainingAmount === 0 ? 'PAYÉE' : (formAmountPaid > 0 ? 'PARTIELLEMENT_PAYÉE' : 'ÉMISE'),
      notes: formNotes || undefined,
      createdBy: currentUser?.id
    };

    try {
      if (editingInvoiceId) {
        await updateInvoice(editingInvoiceId, invoicePayload);
        toast.success(`Ligne mise à jour avec succès !`);
      } else {
        await addInvoice(invoicePayload as Invoice);
        toast.success(`Facture / Suivi ajouté avec succès pour ${MONTH_NAMES[periodMonth - 1]?.name} ${periodYear} !`);
      }

      setIsCreateModalOpen(false);
      setEditingInvoiceId(null);
    } catch (err) {
      console.error('Erreur sauvegarde suivi:', err);
      toast.error('Une erreur est survenue lors de l\'enregistrement.');
    }
  };

  // Suppression
  const handleDelete = (inv: Invoice) => {
    confirm({
      title: 'Supprimer cette facture du suivi ?',
      message: `Êtes-vous sûr de vouloir supprimer la facture pour le client "${getClientDisplayName(inv)}" (Montant : ${inv.totalAmount.toLocaleString('fr-FR')} FCFA) ?`,
      confirmLabel: 'Supprimer définitivement',
      cancelLabel: 'Annuler',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteInvoice(inv.id);
          toast.success('Ligne supprimée du registre.');
        } catch (err) {
          toast.error('Erreur lors de la suppression.');
        }
      }
    });
  };

  // Paiement Modal
  const handleOpenPaymentModal = (inv: Invoice) => {
    setSelectedInvoice(inv);
    const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, inv.totalAmount - (inv.amountPaid || 0));
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
      toast.error('Veuillez saisir un montant supérieur à zéro.');
      return;
    }

    const currentPaid = selectedInvoice.amountPaid || 0;
    const newPaid = currentPaid + payAmount;
    const newRemaining = Math.max(0, selectedInvoice.totalAmount - newPaid);

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

      await updateInvoice(selectedInvoice.id, {
        amountPaid: newPaid,
        remainingAmount: newRemaining,
        paymentDate: payDate,
        status: newRemaining === 0 ? 'PAYÉE' : 'PARTIELLEMENT_PAYÉE'
      });

      toast.success(`Paiement de ${payAmount.toLocaleString('fr-FR')} FCFA enregistré !`);
      setIsPaymentModalOpen(false);
      setSelectedInvoice(null);
    } catch (err) {
      console.error('Erreur paiement:', err);
      toast.error('Erreur lors de l\'enregistrement du règlement.');
    }
  };

  // WhatsApp Relance
  const handleOpenReminder = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setIsReminderModalOpen(true);
  };

  const handleSendWhatsApp = (inv: Invoice) => {
    const client = clients.find(c => c.id === inv.clientId) || clients.find(c => c.name.toLowerCase() === (inv.clientName || '').toLowerCase());
    const phone = client?.phone || '';
    if (!phone) {
      toast.error('Aucun numéro de téléphone enregistré pour ce client. Renseignez-le dans le module Clients.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, inv.totalAmount - (inv.amountPaid || 0));
    const message = `Bonjour ${getClientDisplayName(inv)},\n\nNous vous contactons au sujet du suivi de votre facture pour les prestations (${inv.serviceName || 'HINOV'} - ${inv.category || 'Prestation'}).\nMontant restant à régler : ${remaining.toLocaleString('fr-FR')} FCFA.\nDate de livraison : ${inv.deliveryDate || '-'}.\n\nMerci de bien vouloir procéder au règlement.\nCordialement,\n${settings.companyName || 'HINOV SARL'}`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Import Excel (.xlsx) handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        
        let importedCount = 0;

        // Process each sheet (e.g. SEPTEMBRE, OCTOBRE, etc.)
        for (const sheetName of wb.SheetNames) {
          const upperSheet = sheetName.trim().toUpperCase();
          const monthIdx = MONTH_NAMES.findIndex(m => upperSheet.includes(m.name.toUpperCase()));
          const periodMonth = monthIdx !== -1 ? monthIdx + 1 : selectedMonth;
          const periodYear = selectedYear;

          const ws = wb.Sheets[sheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });

          // Find header row or rows with client data
          for (let i = 0; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            // Check if row is header or total
            const col0 = String(row[0] || '').trim();
            const col0Upper = col0.toUpperCase();
            if (col0Upper.includes('CLIENT') || col0Upper.includes('TOTAL') || col0Upper === '' || col0Upper.includes('PAGE')) {
              continue;
            }

            const clientName = col0;
            const commercialName = String(row[1] || '').trim();
            
            // Format dates
            let deliveryDate = '';
            if (row[2] instanceof Date) {
              deliveryDate = row[2].toISOString().split('T')[0];
            } else if (typeof row[2] === 'string' && row[2].trim()) {
              deliveryDate = row[2].trim();
            } else {
              deliveryDate = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;
            }

            let paymentDate = '';
            if (row[3] instanceof Date) {
              paymentDate = row[3].toISOString().split('T')[0];
            } else if (typeof row[3] === 'string' && row[3].trim()) {
              paymentDate = row[3].trim();
            }

            const serviceName = String(row[4] || 'INFORMATIQUE').trim().toUpperCase();
            const category = String(row[5] || '').trim();
            const amountToPay = Number(row[6]) || 0;
            const amountUsed = Number(row[7]) || 0;
            const amountPaid = Number(row[11]) || 0;

            if (amountToPay > 0 || clientName.length > 1) {
              const grossMargin = Math.max(0, amountToPay - amountUsed);
              const commissionAmount = commercialName ? Math.round(grossMargin * 0.1) : 0;
              const hinovMargin = grossMargin - commissionAmount;
              const remainingAmount = Math.max(0, amountToPay - amountPaid);

              await addInvoice({
                invoiceNumber: `FAC-${periodYear}-${String(periodMonth).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
                clientName,
                commercialName: commercialName || undefined,
                serviceName: serviceName || 'INFORMATIQUE',
                category: category || undefined,
                periodYear,
                periodMonth,
                deliveryDate,
                issueDate: deliveryDate,
                paymentDate: paymentDate || undefined,
                dueDate: deliveryDate,
                paymentTerms: '30 jours',
                subtotal: amountToPay,
                taxAmount: 0,
                discountAmount: 0,
                totalAmount: amountToPay,
                costAmount: amountUsed,
                commissionRate: 10,
                commissionAmount,
                grossMargin,
                hinovMargin,
                amountPaid,
                remainingAmount,
                status: remainingAmount === 0 && amountToPay > 0 ? 'PAYÉE' : (amountPaid > 0 ? 'PARTIELLEMENT_PAYÉE' : 'ÉMISE'),
                createdBy: currentUser?.id
              } as Invoice);

              importedCount++;
            }
          }
        }

        toast.success(`Importation réussie : ${importedCount} factures ajoutées au registre !`);
        setIsImportModalOpen(false);
      } catch (err) {
        console.error('Erreur import Excel:', err);
        toast.error('Erreur lors de la lecture du fichier Excel.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Quick Seed Septembre 2026 if empty
  const handleSeedSeptembre2026 = async () => {
    const defaultData = [
      {
        clientName: 'CORIS',
        commercialName: 'BOSSO',
        deliveryDate: '2026-09-14',
        paymentDate: '',
        serviceName: 'INFORMATIQUE',
        category: 'CARTOUCHE',
        amountToPay: 670000,
        amountUsed: 502000,
        amountPaid: 0
      },
      {
        clientName: 'MEDLOG',
        commercialName: '',
        deliveryDate: '2026-09-15',
        paymentDate: '',
        serviceName: 'INFORMATIQUE',
        category: 'CASQUE',
        amountToPay: 255000,
        amountUsed: 180000,
        amountPaid: 0
      },
      {
        clientName: 'MEHI',
        commercialName: '',
        deliveryDate: '2026-09-18',
        paymentDate: '',
        serviceName: 'IMPRIMERIE',
        category: 'MACARON',
        amountToPay: 150000,
        amountUsed: 75000,
        amountPaid: 0
      }
    ];

    try {
      for (const item of defaultData) {
        const grossMargin = Math.max(0, item.amountToPay - item.amountUsed);
        const commissionAmount = item.commercialName ? Math.round(grossMargin * 0.1) : 0;
        const hinovMargin = grossMargin - commissionAmount;
        const remainingAmount = Math.max(0, item.amountToPay - item.amountPaid);

        await addInvoice({
          invoiceNumber: `FAC-2026-09-${Math.floor(1000 + Math.random() * 9000)}`,
          clientName: item.clientName,
          commercialName: item.commercialName || undefined,
          serviceName: item.serviceName,
          category: item.category,
          periodYear: 2026,
          periodMonth: 9,
          deliveryDate: item.deliveryDate,
          issueDate: item.deliveryDate,
          dueDate: item.deliveryDate,
          paymentTerms: '30 jours',
          subtotal: item.amountToPay,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: item.amountToPay,
          costAmount: item.amountUsed,
          commissionRate: 10,
          commissionAmount,
          grossMargin,
          hinovMargin,
          amountPaid: item.amountPaid,
          remainingAmount,
          status: 'ÉMISE',
          createdBy: currentUser?.id
        } as Invoice);
      }
      setSelectedYear(2026);
      setSelectedMonth(9);
      toast.success('Données de référence Septembre 2026 importées avec succès !');
    } catch (err) {
      toast.error('Erreur lors de l\'initialisation.');
    }
  };

  // Export to Excel 13-columns
  const handleExportExcel = () => {
    const monthLabel = MONTH_NAMES.find(m => m.num === selectedMonth)?.name || `Mois_${selectedMonth}`;
    const fileName = `SUIVI_FACTURES_CLIENTS_${monthLabel.toUpperCase()}_${selectedYear}.xlsx`;

    const headers = [
      'CLIENT/AFFAIRES',
      'COMMERCIAL',
      'DATE LIVRAISON',
      'DATE DE PAYEMENT',
      'SERVICE',
      'CATEGORIE',
      'MONTANT À PAYER',
      'MONTANT UTILISÉ',
      'MARGE AVEC PRIME',
      'PRIME 10%',
      'MARGE HINOV',
      'PAYÉ',
      'RESTE'
    ];

    const rows = filteredInvoices.map(inv => [
      getClientDisplayName(inv),
      getCommercialDisplayName(inv),
      inv.deliveryDate || '-',
      inv.paymentDate || '-',
      getServiceDisplayName(inv),
      inv.category || '-',
      inv.totalAmount || 0,
      inv.costAmount || 0,
      inv.grossMargin || (inv.totalAmount - (inv.costAmount || 0)),
      inv.commissionAmount || 0,
      inv.hinovMargin || 0,
      inv.amountPaid || 0,
      inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, inv.totalAmount - (inv.amountPaid || 0))
    ]);

    // Add Total Row
    rows.push([
      'TOTAL DU MOIS',
      '',
      '',
      '',
      '',
      '',
      monthlyTotals.totalToPay,
      monthlyTotals.totalUsed,
      monthlyTotals.totalGrossMargin,
      monthlyTotals.totalCommission,
      monthlyTotals.totalHinovMargin,
      monthlyTotals.totalPaid,
      monthlyTotals.totalRemaining
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, monthLabel.toUpperCase());
    XLSX.writeFile(wb, fileName);
    toast.success(`Export Excel généré : ${fileName}`);
  };

  // Filtering for current period
  const allowedInvoices = useMemo(() => {
    if (isDirector) return invoices;
    if (isResponsable) {
      return invoices.filter(i => i.serviceId === currentUser?.serviceId || i.commercialId === currentUser?.id);
    }
    return invoices.filter(i => i.commercialId === currentUser?.id);
  }, [invoices, isDirector, isResponsable, currentUser]);

  const monthInvoices = useMemo(() => {
    return allowedInvoices.filter(inv => {
      const year = inv.periodYear || (inv.deliveryDate ? new Date(inv.deliveryDate).getFullYear() : (inv.issueDate ? new Date(inv.issueDate).getFullYear() : 2026));
      const month = inv.periodMonth || (inv.deliveryDate ? new Date(inv.deliveryDate).getMonth() + 1 : (inv.issueDate ? new Date(inv.issueDate).getMonth() + 1 : 9));
      return year === selectedYear && month === selectedMonth;
    });
  }, [allowedInvoices, selectedYear, selectedMonth]);

  const filteredInvoices = useMemo(() => {
    return monthInvoices.filter(inv => {
      const clientName = getClientDisplayName(inv).toLowerCase();
      const commercial = getCommercialDisplayName(inv).toLowerCase();
      const srv = getServiceDisplayName(inv).toLowerCase();
      const cat = (inv.category || '').toLowerCase();
      const num = (inv.invoiceNumber || '').toLowerCase();

      // Search
      const matchSearch = !searchTerm || 
        clientName.includes(searchTerm.toLowerCase()) ||
        commercial.includes(searchTerm.toLowerCase()) ||
        srv.includes(searchTerm.toLowerCase()) ||
        cat.includes(searchTerm.toLowerCase()) ||
        num.includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      // Status
      const rem = inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, inv.totalAmount - (inv.amountPaid || 0));
      const isPaid = rem === 0 && inv.totalAmount > 0;
      const isPartial = rem > 0 && (inv.amountPaid || 0) > 0;
      const isUnpaid = (inv.amountPaid || 0) === 0;

      if (statusFilter === 'PAID' && !isPaid) return false;
      if (statusFilter === 'PARTIAL' && !isPartial) return false;
      if (statusFilter === 'UNPAID' && !isUnpaid) return false;

      // Service
      if (serviceFilter && inv.serviceName !== serviceFilter && inv.serviceId !== serviceFilter) return false;

      // Commercial
      if (commercialFilter && inv.commercialName !== commercialFilter && inv.commercialId !== commercialFilter) return false;

      return true;
    });
  }, [monthInvoices, searchTerm, statusFilter, serviceFilter, commercialFilter, clients, users, services]);

  // Monthly KPI and Table Totals calculation
  const monthlyTotals = useMemo(() => {
    let totalToPay = 0;
    let totalUsed = 0;
    let totalGrossMargin = 0;
    let totalCommission = 0;
    let totalHinovMargin = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    filteredInvoices.forEach(inv => {
      const toPay = inv.totalAmount || 0;
      const used = inv.costAmount || 0;
      const grossMargin = inv.grossMargin !== undefined ? inv.grossMargin : Math.max(0, toPay - used);
      const commission = inv.commissionAmount !== undefined ? inv.commissionAmount : (inv.commercialName || inv.commercialId ? Math.round(grossMargin * 0.1) : 0);
      const hinovMargin = inv.hinovMargin !== undefined ? inv.hinovMargin : (grossMargin - commission);
      const paid = inv.amountPaid || 0;
      const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, toPay - paid);

      totalToPay += toPay;
      totalUsed += used;
      totalGrossMargin += grossMargin;
      totalCommission += commission;
      totalHinovMargin += hinovMargin;
      totalPaid += paid;
      totalRemaining += remaining;
    });

    const marginRate = totalToPay > 0 ? ((totalGrossMargin / totalToPay) * 100).toFixed(1) : '0';
    const recoveryRate = totalToPay > 0 ? ((totalPaid / totalToPay) * 100).toFixed(1) : '0';

    return {
      totalToPay,
      totalUsed,
      totalGrossMargin,
      totalCommission,
      totalHinovMargin,
      totalPaid,
      totalRemaining,
      marginRate,
      recoveryRate
    };
  }, [filteredInvoices]);

  const selectedMonthName = MONTH_NAMES.find(m => m.num === selectedMonth)?.name || 'Septembre';

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6">
      
      {/* ─── HEADER & PERIODE SELECTOR ─────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Suivi des Factures Clients
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Registre Mensuel
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Suivi de la rentabilité, coûts engagés, marges HINOV, primes et règlements par mois
              </p>
            </div>
          </div>
        </div>

        {/* Actions principales */}
        <div className="flex flex-wrap items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-all shadow-xs"
            title="Importer un fichier Excel de suivi"
          >
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Importer Excel</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-xs"
            title="Exporter le registre mensuel en Excel"
          >
            <Download className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Exporter Excel</span>
          </button>

          <button
            onClick={handleOpenNewTrackingRow}
            className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/25 transition-all transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Ajouter une facture</span>
          </button>
        </div>
      </div>

      {/* ─── SÉLECTEUR D'ANNÉE ET ONGLETS MENSUELS ───────────────── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Année d'exercice :</span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {[2024, 2025, 2026, 2027].map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  className={`px-3 py-1 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                    selectedYear === yr
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {monthInvoices.length === 0 && selectedYear === 2026 && selectedMonth === 9 && (
            <button
              onClick={handleSeedSeptembre2026}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              <span>Charger les données de Septembre 2026</span>
            </button>
          )}
        </div>

        {/* 12 Onglets Mensuels */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
          {MONTH_NAMES.map(m => {
            const isSelected = selectedMonth === m.num;
            const countInMonth = allowedInvoices.filter(i => {
              const y = i.periodYear || (i.deliveryDate ? new Date(i.deliveryDate).getFullYear() : 2026);
              const mon = i.periodMonth || (i.deliveryDate ? new Date(i.deliveryDate).getMonth() + 1 : 9);
              return y === selectedYear && mon === m.num;
            }).length;

            return (
              <button
                key={m.num}
                onClick={() => setSelectedMonth(m.num)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all border text-center relative ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                    : 'bg-slate-50/50 dark:bg-slate-800/30 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-200'
                }`}
              >
                <span className="text-xs uppercase tracking-tight font-semibold">{m.short}</span>
                <span className={`text-[10px] mt-0.5 px-1.5 py-0.2 rounded-full font-medium ${
                  countInMonth > 0 
                    ? (isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300')
                    : 'text-slate-400'
                }`}>
                  {countInMonth > 0 ? `${countInMonth}` : '-'}
                </span>
                {isSelected && (
                  <span className="absolute -bottom-1 w-6 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 7 CARTES KPI DU MOIS SÉLECTIONNÉ ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* 1. Total à Payer */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total à Payer</span>
          <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
            {monthlyTotals.totalToPay.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-slate-400">FCFA</span>
          </p>
          <div className="mt-1 flex items-center text-[10px] text-slate-500 font-medium">
            <span>{filteredInvoices.length} dossier(s)</span>
          </div>
        </div>

        {/* 2. Total Utilisé (Coût) */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Montant Utilisé</span>
          <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 truncate">
            {monthlyTotals.totalUsed.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-slate-400">FCFA</span>
          </p>
          <div className="mt-1 flex items-center text-[10px] text-amber-600/80 font-medium">
            <span>Coûts engagés</span>
          </div>
        </div>

        {/* 3. Marge Brute */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-950/50 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">Marge Brute</span>
          <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 truncate">
            {monthlyTotals.totalGrossMargin.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-emerald-600/70">FCFA</span>
          </p>
          <div className="mt-1 flex items-center text-[10px] font-bold text-emerald-600">
            <span>Taux marge : {monthlyTotals.marginRate}%</span>
          </div>
        </div>

        {/* 4. Prime 10% */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-purple-100 dark:border-purple-950/50 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block mb-1">Prime (10%)</span>
          <p className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400 truncate">
            {monthlyTotals.totalCommission.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-slate-400">FCFA</span>
          </p>
          <div className="mt-1 flex items-center text-[10px] text-purple-500 font-medium">
            <span>Commerciaux</span>
          </div>
        </div>

        {/* 5. Marge Nette HINOV */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block mb-1">Marge HINOV</span>
          <p className="text-base sm:text-lg font-black text-blue-700 dark:text-blue-300 truncate">
            {monthlyTotals.totalHinovMargin.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-blue-400">FCFA</span>
          </p>
          <div className="mt-1 flex items-center text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
            <span>Bénéfice Net HINOV</span>
          </div>
        </div>

        {/* 6. Total Payé */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Payé</span>
          <p className="text-base sm:text-lg font-black text-teal-600 dark:text-teal-400 truncate">
            {monthlyTotals.totalPaid.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-slate-400">FCFA</span>
          </p>
          <div className="mt-1 flex items-center text-[10px] text-teal-600 font-medium">
            <span>Recouvré : {monthlyTotals.recoveryRate}%</span>
          </div>
        </div>

        {/* 7. Total Reste */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-rose-100 dark:border-rose-950/50 bg-rose-50/20 dark:bg-rose-950/10 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-1">Reste à Payer</span>
          <p className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 truncate">
            {monthlyTotals.totalRemaining.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-rose-400">FCFA</span>
          </p>
          <div className="mt-1 flex items-center text-[10px] font-bold text-rose-500">
            <span>À recouvrer</span>
          </div>
        </div>
      </div>

      {/* ─── FILTRES & BARRE DE RECHERCHE ───────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher client, service, catégorie..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Filtre Statut de paiement */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="PAID">Totalement Payé</option>
            <option value="PARTIAL">Partiellement Payé</option>
            <option value="UNPAID">Non Payé (En attente)</option>
          </select>

          {/* Filtre Service */}
          <select
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none"
          >
            <option value="">Tous les services</option>
            {PREDEFINED_SERVICES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Filtre Commercial */}
          <select
            value={commercialFilter}
            onChange={e => setCommercialFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none"
          >
            <option value="">Tous les commerciaux</option>
            {users.map(u => (
              <option key={u.id} value={u.name}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── TABLEAU DU SUIVI MENSUEL (13 COLONNES CONFORMES EXCEL) ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
              Registre : {selectedMonthName} {selectedYear}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
              {filteredInvoices.length} ligne(s)
            </span>
          </div>

          <span className="text-xs text-slate-400">
            Période : {selectedMonthName.toUpperCase()} {selectedYear}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3 min-w-[140px]">CLIENT / AFFAIRES</th>
                <th className="py-3 px-2 min-w-[100px]">COMMERCIAL</th>
                <th className="py-3 px-2 min-w-[95px]">DATE LIVR.</th>
                <th className="py-3 px-2 min-w-[95px]">DATE PAIEM.</th>
                <th className="py-3 px-2 min-w-[100px]">SERVICE</th>
                <th className="py-3 px-2 min-w-[100px]">CATÉGORIE</th>
                <th className="py-3 px-3 min-w-[110px] text-right">MONTANT À PAYER</th>
                <th className="py-3 px-3 min-w-[105px] text-right">MONTANT UTILISÉ</th>
                <th className="py-3 px-3 min-w-[105px] text-right text-emerald-600">MARGE</th>
                <th className="py-3 px-2 min-w-[85px] text-right text-purple-600">PRIME 10%</th>
                <th className="py-3 px-3 min-w-[105px] text-right text-blue-600">MARGE HINOV</th>
                <th className="py-3 px-3 min-w-[95px] text-right text-teal-600">PAYÉ</th>
                <th className="py-3 px-3 min-w-[105px] text-right text-rose-600">RESTE</th>
                <th className="py-3 px-2 min-w-[70px] text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">Aucune facture enregistrée pour {selectedMonthName} {selectedYear}</p>
                    <p className="text-xs mt-1">Cliquez sur « + Ajouter une facture » ou « Importer Excel » pour commencer.</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(inv => {
                  const clientName = getClientDisplayName(inv);
                  const commercialName = getCommercialDisplayName(inv);
                  const serviceName = getServiceDisplayName(inv);
                  const toPay = inv.totalAmount || 0;
                  const used = inv.costAmount || 0;
                  const grossMargin = inv.grossMargin !== undefined ? inv.grossMargin : Math.max(0, toPay - used);
                  const commission = inv.commissionAmount !== undefined ? inv.commissionAmount : (commercialName !== '-' ? Math.round(grossMargin * 0.1) : 0);
                  const hinovMargin = inv.hinovMargin !== undefined ? inv.hinovMargin : (grossMargin - commission);
                  const paid = inv.amountPaid || 0;
                  const remaining = inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, toPay - paid);

                  const isFullyPaid = remaining === 0 && toPay > 0;
                  const isPartiallyPaid = remaining > 0 && paid > 0;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* 1. Client / Affaires */}
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="truncate max-w-[150px]">{clientName}</span>
                        </div>
                        {inv.quoteId && (
                          <span className="text-[10px] text-blue-500 hover:underline block font-normal">
                            Devis lié
                          </span>
                        )}
                      </td>

                      {/* 2. Commercial */}
                      <td className="py-3 px-2 text-slate-700 dark:text-slate-300 font-medium">
                        {commercialName}
                      </td>

                      {/* 3. Date Livraison */}
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {inv.deliveryDate || '-'}
                      </td>

                      {/* 4. Date Paiement */}
                      <td className="py-3 px-2 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {inv.paymentDate || '-'}
                      </td>

                      {/* 5. Service */}
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                          {serviceName}
                        </span>
                      </td>

                      {/* 6. Catégorie */}
                      <td className="py-3 px-2 text-slate-700 dark:text-slate-300">
                        <span className="truncate max-w-[120px] block" title={inv.category}>
                          {inv.category || '-'}
                        </span>
                      </td>

                      {/* 7. Montant à payer */}
                      <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white">
                        {toPay.toLocaleString('fr-FR')}
                      </td>

                      {/* 8. Montant utilisé */}
                      <td className="py-3 px-3 text-right font-semibold text-amber-600 dark:text-amber-400">
                        {used.toLocaleString('fr-FR')}
                      </td>

                      {/* 9. Marge Brute */}
                      <td className="py-3 px-3 text-right font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/10">
                        {grossMargin.toLocaleString('fr-FR')}
                      </td>

                      {/* 10. Prime 10% */}
                      <td className="py-3 px-2 text-right font-semibold text-purple-600 dark:text-purple-400">
                        {commission.toLocaleString('fr-FR')}
                      </td>

                      {/* 11. Marge HINOV */}
                      <td className="py-3 px-3 text-right font-black text-blue-700 dark:text-blue-300 bg-blue-50/20">
                        {hinovMargin.toLocaleString('fr-FR')}
                      </td>

                      {/* 12. Payé */}
                      <td className="py-3 px-3 text-right font-semibold text-teal-600 dark:text-teal-400">
                        {paid.toLocaleString('fr-FR')}
                      </td>

                      {/* 13. Reste */}
                      <td className="py-3 px-3 text-right font-black">
                        <div className="flex flex-col items-end">
                          <span className={remaining === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {remaining.toLocaleString('fr-FR')}
                          </span>
                          <span className={`text-[9px] px-1 rounded font-bold ${
                            isFullyPaid 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : (isPartiallyPaid ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')
                          }`}>
                            {isFullyPaid ? 'PAYÉ' : (isPartiallyPaid ? 'PARTIEL' : 'NON PAYÉ')}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {remaining > 0 && (
                            <button
                              onClick={() => handleOpenPaymentModal(inv)}
                              className="p-1.5 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/50 rounded-lg transition-colors"
                              title="Enregistrer un règlement"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {remaining > 0 && (
                            <button
                              onClick={() => handleSendWhatsApp(inv)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                              title="Relance WhatsApp"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditTrackingRow(inv)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(inv)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* ─── LIGNE DE TOTAL DU MOIS (FOOTER STRICT CONFORME EXCEL) ─── */}
            {filteredInvoices.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-black text-xs border-t-2 border-slate-300 dark:border-slate-700">
                  <td colSpan={6} className="py-3 px-3 text-left uppercase tracking-wider font-extrabold text-blue-800 dark:text-blue-300">
                    TOTAL DU MOIS ({selectedMonthName.toUpperCase()} {selectedYear})
                  </td>
                  {/* Total à payer */}
                  <td className="py-3 px-3 text-right text-slate-900 dark:text-white font-black">
                    {monthlyTotals.totalToPay.toLocaleString('fr-FR')}
                  </td>
                  {/* Total utilisé */}
                  <td className="py-3 px-3 text-right text-amber-600 dark:text-amber-400 font-black">
                    {monthlyTotals.totalUsed.toLocaleString('fr-FR')}
                  </td>
                  {/* Total marge brute */}
                  <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 font-black bg-emerald-100/40 dark:bg-emerald-950/40">
                    {monthlyTotals.totalGrossMargin.toLocaleString('fr-FR')}
                  </td>
                  {/* Total prime */}
                  <td className="py-3 px-2 text-right text-purple-600 dark:text-purple-400 font-black">
                    {monthlyTotals.totalCommission.toLocaleString('fr-FR')}
                  </td>
                  {/* Total marge HINOV */}
                  <td className="py-3 px-3 text-right text-blue-700 dark:text-blue-300 font-black bg-blue-100/40 dark:bg-blue-950/40">
                    {monthlyTotals.totalHinovMargin.toLocaleString('fr-FR')}
                  </td>
                  {/* Total payé */}
                  <td className="py-3 px-3 text-right text-teal-600 dark:text-teal-400 font-black">
                    {monthlyTotals.totalPaid.toLocaleString('fr-FR')}
                  </td>
                  {/* Total reste */}
                  <td className="py-3 px-3 text-right text-rose-600 dark:text-rose-400 font-black">
                    {monthlyTotals.totalRemaining.toLocaleString('fr-FR')}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ─── MODAL D'AJOUT / MODIFICATION DE LIGNE DE SUIVI ───────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingInvoiceId ? 'Modifier la ligne de suivi' : 'Ajouter une facture au suivi'}
                </h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="p-6 space-y-5">
              
              {/* Client & Commercial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Client / Affaires *
                  </label>
                  <input
                    type="text"
                    required
                    list="clients-list"
                    value={formClientName}
                    onChange={e => {
                      setFormClientName(e.target.value);
                      const matching = clients.find(c => c.name.toLowerCase() === e.target.value.toLowerCase() || c.company.toLowerCase() === e.target.value.toLowerCase());
                      if (matching) {
                        setFormClientId(matching.id);
                        if (matching.commercialId) setFormCommercialId(matching.commercialId);
                      }
                    }}
                    placeholder="Ex: CORIS, MEDLOG, MEHI..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="clients-list">
                    {clients.map(c => (
                      <option key={c.id} value={c.company || c.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Commercial
                  </label>
                  <input
                    type="text"
                    list="commerciaux-list"
                    value={formCommercialName}
                    onChange={e => {
                      setFormCommercialName(e.target.value);
                      const matching = users.find(u => u.name.toLowerCase() === e.target.value.toLowerCase());
                      if (matching) setFormCommercialId(matching.id);
                    }}
                    placeholder="Ex: BOSSO, AKOSSI, DIALLO..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="commerciaux-list">
                    {users.map(u => (
                      <option key={u.id} value={u.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Service & Catégorie */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Service
                  </label>
                  <input
                    type="text"
                    list="services-list"
                    value={formServiceName}
                    onChange={e => setFormServiceName(e.target.value.toUpperCase())}
                    placeholder="INFORMATIQUE, IMPRIMERIE..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 uppercase font-semibold"
                  />
                  <datalist id="services-list">
                    {PREDEFINED_SERVICES.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Catégorie / Désignation
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    placeholder="Ex: CARTOUCHE, CASQUE, MACARON..."
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Date de Livraison *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDeliveryDate}
                    onChange={e => setFormDeliveryDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Date de Paiement (Optionnel)
                  </label>
                  <input
                    type="date"
                    value={formPaymentDate}
                    onChange={e => setFormPaymentDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Montants & Coûts */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
                      Montant à Payer (FCFA) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      required
                      value={formAmountToPay || ''}
                      onChange={e => setFormAmountToPay(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
                      Montant Utilisé / Coût (FCFA)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formAmountUsed || ''}
                      onChange={e => setFormAmountUsed(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">
                      Déjà Payé (FCFA)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formAmountPaid || ''}
                      onChange={e => setFormAmountPaid(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3.5 py-2 text-sm font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Calculs automatiques en temps réel */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-200 dark:border-slate-700 text-center">
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Marge Brute</span>
                    <span className="text-xs font-black text-emerald-600">
                      {formGrossMargin.toLocaleString('fr-FR')} F
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Prime (10%)</span>
                    <span className="text-xs font-black text-purple-600">
                      {formCommissionAmount.toLocaleString('fr-FR')} F
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Marge HINOV</span>
                    <span className="text-xs font-black text-blue-600">
                      {formHinovMargin.toLocaleString('fr-FR')} F
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Reste à payer</span>
                    <span className={`text-xs font-black ${formRemainingAmount === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formRemainingAmount.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                </div>
              </div>

              {/* Traçabilité Devis Optionnelle */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Liaison Devis (Optionnelle)
                </label>
                <select
                  value={formQuoteId}
                  onChange={e => setFormQuoteId(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="">Aucun devis lié (Création directe)</option>
                  {quotes.map(q => {
                    const cl = clients.find(c => c.id === q.clientId);
                    const clName = cl?.company || cl?.name || 'Client';
                    return (
                      <option key={q.id} value={q.id}>
                        Devis N° {q.quoteNumber} - {clName} ({q.total?.toLocaleString('fr-FR')} FCFA)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Boutons d'action */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20"
                >
                  {editingInvoiceId ? 'Enregistrer les modifications' : 'Ajouter au suivi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL D'ENREGISTREMENT D'UN PAIEMENT ─────────────────── */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-teal-50 dark:bg-teal-950/30">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Encaisser un règlement
                </h3>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                <span className="text-xs text-slate-500 block">Client / Facture :</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {getClientDisplayName(selectedInvoice)} ({selectedInvoice.invoiceNumber})
                </span>
                <div className="flex justify-between mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <span>Montant total : <b>{selectedInvoice.totalAmount.toLocaleString('fr-FR')} F</b></span>
                  <span className="text-rose-600">Reste : <b>{(selectedInvoice.remainingAmount ?? (selectedInvoice.totalAmount - (selectedInvoice.amountPaid || 0))).toLocaleString('fr-FR')} F</b></span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-1">Montant encaissé (FCFA) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedInvoice.remainingAmount ?? selectedInvoice.totalAmount}
                  value={payAmount || ''}
                  onChange={e => setPayAmount(Number(e.target.value) || 0)}
                  className="w-full px-3.5 py-2 font-bold text-sm bg-white dark:bg-slate-900 border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-1">Date d'encaissement</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-1">Mode de règlement</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border rounded-xl"
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Virement">Virement bancaire</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Mobile Money">Mobile Money (Wave / Orange)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Référence / Pièce (Optionnel)</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="N° chèque, réf virement..."
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md"
                >
                  Valider le règlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
