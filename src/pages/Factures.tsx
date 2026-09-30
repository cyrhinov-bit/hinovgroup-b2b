import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Receipt, 
  Calendar, 
  Download, 
  CreditCard, 
  Trash2, 
  Edit3, 
  X, 
  Building2, 
  Upload, 
  FileSpreadsheet, 
  Share2, 
  Filter, 
  RotateCcw,
  CheckCircle2,
  TrendingUp,
  Award,
  DollarSign
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useAppContext } from '../context/AppContext';
import type { Quote } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import type { Invoice, InvoiceStatus } from '../types/crmModules';
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
    quotes, 
    clients, 
    services, 
    users, 
    settings,
    addInvoice, 
    updateInvoice, 
    deleteInvoice, 
    addInvoicePayment
  } = useAppContext();

  const currentUser = users.find(u => u.id === authUser?.id) || authUser;
  const { confirm } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Période de suivi (Année & Mois)
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(9); // Défaut Septembre

  // Filtres & Recherche
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('');
  const [commercialFilter, setCommercialFilter] = useState<string>('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
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

  const isDirector = ['Directeur', 'Directeur adjoint', 'SuperAdmin'].includes(currentUser?.role || '');
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

  // Enregistrement / Mise à jour
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
        toast.success(`Facture ajoutée avec succès pour ${MONTH_NAMES[periodMonth - 1]?.name} ${periodYear} !`);
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

        for (const sheetName of wb.SheetNames) {
          const upperSheet = sheetName.trim().toUpperCase();
          const monthIdx = MONTH_NAMES.findIndex(m => upperSheet.includes(m.name.toUpperCase()));
          const periodMonth = monthIdx !== -1 ? monthIdx + 1 : selectedMonth;
          const periodYear = selectedYear;

          const ws = wb.Sheets[sheetName];
          const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });

          for (let i = 0; i < rawRows.length; i++) {
            const row = rawRows[i];
            if (!row || row.length === 0) continue;

            const col0 = String(row[0] || '').trim();
            const col0Upper = col0.toUpperCase();
            if (col0Upper.includes('CLIENT') || col0Upper.includes('TOTAL') || col0Upper === '' || col0Upper.includes('PAGE')) {
              continue;
            }

            const clientName = col0;
            const commercialName = String(row[1] || '').trim();
            
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
      } catch (err) {
        console.error('Erreur import Excel:', err);
        toast.error('Erreur lors de la lecture du fichier Excel.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Quick Seed Septembre 2026
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

  // Filtering
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

      const matchSearch = !searchTerm || 
        clientName.includes(searchTerm.toLowerCase()) ||
        commercial.includes(searchTerm.toLowerCase()) ||
        srv.includes(searchTerm.toLowerCase()) ||
        cat.includes(searchTerm.toLowerCase()) ||
        num.includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      const rem = inv.remainingAmount !== undefined ? inv.remainingAmount : Math.max(0, inv.totalAmount - (inv.amountPaid || 0));
      const isPaid = rem === 0 && inv.totalAmount > 0;
      const isPartial = rem > 0 && (inv.amountPaid || 0) > 0;
      const isUnpaid = (inv.amountPaid || 0) === 0;

      if (statusFilter === 'PAID' && !isPaid) return false;
      if (statusFilter === 'PARTIAL' && !isPartial) return false;
      if (statusFilter === 'UNPAID' && !isUnpaid) return false;

      if (serviceFilter && inv.serviceName !== serviceFilter && inv.serviceId !== serviceFilter) return false;
      if (commercialFilter && inv.commercialName !== commercialFilter && inv.commercialId !== commercialFilter) return false;

      return true;
    });
  }, [monthInvoices, searchTerm, statusFilter, serviceFilter, commercialFilter]);

  // Monthly totals
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

  // Permission Check
  if (!isDirector && !currentUser?.crmFacturationEnabled) {
    return (
      <div className="dashboard" style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Receipt size={48} color="var(--color-error)" style={{ margin: '0 auto 16px' }} />
        <h2>Module Suivi des Factures non activé</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Ce module n'est pas activé sur votre profil utilisateur. Veuillez contacter la Direction.
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      
      {/* ─── EN-TÊTE PRINCIPALE ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Receipt size={24} color="var(--color-primary)" />
            <span>Suivi des Factures Clients</span>
            <span className="badge-status" style={{ background: 'rgba(60, 125, 175, 0.12)', color: 'var(--color-primary)', fontSize: '11px', fontWeight: 700 }}>
              Registre Mensuel
            </span>
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '4px 0 0' }}>
            Suivi de la rentabilité, coûts engagés, marges HINOV, primes et règlements par mois
          </p>
        </div>

        {/* Boutons d'actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls, .csv" 
            style={{ display: 'none' }} 
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            title="Importer un fichier Excel de suivi"
          >
            <Upload size={14} color="var(--color-success)" />
            <span>Importer Excel</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
            title="Exporter le registre mensuel en Excel"
          >
            <Download size={14} />
            <span>Exporter Excel</span>
          </button>

          <button
            onClick={handleOpenNewTrackingRow}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <Plus size={16} />
            <span>+ Ajouter une facture</span>
          </button>
        </div>
      </div>

      {/* ─── SÉLECTEUR D'ANNÉE ET ONGLETS MENSUELS ───────────────── */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Exercice :</span>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--color-surface-alt)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
              {[2024, 2025, 2026, 2027].map(yr => (
                <button
                  key={yr}
                  onClick={() => setSelectedYear(yr)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: selectedYear === yr ? 'var(--color-primary)' : 'transparent',
                    color: selectedYear === yr ? '#ffffff' : 'var(--color-text)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {monthInvoices.length === 0 && selectedYear === 2026 && selectedMonth === 9 && (
            <button
              onClick={handleSeedSeptembre2026}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              <FileSpreadsheet size={14} />
              <span>Charger les données de Septembre 2026</span>
            </button>
          )}
        </div>

        {/* 12 Onglets Mensuels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(75px, 1fr))', gap: '6px' }}>
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
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 4px',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: isSelected ? 'rgba(60, 125, 175, 0.1)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}>
                  {m.name}
                </span>
                <span style={{
                  fontSize: '10px',
                  marginTop: '3px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  background: countInMonth > 0 ? (isSelected ? 'var(--color-primary)' : 'var(--color-surface-alt)') : 'transparent',
                  color: countInMonth > 0 ? (isSelected ? '#fff' : 'var(--color-text-muted)') : 'var(--color-text-muted)'
                }}>
                  {countInMonth > 0 ? `${countInMonth}` : '-'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 7 CARTES KPI DU MOIS SÉLECTIONNÉ ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {/* 1. Total à Payer */}
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #1E293B' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Total à Payer</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
            {monthlyTotals.totalToPay.toLocaleString('fr-FR')} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>F</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            {filteredInvoices.length} dossier(s)
          </div>
        </div>

        {/* 2. Total Utilisé (Coût) */}
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #D97706' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', marginBottom: '2px' }}>Montant Utilisé</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#D97706' }}>
            {monthlyTotals.totalUsed.toLocaleString('fr-FR')} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>F</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#D97706', marginTop: '2px' }}>
            Coûts engagés
          </div>
        </div>

        {/* 3. Marge Brute */}
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #10B981', background: 'rgba(16, 185, 129, 0.03)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', marginBottom: '2px' }}>Marge Brute</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>
            {monthlyTotals.totalGrossMargin.toLocaleString('fr-FR')} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>F</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
            Taux marge : {monthlyTotals.marginRate}%
          </div>
        </div>

        {/* 4. Prime 10% */}
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#8B5CF6', textTransform: 'uppercase', marginBottom: '2px' }}>Prime (10%)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#8B5CF6' }}>
            {monthlyTotals.totalCommission.toLocaleString('fr-FR')} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>F</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Commerciaux
          </div>
        </div>

        {/* 5. Marge Nette HINOV */}
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid var(--color-primary)', background: 'rgba(60, 125, 175, 0.04)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '2px' }}>Marge HINOV</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary)' }}>
            {monthlyTotals.totalHinovMargin.toLocaleString('fr-FR')} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>F</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, marginTop: '2px' }}>
            Bénéfice Net HINOV
          </div>
        </div>

        {/* 6. Total Payé */}
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #0D9488' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0D9488', textTransform: 'uppercase', marginBottom: '2px' }}>Total Payé</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0D9488' }}>
            {monthlyTotals.totalPaid.toLocaleString('fr-FR')} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>F</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0D9488', marginTop: '2px' }}>
            Recouvré : {monthlyTotals.recoveryRate}%
          </div>
        </div>

        {/* 7. Total Reste */}
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #E11D48', background: 'rgba(225, 29, 72, 0.03)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#E11D48', textTransform: 'uppercase', marginBottom: '2px' }}>Reste à Payer</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#E11D48' }}>
            {monthlyTotals.totalRemaining.toLocaleString('fr-FR')} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>F</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#E11D48', fontWeight: 600, marginTop: '2px' }}>
            À recouvrer
          </div>
        </div>
      </div>

      {/* ─── FILTRES & BARRE DE RECHERCHE ───────────────────────── */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Rechercher client, service, catégorie..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="table-input"
              style={{ width: '100%', paddingLeft: '32px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="table-input"
              style={{ padding: '6px 10px', minWidth: '130px' }}
            >
              <option value="ALL">Tous les statuts</option>
              <option value="PAID">Totalement Payé</option>
              <option value="PARTIAL">Partiellement Payé</option>
              <option value="UNPAID">Non Payé</option>
            </select>

            <select
              value={serviceFilter}
              onChange={e => setServiceFilter(e.target.value)}
              className="table-input"
              style={{ padding: '6px 10px', minWidth: '130px' }}
            >
              <option value="">Tous les services</option>
              {PREDEFINED_SERVICES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={commercialFilter}
              onChange={e => setCommercialFilter(e.target.value)}
              className="table-input"
              style={{ padding: '6px 10px', minWidth: '130px' }}
            >
              <option value="">Tous les commerciaux</option>
              {users.map(u => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── TABLEAU DU SUIVI MENSUEL (13 COLONNES CONFORMES EXCEL) ─── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Registre : {selectedMonthName} {selectedYear}
            </span>
            <span className="badge-status" style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}>
              {filteredInvoices.length} ligne(s)
            </span>
          </div>

          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Période : {selectedMonthName.toUpperCase()} {selectedYear}
          </span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ minWidth: '130px' }}>CLIENT / AFFAIRES</th>
                <th style={{ minWidth: '95px' }}>COMMERCIAL</th>
                <th style={{ minWidth: '90px' }}>DATE LIVR.</th>
                <th style={{ minWidth: '90px' }}>DATE PAIEM.</th>
                <th style={{ minWidth: '95px' }}>SERVICE</th>
                <th style={{ minWidth: '95px' }}>CATÉGORIE</th>
                <th style={{ minWidth: '110px', textAlign: 'right' }}>MONTANT À PAYER</th>
                <th style={{ minWidth: '105px', textAlign: 'right', color: '#D97706' }}>MONTANT UTILISÉ</th>
                <th style={{ minWidth: '105px', textAlign: 'right', color: '#059669' }}>MARGE</th>
                <th style={{ minWidth: '85px', textAlign: 'right', color: '#8B5CF6' }}>PRIME 10%</th>
                <th style={{ minWidth: '105px', textAlign: 'right', color: 'var(--color-primary)' }}>MARGE HINOV</th>
                <th style={{ minWidth: '95px', textAlign: 'right', color: '#0D9488' }}>PAYÉ</th>
                <th style={{ minWidth: '105px', textAlign: 'right', color: '#E11D48' }}>RESTE</th>
                <th style={{ minWidth: '85px', textAlign: 'center' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                    <Receipt size={36} color="var(--color-text-muted)" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                    <p style={{ fontWeight: 600, fontSize: '0.95rem', margin: 0 }}>Aucune facture enregistrée pour {selectedMonthName} {selectedYear}</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Cliquez sur « + Ajouter une facture » ou « Importer Excel » pour commencer.</p>
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
                    <tr key={inv.id}>
                      {/* 1. Client / Affaires */}
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{clientName}</div>
                        {inv.quoteId && (
                          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Devis lié</div>
                        )}
                      </td>

                      {/* 2. Commercial */}
                      <td style={{ fontWeight: 500 }}>
                        {commercialName}
                      </td>

                      {/* 3. Date Livraison */}
                      <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {inv.deliveryDate || '-'}
                      </td>

                      {/* 4. Date Paiement */}
                      <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        {inv.paymentDate || '-'}
                      </td>

                      {/* 5. Service */}
                      <td>
                        <span className="badge-status" style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text)', fontSize: '10px' }}>
                          {serviceName}
                        </span>
                      </td>

                      {/* 6. Catégorie */}
                      <td>
                        <span style={{ fontSize: '0.82rem' }}>{inv.category || '-'}</span>
                      </td>

                      {/* 7. Montant à payer */}
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>
                        {toPay.toLocaleString('fr-FR')} F
                      </td>

                      {/* 8. Montant utilisé */}
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#D97706' }}>
                        {used.toLocaleString('fr-FR')} F
                      </td>

                      {/* 9. Marge Brute */}
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', background: 'rgba(16, 185, 129, 0.04)' }}>
                        {grossMargin.toLocaleString('fr-FR')} F
                      </td>

                      {/* 10. Prime 10% */}
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#8B5CF6' }}>
                        {commission.toLocaleString('fr-FR')} F
                      </td>

                      {/* 11. Marge HINOV */}
                      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)', background: 'rgba(60, 125, 175, 0.04)' }}>
                        {hinovMargin.toLocaleString('fr-FR')} F
                      </td>

                      {/* 12. Payé */}
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0D9488' }}>
                        {paid.toLocaleString('fr-FR')} F
                      </td>

                      {/* 13. Reste */}
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>
                        <div style={{ color: remaining === 0 ? '#059669' : '#E11D48' }}>
                          {remaining.toLocaleString('fr-FR')} F
                        </div>
                        <span className="badge-status" style={{
                          fontSize: '9px',
                          padding: '1px 5px',
                          background: isFullyPaid ? 'rgba(16, 185, 129, 0.12)' : (isPartiallyPaid ? 'rgba(217, 119, 6, 0.12)' : 'rgba(225, 29, 72, 0.12)'),
                          color: isFullyPaid ? '#059669' : (isPartiallyPaid ? '#D97706' : '#E11D48')
                        }}>
                          {isFullyPaid ? 'PAYÉ' : (isPartiallyPaid ? 'PARTIEL' : 'NON PAYÉ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          {remaining > 0 && (
                            <button
                              onClick={() => handleOpenPaymentModal(inv)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 6px', color: '#0D9488' }}
                              title="Encaisser un règlement"
                            >
                              <CreditCard size={13} />
                            </button>
                          )}
                          {remaining > 0 && (
                            <button
                              onClick={() => handleSendWhatsApp(inv)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 6px', color: '#059669' }}
                              title="Relance WhatsApp"
                            >
                              <Share2 size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditTrackingRow(inv)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 6px', color: 'var(--color-primary)' }}
                            title="Modifier"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(inv)}
                            className="btn btn-secondary"
                            style={{ padding: '4px 6px', color: 'var(--color-error)' }}
                            title="Supprimer"
                          >
                            <Trash2 size={13} />
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
                <tr style={{ background: 'var(--color-surface-alt)', fontWeight: 800, fontSize: '0.85rem', borderTop: '2px solid var(--color-border)' }}>
                  <td colSpan={6} style={{ padding: '12px', color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                    TOTAL DU MOIS ({selectedMonthName.toUpperCase()} {selectedYear})
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px' }}>
                    {monthlyTotals.totalToPay.toLocaleString('fr-FR')} F
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px', color: '#D97706' }}>
                    {monthlyTotals.totalUsed.toLocaleString('fr-FR')} F
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px', color: '#059669', background: 'rgba(16, 185, 129, 0.08)' }}>
                    {monthlyTotals.totalGrossMargin.toLocaleString('fr-FR')} F
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px', color: '#8B5CF6' }}>
                    {monthlyTotals.totalCommission.toLocaleString('fr-FR')} F
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px', color: 'var(--color-primary)', background: 'rgba(60, 125, 175, 0.08)' }}>
                    {monthlyTotals.totalHinovMargin.toLocaleString('fr-FR')} F
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px', color: '#0D9488' }}>
                    {monthlyTotals.totalPaid.toLocaleString('fr-FR')} F
                  </td>
                  <td style={{ textAlign: 'right', padding: '12px', color: '#E11D48' }}>
                    {monthlyTotals.totalRemaining.toLocaleString('fr-FR')} F
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
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="modal-content" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '650px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={20} color="var(--color-primary)" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  {editingInvoiceId ? 'Modifier la ligne de suivi' : 'Ajouter une facture au suivi'}
                </h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Client & Commercial */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Client / Affaires *
                  </label>
                  <input
                    type="text"
                    required
                    list="clients-list-modal"
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
                    className="table-input"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                  <datalist id="clients-list-modal">
                    {clients.map(c => (
                      <option key={c.id} value={c.company || c.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Commercial
                  </label>
                  <input
                    type="text"
                    list="commerciaux-list-modal"
                    value={formCommercialName}
                    onChange={e => {
                      setFormCommercialName(e.target.value);
                      const matching = users.find(u => u.name.toLowerCase() === e.target.value.toLowerCase());
                      if (matching) setFormCommercialId(matching.id);
                    }}
                    placeholder="Ex: BOSSO, AKOSSI, DIALLO..."
                    className="table-input"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                  <datalist id="commerciaux-list-modal">
                    {users.map(u => (
                      <option key={u.id} value={u.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Service & Catégorie */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Service
                  </label>
                  <input
                    type="text"
                    list="services-list-modal"
                    value={formServiceName}
                    onChange={e => setFormServiceName(e.target.value.toUpperCase())}
                    placeholder="INFORMATIQUE, IMPRIMERIE..."
                    className="table-input"
                    style={{ width: '100%', padding: '8px 12px', fontWeight: 600 }}
                  />
                  <datalist id="services-list-modal">
                    {PREDEFINED_SERVICES.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Catégorie / Désignation
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    placeholder="Ex: CARTOUCHE, CASQUE, MACARON..."
                    className="table-input"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Date de Livraison *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDeliveryDate}
                    onChange={e => setFormDeliveryDate(e.target.value)}
                    className="table-input"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Date de Paiement (Optionnel)
                  </label>
                  <input
                    type="date"
                    value={formPaymentDate}
                    onChange={e => setFormPaymentDate(e.target.value)}
                    className="table-input"
                    style={{ width: '100%', padding: '8px 12px' }}
                  />
                </div>
              </div>

              {/* Bloc Montants & Coûts */}
              <div className="card" style={{ padding: '16px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                      Montant à Payer *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      required
                      value={formAmountToPay || ''}
                      onChange={e => setFormAmountToPay(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="table-input"
                      style={{ width: '100%', padding: '8px 10px', fontWeight: 700, fontSize: '1rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', color: '#D97706' }}>
                      Montant Utilisé (Coût)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formAmountUsed || ''}
                      onChange={e => setFormAmountUsed(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="table-input"
                      style={{ width: '100%', padding: '8px 10px', fontWeight: 700, color: '#D97706', fontSize: '1rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px', color: '#0D9488' }}>
                      Déjà Payé (FCFA)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={formAmountPaid || ''}
                      onChange={e => setFormAmountPaid(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="table-input"
                      style={{ width: '100%', padding: '8px 10px', fontWeight: 700, color: '#0D9488', fontSize: '1rem' }}
                    />
                  </div>
                </div>

                {/* Calculs automatiques temps réel */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
                  <div style={{ background: 'var(--color-surface)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Marge Brute</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#059669' }}>{formGrossMargin.toLocaleString('fr-FR')} F</span>
                  </div>

                  <div style={{ background: 'var(--color-surface)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Prime (10%)</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#8B5CF6' }}>{formCommissionAmount.toLocaleString('fr-FR')} F</span>
                  </div>

                  <div style={{ background: 'var(--color-surface)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Marge HINOV</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-primary)' }}>{formHinovMargin.toLocaleString('fr-FR')} F</span>
                  </div>

                  <div style={{ background: 'var(--color-surface)', padding: '6px', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Reste</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: formRemainingAmount === 0 ? '#059669' : '#E11D48' }}>{formRemainingAmount.toLocaleString('fr-FR')} F</span>
                  </div>
                </div>
              </div>

              {/* Liaison Devis (Optionnelle) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Liaison Devis (Optionnelle)
                </label>
                <select
                  value={formQuoteId}
                  onChange={e => setFormQuoteId(e.target.value)}
                  className="table-input"
                  style={{ width: '100%', padding: '6px 10px', fontSize: '0.8rem' }}
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 700 }}
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
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="modal-content" style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '450px', width: '100%', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="#0D9488" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  Encaisser un règlement
                </h3>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: 'var(--color-surface-alt)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>Client :</span>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-primary)' }}>
                  {getClientDisplayName(selectedInvoice)}
                </span>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--color-border)', fontSize: '0.8rem' }}>
                  <span>Total : <b>{selectedInvoice.totalAmount.toLocaleString('fr-FR')} F</b></span>
                  <span style={{ color: '#E11D48' }}>Reste : <b>{(selectedInvoice.remainingAmount ?? (selectedInvoice.totalAmount - (selectedInvoice.amountPaid || 0))).toLocaleString('fr-FR')} F</b></span>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Montant encaissé (FCFA) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedInvoice.remainingAmount ?? selectedInvoice.totalAmount}
                  value={payAmount || ''}
                  onChange={e => setPayAmount(Number(e.target.value) || 0)}
                  className="table-input"
                  style={{ width: '100%', padding: '8px 10px', fontWeight: 700, fontSize: '1rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Date d'encaissement
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="table-input"
                  style={{ width: '100%', padding: '8px 10px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                  Mode de règlement
                </label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="table-input"
                  style={{ width: '100%', padding: '8px 10px' }}
                >
                  <option value="Espèces">Espèces</option>
                  <option value="Virement">Virement bancaire</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Mobile Money">Mobile Money (Wave / Orange)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Référence / N° Pièce (Optionnel)
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="N° chèque, réf virement..."
                  className="table-input"
                  style={{ width: '100%', padding: '8px 10px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#0D9488', borderColor: '#0D9488', fontWeight: 700 }}
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
