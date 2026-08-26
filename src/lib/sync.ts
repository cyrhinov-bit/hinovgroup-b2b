import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { supabase } from './supabase';

const isUuid = (value?: string) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export type SyncActionType = 'INSERT_CLIENT' | 'UPDATE_CLIENT' | 'DELETE_CLIENT' | 
                             'INSERT_QUOTE' | 'UPDATE_QUOTE' | 'DELETE_QUOTE' |
                             'INSERT_SALE' | 'UPDATE_SALE' | 'DELETE_SALE' |
                             'INSERT_COMMISSION' | 'UPDATE_COMMISSION' | 'DELETE_COMMISSION' |
                             'INSERT_INSTALLMENT' | 'UPDATE_INSTALLMENT' | 'DELETE_INSTALLMENT' |
                             'INSERT_PROSPECT' | 'UPDATE_PROSPECT' | 'DELETE_PROSPECT' |
                             'INSERT_PROSPECT_ACTIVITY' | 'DELETE_PROSPECT_ACTIVITY' |
                             'INSERT_PROSPECT_FOLLOW_UP' | 'UPDATE_PROSPECT_FOLLOW_UP' | 'DELETE_PROSPECT_FOLLOW_UP' |
                             'INSERT_ACTIVITY_REPORT' | 'UPDATE_ACTIVITY_REPORT' | 'DELETE_ACTIVITY_REPORT' |
                             'INSERT_WEEKLY_REPORT' | 'UPDATE_WEEKLY_REPORT' |
                             'INSERT_V2_DAILY_REPORT' | 'UPDATE_V2_DAILY_REPORT' |
                             'INSERT_V2_WEEKLY_REPORT' | 'UPDATE_V2_WEEKLY_REPORT' |
                             'INSERT_CATEGORY' | 'DELETE_CATEGORY' |
                             'UPDATE_SETTINGS' | 'UPDATE_PROFILE' | 'DELETE_PROFILE' |
                             'INSERT_PRESTATION' | 'UPDATE_PRESTATION' | 'DELETE_PRESTATION' |
                             'INSERT_SERVICE' | 'UPDATE_SERVICE' | 'DELETE_SERVICE' |
                             'INSERT_POS_CATEGORY' | 'UPDATE_POS_CATEGORY' | 'DELETE_POS_CATEGORY' |
                             'INSERT_POS_BRAND' | 'UPDATE_POS_BRAND' | 'DELETE_POS_BRAND' |
                             'INSERT_POS_SUPPLIER' | 'UPDATE_POS_SUPPLIER' | 'DELETE_POS_SUPPLIER' |
                             'INSERT_POS_PRODUCT' | 'UPDATE_POS_PRODUCT' | 'DELETE_POS_PRODUCT' |
                             'INSERT_POS_STOCK_ENTRY' | 'UPDATE_POS_STOCK_ENTRY' | 'DELETE_POS_STOCK_ENTRY' |
                             'INSERT_POS_STOCK_MOVEMENT' |
                             'INSERT_POS_INVENTORY' | 'UPDATE_POS_INVENTORY' | 'DELETE_POS_INVENTORY' |
                             'INSERT_POS_CASH_SESSION' | 'UPDATE_POS_CASH_SESSION' |
                             'INSERT_POS_TRANSACTION' | 'UPDATE_POS_TRANSACTION' | 'CLEAR_POS_SALES_HISTORY' |
                             'INSERT_POS_PAYMENT' |
                              'INSERT_POS_DISCOUNT' | 'UPDATE_POS_DISCOUNT' | 'DELETE_POS_DISCOUNT' |
                              'UPDATE_POS_SETTINGS' |
                              'INSERT_POS_RETURN' | 'UPDATE_POS_RETURN' |
                              'INSERT_PRODUCT_COMPLETION' | 'UPDATE_PRODUCT_COMPLETION' | 'DELETE_PRODUCT_COMPLETION' |
                              'INSERT_IMPORT_SESSION' | 'UPDATE_IMPORT_SESSION' | 'DELETE_IMPORT_SESSION' |
                              'INSERT_IMPORT_ERROR' |
                              'INSERT_DOCUMENT' | 'DELETE_DOCUMENT' |
                              'MARK_NOTIFICATION_READ' | 'MARK_ALL_NOTIFICATIONS_READ';

export interface SyncAction {
  id: string;
  type: SyncActionType;
  payload: any;
  timestamp: number;
}

// Ajouter une action à la file d'attente
export const queueSyncAction = async (type: SyncActionType, payload: any) => {
  const action: SyncAction = {
    id: uuidv4(),
    type,
    payload,
    timestamp: Date.now()
  };
  
  const currentQueue: SyncAction[] = (await db.syncQueue.getItem('queue')) || [];
  currentQueue.push(action);
  await db.syncQueue.setItem('queue', currentQueue);
  
  // Tenter de synchroniser immédiatement si on est en ligne
  if (navigator.onLine) {
    processSyncQueue();
  }
};

// Verrou anti-réentrance : empêche deux processSyncQueue simultanés
let syncLock = false;

// Vider la file d'attente
export const processSyncQueue = async () => {
  if (syncLock) return;
  syncLock = true;
  try {
  const currentQueue: SyncAction[] = (await db.syncQueue.getItem('queue')) || [];
  if (currentQueue.length === 0) return;

  const processedIds = new Set<string>();

  for (const action of currentQueue) {
    try {
      let success = false;
      
      switch (action.type) {
        case 'INSERT_CLIENT': {
          const { error } = await supabase.from('clients').insert([{
            id: action.payload.id,
            name: action.payload.name,
            email: action.payload.email || null,
            phone: action.payload.phone || null,
            contact: action.payload.contact || null,
            company: action.payload.company || null,
            address: action.payload.address || null,
            status: action.payload.status || 'Actif',
            commercial_id: action.payload.commercialId || null,
            created_at: action.payload.createdAt || new Date().toISOString()
          }]);
          if (error) console.error('[Sync] INSERT_CLIENT échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_CLIENT': {
          const { id, ...data } = action.payload;
          const mappedData: any = {};
          if (data.name !== undefined) mappedData.name = data.name;
          if (data.email !== undefined) mappedData.email = data.email;
          if (data.phone !== undefined) mappedData.phone = data.phone;
          if (data.contact !== undefined) mappedData.contact = data.contact;
          if (data.company !== undefined) mappedData.company = data.company;
          if (data.address !== undefined) mappedData.address = data.address;
          if (data.status !== undefined) mappedData.status = data.status;
          if (data.commercialId !== undefined) mappedData.commercial_id = data.commercialId;
          const { error } = await supabase.from('clients').update(mappedData).eq('id', id);
          if (error) console.error('[Sync] UPDATE_CLIENT échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_CLIENT': {
          const { error } = await supabase.from('clients').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_QUOTE': {
          const { lines, ...quoteData } = action.payload;
          const { error } = await supabase.from('quotes').insert([{
            id: quoteData.id,
            quote_number: quoteData.quoteNumber,
            client_id: quoteData.clientId,
            commercial_id: quoteData.commercialId,
            service_id: quoteData.serviceId || null,
            subject: quoteData.subject,
            subtotal: quoteData.subtotal,
            vat: quoteData.vat ?? 0,
            total: quoteData.total,
            status: quoteData.status,
            date: quoteData.date,
            style: quoteData.style,
            accent_color: quoteData.accentColor,
            discount_percent: quoteData.discountPercent || 0,
            discount_amount: quoteData.discountAmount || 0,
            client_comment: quoteData.clientComment || null
          }]);
          
          if (!error && lines && lines.length > 0) {
            const linesData = lines.map((l: any) => ({
              id: l.id,
              quote_id: quoteData.id,
              prestation_id: l.prestationId,
              description: l.description,
              quantity: l.quantity,
              unit_price: l.unitPrice,
              discount_percent: l.discountPercent || 0,
              total: l.total
            }));
            await supabase.from('quote_lines').insert(linesData);
            success = true;
          } else if (!error) {
            success = true;
          }
          break;
        }
        case 'UPDATE_QUOTE': {
          const { lines, ...quoteData } = action.payload;
          const { error } = await supabase.from('quotes').update({
            quote_number: quoteData.quoteNumber,
            client_id: quoteData.clientId,
            commercial_id: quoteData.commercialId,
            service_id: quoteData.serviceId || null,
            subject: quoteData.subject,
            subtotal: quoteData.subtotal,
            vat: quoteData.vat ?? 0,
            total: quoteData.total,
            status: quoteData.status,
            date: quoteData.date,
            style: quoteData.style,
            accent_color: quoteData.accentColor,
            discount_percent: quoteData.discountPercent || 0,
            discount_amount: quoteData.discountAmount || 0,
            client_comment: quoteData.clientComment !== undefined ? quoteData.clientComment : null
          }).eq('id', quoteData.id);

          if (!error) {
            await supabase.from('quote_lines').delete().eq('quote_id', quoteData.id);
            if (lines && lines.length > 0) {
              const linesData = lines.map((l: any) => ({
                id: l.id,
                quote_id: quoteData.id,
                prestation_id: l.prestationId,
                description: l.description,
                quantity: l.quantity,
                unit_price: l.unitPrice,
                discount_percent: l.discountPercent || 0,
                total: l.total
              }));
              await supabase.from('quote_lines').insert(linesData);
            }
            success = true;
          }
          break;
        }
        case 'DELETE_QUOTE': {
          const { error } = await supabase.from('quotes').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_SALE': {
          const { lines, ...saleData } = action.payload;
          const { error } = await supabase.from('ventes').insert([{
            id: saleData.id,
            sale_number: saleData.saleNumber,
            quote_id: saleData.quoteId || null,
            client_id: saleData.clientId,
            service_id: saleData.serviceId || null,
            subtotal: saleData.subtotal,
            vat: saleData.vat ?? 0,
            total: saleData.total,
            status: saleData.status,
            date: saleData.date,
            notes: saleData.notes || null
          }]);
          
          if (!error && lines && lines.length > 0) {
            const linesData = lines.map((l: any) => ({
              id: l.id,
              vente_id: saleData.id,
              description: l.description,
              quantity: l.quantity,
              unit_price: l.unitPrice,
              cost_price: l.costPrice || 0,
              total: l.total
            }));
            await supabase.from('vente_lines').insert(linesData);
            success = true;
          } else if (!error) {
            success = true;
          } else {
            console.error('[Sync] INSERT_SALE échoué :', error.message);
          }
          break;
        }
        case 'UPDATE_SALE': {
          const { lines, ...saleData } = action.payload;
          const { error } = await supabase.from('ventes').update({
            sale_number: saleData.saleNumber,
            quote_id: saleData.quoteId || null,
            client_id: saleData.clientId,
            service_id: saleData.serviceId || null,
            subtotal: saleData.subtotal,
            vat: saleData.vat ?? 0,
            total: saleData.total,
            status: saleData.status,
            date: saleData.date,
            notes: saleData.notes || null
          }).eq('id', saleData.id);

          if (!error) {
            await supabase.from('vente_lines').delete().eq('vente_id', saleData.id);
            if (lines && lines.length > 0) {
              const linesData = lines.map((l: any) => ({
                id: l.id,
                vente_id: saleData.id,
                description: l.description,
                quantity: l.quantity,
                unit_price: l.unitPrice,
                cost_price: l.costPrice || 0,
                total: l.total
              }));
              await supabase.from('vente_lines').insert(linesData);
            }
            success = true;
          } else {
            console.error('[Sync] UPDATE_SALE échoué :', error.message);
          }
          break;
        }
        case 'DELETE_SALE': {
          const { error } = await supabase.from('ventes').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_COMMISSION': {
          const { error } = await supabase.from('commissions').insert([{
            id: action.payload.id,
            vente_id: action.payload.saleId || null,
            client_id: action.payload.clientId || null,
            commercial_id: action.payload.commercialId || null,
            service_id: action.payload.serviceId || null,
            total_ht: action.payload.totalHt,
            cost_total: action.payload.costTotal,
            margin_amount: action.payload.marginAmount,
            margin_percent: action.payload.marginPercent,
            commission_percent: action.payload.commissionPercent,
            commission_amount: action.payload.commissionAmount,
            status: action.payload.status
          }]);
          if (error) console.error('[Sync] INSERT_COMMISSION échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_COMMISSION': {
          const { id, ...updateData } = action.payload;
          const mappedData: any = {};
          if (updateData.totalHt !== undefined) mappedData.total_ht = updateData.totalHt;
          if (updateData.costTotal !== undefined) mappedData.cost_total = updateData.costTotal;
          if (updateData.marginAmount !== undefined) mappedData.margin_amount = updateData.marginAmount;
          if (updateData.marginPercent !== undefined) mappedData.margin_percent = updateData.marginPercent;
          if (updateData.commissionPercent !== undefined) mappedData.commission_percent = updateData.commissionPercent;
          if (updateData.commissionAmount !== undefined) mappedData.commission_amount = updateData.commissionAmount;
          if (updateData.status !== undefined) mappedData.status = updateData.status;
          if (updateData.paidAmount !== undefined) mappedData.paid_amount = updateData.paidAmount;
          const { error } = await supabase.from('commissions').update(mappedData).eq('id', id);
          if (error) console.error('[Sync] UPDATE_COMMISSION échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_COMMISSION': {
          const { error } = await supabase.from('commissions').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_INSTALLMENT': {
          const { error } = await supabase.from('vente_echeances').insert([{
            id: action.payload.id,
            vente_id: action.payload.saleId,
            amount: action.payload.amount,
            due_date: action.payload.dueDate,
            paid_amount: action.payload.paidAmount || 0,
            status: action.payload.status,
            paid_at: action.payload.paidAt || null
          }]);
          if (error) console.error('[Sync] INSERT_INSTALLMENT échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_INSTALLMENT': {
          const { error } = await supabase.from('vente_echeances').update({
            amount: action.payload.amount,
            due_date: action.payload.dueDate,
            paid_amount: action.payload.paidAmount,
            status: action.payload.status,
            paid_at: action.payload.paidAt || null
          }).eq('id', action.payload.id);
          if (error) console.error('[Sync] UPDATE_INSTALLMENT échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_INSTALLMENT': {
          const { error } = await supabase.from('vente_echeances').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_PROSPECT': {
          const { error } = await supabase.from('prospects').insert([{
            id: action.payload.id,
            prospect_number: action.payload.prospectNumber,
            commercial_id: action.payload.commercialId,
            service_id: action.payload.serviceId || null,
            category_id: action.payload.categoryId || null,
            type: action.payload.type,
            name: action.payload.name,
            company: action.payload.company || null,
            phone: action.payload.phone || null,
            email: action.payload.email || null,
            address: action.payload.address || null,
            city: action.payload.city || null,
            source: action.payload.source || null,
            interest_level: action.payload.interestLevel,
            budget: action.payload.budget || 0,
            need: action.payload.need || null,
            comments: action.payload.comments || null,
            status: action.payload.status,
            responsible_id: action.payload.responsibleId || null
          }]);
          if (error) console.error('[Sync] INSERT_PROSPECT échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_PROSPECT': {
          const { id, ...updateData } = action.payload;
          const mappedData: any = {};
          if (updateData.type !== undefined) mappedData.type = updateData.type;
          if (updateData.name !== undefined) mappedData.name = updateData.name;
          if (updateData.company !== undefined) mappedData.company = updateData.company;
          if (updateData.phone !== undefined) mappedData.phone = updateData.phone;
          if (updateData.email !== undefined) mappedData.email = updateData.email;
          if (updateData.address !== undefined) mappedData.address = updateData.address;
          if (updateData.city !== undefined) mappedData.city = updateData.city;
          if (updateData.source !== undefined) mappedData.source = updateData.source;
          if (updateData.interestLevel !== undefined) mappedData.interest_level = updateData.interestLevel;
          if (updateData.budget !== undefined) mappedData.budget = updateData.budget;
          if (updateData.need !== undefined) mappedData.need = updateData.need;
          if (updateData.comments !== undefined) mappedData.comments = updateData.comments;
          if (updateData.status !== undefined) mappedData.status = updateData.status;
          if (updateData.categoryId !== undefined) mappedData.category_id = updateData.categoryId;
          if (updateData.commercialId !== undefined) mappedData.commercial_id = updateData.commercialId;
          if (updateData.serviceId !== undefined) mappedData.service_id = updateData.serviceId;
          if (updateData.responsibleId !== undefined) mappedData.responsible_id = updateData.responsibleId;
          if (updateData.updated_at !== undefined) mappedData.updated_at = updateData.updated_at;
          const { error } = await supabase.from('prospects').update(mappedData).eq('id', id);
          if (error) console.error('[Sync] UPDATE_PROSPECT échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_PROSPECT': {
          const { error } = await supabase.from('prospects').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_PROSPECT_ACTIVITY': {
          const { error } = await supabase.from('prospect_activities').insert([{
            id: action.payload.id,
            prospect_id: action.payload.prospectId,
            type: action.payload.type,
            description: action.payload.description || null,
            date: action.payload.date,
            created_by: action.payload.createdBy || null
          }]);
          if (error) console.error('[Sync] INSERT_PROSPECT_ACTIVITY échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_PROSPECT_ACTIVITY': {
          const { error } = await supabase.from('prospect_activities').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_PROSPECT_FOLLOW_UP': {
          const { error } = await supabase.from('prospect_follow_ups').insert([{
            id: action.payload.id,
            prospect_id: action.payload.prospectId,
            date: action.payload.date,
            time: action.payload.time || null,
            priority: action.payload.priority,
            observation: action.payload.observation || null,
            status: action.payload.status
          }]);
          if (error) console.error('[Sync] INSERT_PROSPECT_FOLLOW_UP échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_PROSPECT_FOLLOW_UP': {
          const { id, ...updateData } = action.payload;
          const { error } = await supabase.from('prospect_follow_ups').update({ status: updateData.status }).eq('id', id);
          if (error) console.error('[Sync] UPDATE_PROSPECT_FOLLOW_UP échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_PROSPECT_FOLLOW_UP': {
          const { error } = await supabase.from('prospect_follow_ups').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_CATEGORY': {
          const { error } = await supabase.from('categories').insert([{
            id: action.payload.id,
            service_id: action.payload.serviceId,
            name: action.payload.name
          }]);
          if (error) console.error('[Sync] INSERT_CATEGORY échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_CATEGORY': {
          const { error } = await supabase.from('categories').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'UPDATE_SETTINGS': {
          const { error } = await supabase.from('settings').update({
            company_name: action.payload.companyName,
            company_logo: action.payload.companyLogo,
            company_address: action.payload.companyAddress,
            company_siret: action.payload.companySiret,
            company_tva: action.payload.companyTva,
            default_terms: action.payload.defaultTerms,
            header_logo_base64: action.payload.headerLogoBase64 ?? null,
            default_validity: action.payload.defaultValidity ?? null,
            site_url: action.payload.siteUrl ?? null,
            commission_rate: action.payload.commissionRate ?? null,
          }).eq('id', 1);
          if (error) console.error('[Sync] UPDATE_SETTINGS échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_PROFILE': {
          const { id, ...updateData } = action.payload;
          const { error } = await supabase.from('profiles').update(updateData).eq('id', id);
          if (error) console.error('[Sync] UPDATE_PROFILE échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_PROFILE': {
          const { error } = await supabase.from('profiles').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_ACTIVITY_REPORT': { // @deprecated V1
          const { error } = await supabase.from('activity_reports').insert([{
            id: action.payload.id,
            author_id: action.payload.authorId,
            role: action.payload.role,
            type: action.payload.type,
            date: action.payload.date,
            realisations: action.payload.realisations || null,
            difficultes: action.payload.difficultes || null,
            remarques: action.payload.remarques || null
          }]);
          if (error) console.error('[Sync] INSERT_ACTIVITY_REPORT échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_ACTIVITY_REPORT': { // @deprecated V1
          const { error } = await supabase.from('activity_reports').update({
            role: action.payload.role,
            type: action.payload.type,
            date: action.payload.date,
            realisations: action.payload.realisations || null,
            difficultes: action.payload.difficultes || null,
            remarques: action.payload.remarques || null,
            updated_at: action.payload.updatedAt || new Date().toISOString()
          }).eq('id', action.payload.id);
          if (error) console.error('[Sync] UPDATE_ACTIVITY_REPORT échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_ACTIVITY_REPORT': { // @deprecated V1
          const { error } = await supabase.from('activity_reports').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_WEEKLY_REPORT': { // @deprecated V1
          const { error } = await supabase.from('weekly_reports').insert([{
            id: action.payload.id,
            author_id: action.payload.authorId,
            role: action.payload.role,
            week_start: action.payload.weekStart,
            sections: action.payload.sections || [],
            kpis: action.payload.kpis || {},
            status: action.payload.status || 'Brouillon'
          }]);
          if (error) console.error('[Sync] INSERT_WEEKLY_REPORT échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_WEEKLY_REPORT': { // @deprecated V1 - Always needed for markWeeklyReportRead by managers on old reports
          const { sent_at, status, ...rest } = action.payload;
          const mapped: any = {};
          if (rest.sections !== undefined) mapped.sections = rest.sections;
          if (rest.kpis !== undefined) mapped.kpis = rest.kpis;
          if (status !== undefined) mapped.status = status;
          if (sent_at !== undefined) mapped.sent_at = sent_at;
          const { error } = await supabase.from('weekly_reports').update(mapped).eq('id', action.payload.id);
          if (error) console.error('[Sync] UPDATE_WEEKLY_REPORT échoué :', error.message);
          success = !error;
          break;
        }
        case 'INSERT_V2_DAILY_REPORT': {
          const { error } = await supabase.from('v2_daily_reports').insert([{
            id: action.payload.id, author_id: action.payload.authorId, date: action.payload.date, project: action.payload.project,
            objectives: action.payload.objectives, tasks: action.payload.tasks, results: action.payload.results,
            difficulties: action.payload.difficulties, observations: action.payload.observations, status: action.payload.status
          }]);
          if (error) console.error('[Sync] INSERT_V2_DAILY_REPORT échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_V2_DAILY_REPORT': {
          const { error } = await supabase.from('v2_daily_reports').update({
            date: action.payload.date, project: action.payload.project,
            objectives: action.payload.objectives, tasks: action.payload.tasks, results: action.payload.results,
            difficulties: action.payload.difficulties, observations: action.payload.observations, status: action.payload.status,
            updated_at: action.payload.updatedAt || new Date().toISOString()
          }).eq('id', action.payload.id);
          if (error) console.error('[Sync] UPDATE_V2_DAILY_REPORT échoué :', error.message);
          success = !error;
          break;
        }
        case 'INSERT_V2_WEEKLY_REPORT': {
          const { error } = await supabase.from('v2_weekly_reports').insert([{
            id: action.payload.id, author_id: action.payload.authorId, week_start: action.payload.weekStart, project: action.payload.project,
            daily_report_ids: action.payload.dailyReportIds, weekly_objectives: action.payload.weeklyObjectives,
            tasks_by_day: action.payload.tasksByDay, pending_tasks: action.payload.pendingTasks, summary: action.payload.summary,
            next_week_objectives: action.payload.nextWeekObjectives, conclusion: action.payload.conclusion, status: action.payload.status
          }]);
          if (error) console.error('[Sync] INSERT_V2_WEEKLY_REPORT échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_V2_WEEKLY_REPORT': {
          const { error } = await supabase.from('v2_weekly_reports').update({
            project: action.payload.project, daily_report_ids: action.payload.dailyReportIds, weekly_objectives: action.payload.weeklyObjectives,
            tasks_by_day: action.payload.tasksByDay, pending_tasks: action.payload.pendingTasks, summary: action.payload.summary,
            next_week_objectives: action.payload.nextWeekObjectives, conclusion: action.payload.conclusion, status: action.payload.status,
            updated_at: action.payload.updatedAt || new Date().toISOString()
          }).eq('id', action.payload.id);
          if (error) console.error('[Sync] UPDATE_V2_WEEKLY_REPORT échoué :', error.message);
          success = !error;
          break;
        }
        case 'MARK_NOTIFICATION_READ': {
          const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', action.payload.id);
          if (error) console.error('[Sync] MARK_NOTIFICATION_READ échoué :', error.message);
          success = !error;
          break;
        }
        case 'MARK_ALL_NOTIFICATIONS_READ': {
          const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', action.payload.user_id).eq('is_read', false);
          if (error) console.error('[Sync] MARK_ALL_NOTIFICATIONS_READ échoué :', error.message);
          success = !error;
          break;
        }
        case 'INSERT_PRESTATION': {
          const { error } = await supabase.from('prestations').insert([{
            id: action.payload.id, code: action.payload.code, name: action.payload.name, description: action.payload.description, price: action.payload.price, service_id: action.payload.serviceId, unit: action.payload.unit, cost_price: action.payload.costPrice || 0
          }]);
          if (error) console.error('[Sync] INSERT_PRESTATION échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_PRESTATION': {
          const { error } = await supabase.from('prestations').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'UPDATE_PRESTATION': {
          const { id, ...updateData } = action.payload;
          const { error } = await supabase.from('prestations').update({
            code: updateData.code, name: updateData.name, description: updateData.description, price: updateData.price, service_id: updateData.serviceId, unit: updateData.unit, cost_price: updateData.costPrice || 0
          }).eq('id', id);
          if (error) console.error('[Sync] UPDATE_PRESTATION échoué :', error.message);
          success = !error;
          break;
        }
        case 'INSERT_SERVICE': {
          const { error } = await supabase.from('services').insert([{
            id: action.payload.id, name: action.payload.name, description: action.payload.description, members: action.payload.members
          }]);
          if (error) console.error('[Sync] INSERT_SERVICE échoué :', error.message);
          success = !error;
          break;
        }
        case 'UPDATE_SERVICE': {
          const { id, ...updateData } = action.payload;
          const { error } = await supabase.from('services').update(updateData).eq('id', id);
          if (error) console.error('[Sync] UPDATE_SERVICE échoué :', error.message);
          success = !error;
          break;
        }
        case 'DELETE_SERVICE': {
          const { error } = await supabase.from('services').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        // === POS SYNC ===
        case 'INSERT_POS_CATEGORY': {
          const { error } = await supabase.from('pos_categories').insert([{ id: action.payload.id, name: action.payload.name, family: action.payload.family }]);
          success = !error;
          break;
        }
        case 'UPDATE_POS_CATEGORY': {
          const { id, ...data } = action.payload;
          const { error } = await supabase.from('pos_categories').update(data).eq('id', id);
          success = !error;
          break;
        }
        case 'DELETE_POS_CATEGORY': {
          const { error } = await supabase.from('pos_categories').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_POS_BRAND': {
          const { error } = await supabase.from('pos_brands').insert([{ id: action.payload.id, name: action.payload.name }]);
          success = !error;
          break;
        }
        case 'UPDATE_POS_BRAND': {
          const { id, ...data } = action.payload;
          const { error } = await supabase.from('pos_brands').update(data).eq('id', id);
          success = !error;
          break;
        }
        case 'DELETE_POS_BRAND': {
          const { error } = await supabase.from('pos_brands').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_POS_SUPPLIER': {
          const { error } = await supabase.from('pos_suppliers').insert([{ id: action.payload.id, name: action.payload.name, contact: action.payload.contact, phone: action.payload.phone, email: action.payload.email, address: action.payload.address }]);
          success = !error;
          break;
        }
        case 'UPDATE_POS_SUPPLIER': {
          const { id, ...data } = action.payload;
          const { error } = await supabase.from('pos_suppliers').update(data).eq('id', id);
          success = !error;
          break;
        }
        case 'DELETE_POS_SUPPLIER': {
          const { error } = await supabase.from('pos_suppliers').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_POS_PRODUCT': {
          const { error } = await supabase.from('pos_products').insert([{
            id: action.payload.id,
            reference: action.payload.reference, 
            barcode: action.payload.barcode ? action.payload.barcode : null,
            isbn: action.payload.isbn ? action.payload.isbn : null, 
            name: action.payload.name,
            family: action.payload.family,
            category_id: isUuid(action.payload.categoryId) ? action.payload.categoryId : null,
            brand_id: isUuid(action.payload.brandId) ? action.payload.brandId : null,
            supplier_id: isUuid(action.payload.supplierId) ? action.payload.supplierId : null,
            purchase_price: action.payload.purchasePrice ?? 0,
            selling_price: action.payload.sellingPrice ?? 0,
            quantity: action.payload.quantity ?? 0,
            min_stock: action.payload.minStock ?? 0,
            image_url: action.payload.imageUrl || null,
            unit: action.payload.unit || null,
            is_active: action.payload.isActive !== false,
            updated_at: action.payload.updatedAt || new Date().toISOString()
          }]);
          if (error) console.error('[Sync] INSERT_POS_PRODUCT échoué :', error);
          success = !error;
          break;
        }
        case 'UPDATE_POS_PRODUCT': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.reference !== undefined) mapped.reference = data.reference;
          if (data.barcode !== undefined) mapped.barcode = data.barcode ? data.barcode : null;
          if (data.isbn !== undefined) mapped.isbn = data.isbn ? data.isbn : null;
          if (data.name !== undefined) mapped.name = data.name;
          if (data.family !== undefined) mapped.family = data.family;
          if (data.categoryId !== undefined) mapped.category_id = isUuid(data.categoryId) ? data.categoryId : null;
          if (data.brandId !== undefined) mapped.brand_id = isUuid(data.brandId) ? data.brandId : null;
          if (data.supplierId !== undefined) mapped.supplier_id = isUuid(data.supplierId) ? data.supplierId : null;
          if (data.purchasePrice !== undefined) mapped.purchase_price = data.purchasePrice;
          if (data.sellingPrice !== undefined) mapped.selling_price = data.sellingPrice;
          if (data.quantity !== undefined) mapped.quantity = Math.max(0, data.quantity);
          if (data.minStock !== undefined) mapped.min_stock = data.minStock;
          if (data.imageUrl !== undefined) mapped.image_url = data.imageUrl || null;
          if (data.unit !== undefined) mapped.unit = data.unit || null;
          if (data.isActive !== undefined) mapped.is_active = data.isActive;
          const { error } = await supabase.from('pos_products').update(mapped).eq('id', id);
          if (error) console.error('[Sync] UPDATE_POS_PRODUCT échoué :', error);
          success = !error;
          break;
        }
        case 'DELETE_POS_PRODUCT': {
          const { error } = await supabase.from('pos_products').delete().eq('id', action.payload.id);
          if (error) {
            console.warn('[Sync] DELETE_POS_PRODUCT impossible (contrainte FK), passage en is_active=false :', error.message);
            const { error: updateError } = await supabase.from('pos_products').update({ is_active: false }).eq('id', action.payload.id);
            success = !updateError;
          } else {
            success = true;
          }
          break;
        }
        case 'INSERT_POS_STOCK_MOVEMENT': {
          const { error } = await supabase.from('pos_stock_movements').insert([{
            id: action.payload.id,
            product_id: action.payload.productId,
            type: action.payload.type,
            quantity: action.payload.quantity,
            reference: action.payload.reference || null,
            date: action.payload.date || new Date().toISOString(),
            created_by: action.payload.createdBy || null,
            notes: action.payload.notes || null
          }]);
          if (error) console.error('[Sync] INSERT_POS_STOCK_MOVEMENT échoué :', error);
          success = !error;
          break;
        }
        case 'INSERT_POS_STOCK_ENTRY': {
          const { lines, ...entryData } = action.payload;
          const { error } = await supabase.from('pos_stock_entries').insert([{
            id: entryData.id,
            reference: entryData.reference,
            supplier_id: isUuid(entryData.supplierId) ? entryData.supplierId : null,
            date: entryData.date,
            total_amount: entryData.totalAmount ?? 0,
            status: entryData.status,
            notes: entryData.notes || null,
            created_by: isUuid(entryData.createdBy) ? entryData.createdBy : null
          }]);
          if (!error && lines && lines.length > 0) {
            const linesData = lines.map((l: any) => ({
              id: l.id, entry_id: entryData.id, product_id: l.productId,
              quantity: l.quantity, purchase_price: l.purchasePrice, total: l.total
            }));
            await supabase.from('pos_stock_entry_lines').insert(linesData);
          }
          success = !error;
          break;
        }
        case 'UPDATE_POS_STOCK_ENTRY': {
          const { id, lines, ...data } = action.payload;
          const mapped: any = {};
          if (data.status !== undefined) mapped.status = data.status;
          if (data.totalAmount !== undefined) mapped.total_amount = data.totalAmount;
          const { error } = await supabase.from('pos_stock_entries').update(mapped).eq('id', id);
          if (!error) {
            await supabase.from('pos_stock_entry_lines').delete().eq('entry_id', id);
            if (lines && lines.length > 0) {
              const linesData = lines.map((l: any) => ({
                id: l.id, entry_id: id, product_id: l.productId,
                quantity: l.quantity, purchase_price: l.purchasePrice, total: l.total
              }));
              await supabase.from('pos_stock_entry_lines').insert(linesData);
            }
          }
          success = !error;
          break;
        }
        case 'DELETE_POS_STOCK_ENTRY': {
          const { error } = await supabase.from('pos_stock_entries').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_POS_INVENTORY': {
          const { lines, ...invData } = action.payload;
          const { error } = await supabase.from('pos_inventories').insert([{
            id: invData.id, reference: invData.reference, date: invData.date,
            status: invData.status, notes: invData.notes,
            created_by: isUuid(invData.createdBy) ? invData.createdBy : null
          }]);
          if (!error && lines && lines.length > 0) {
            const linesData = lines.map((l: any) => ({
              id: l.id || uuidv4(), inventory_id: invData.id, product_id: isUuid(l.productId) ? l.productId : null,
              expected_qty: l.expectedQty, counted_qty: l.countedQty, difference: l.difference
            }));
            await supabase.from('pos_inventory_lines').insert(linesData);
          }
          success = !error;
          break;
        }
        case 'UPDATE_POS_INVENTORY': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.status !== undefined) mapped.status = data.status;
          const { error } = await supabase.from('pos_inventories').update(mapped).eq('id', id);
          success = !error;
          break;
        }
        case 'DELETE_POS_INVENTORY': {
          const { error } = await supabase.from('pos_inventories').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_POS_CASH_SESSION': {
          const { error } = await supabase.from('pos_cash_sessions').insert([{
            id: action.payload.id, cashier_id: action.payload.cashierId,
            opened_at: action.payload.openedAt, initial_fund: action.payload.initialFund,
            status: action.payload.status
          }]);
          success = !error;
          break;
        }
        case 'UPDATE_POS_CASH_SESSION': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.closedAt !== undefined) mapped.closed_at = data.closedAt;
          if (data.finalAmount !== undefined) mapped.final_amount = data.finalAmount;
          if (data.expectedAmount !== undefined) mapped.expected_amount = data.expectedAmount;
          if (data.difference !== undefined) mapped.difference = data.difference;
          if (data.status !== undefined) mapped.status = data.status;
          const { error } = await supabase.from('pos_cash_sessions').update(mapped).eq('id', id);
          success = !error;
          break;
        }
        case 'INSERT_POS_TRANSACTION': {
          const { lines, payments, ...txData } = action.payload;
          
          const p_transaction = {
            id: txData.id, transaction_number: txData.transactionNumber, cashier_id: txData.cashierId,
            session_id: txData.sessionId, date: txData.date, subtotal: txData.subtotal,
            discount_amount: txData.discountAmount, total: txData.total,
            status: txData.status
          };

          const p_lines = (lines || []).map((l: any) => ({
            id: l.id, transaction_id: txData.id, product_id: l.productId,
            description: l.description, quantity: l.quantity, unit_price: l.unitPrice,
            discount_percent: l.discountPercent, discount_amount: l.discountAmount, total: l.total
          }));

          const p_payments = (payments || []).map((p: any) => ({
            id: p.id, transaction_id: txData.id, method: p.method,
            amount: p.amount, reference: p.reference
          }));

          let p_stock_entry = null;
          let p_stock_entry_lines = null;

          const { error } = await supabase.rpc('process_pos_transaction', {
            p_transaction, p_lines, p_payments, p_stock_entry, p_stock_entry_lines
          });

          success = !error;
          break;
        }
        case 'UPDATE_POS_TRANSACTION': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.status !== undefined) mapped.status = data.status;
          const { error } = await supabase.from('pos_transactions').update(mapped).eq('id', id);
          success = !error;
          break;
        }
        case 'CLEAR_POS_SALES_HISTORY': {
          await supabase.from('pos_return_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('pos_returns').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('pos_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('pos_transaction_lines').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          await supabase.from('pos_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
          success = true;
          break;
        }
        case 'INSERT_POS_PAYMENT': {
          const { error } = await supabase.from('pos_payments').insert([{
            id: action.payload.id, transaction_id: action.payload.transactionId,
            method: action.payload.method, amount: action.payload.amount,
            reference: action.payload.reference
          }]);
          success = !error;
          break;
        }
        case 'INSERT_POS_DISCOUNT': {
          const { error } = await supabase.from('pos_discounts').insert([{
            id: action.payload.id, name: action.payload.name, type: action.payload.type,
            value: action.payload.value, max_percent: action.payload.maxPercent,
            max_amount: action.payload.maxAmount, active: action.payload.active
          }]);
          success = !error;
          break;
        }
        case 'UPDATE_POS_DISCOUNT': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.name !== undefined) mapped.name = data.name;
          if (data.type !== undefined) mapped.type = data.type;
          if (data.value !== undefined) mapped.value = data.value;
          if (data.maxPercent !== undefined) mapped.max_percent = data.maxPercent;
          if (data.maxAmount !== undefined) mapped.max_amount = data.maxAmount;
          if (data.active !== undefined) mapped.active = data.active;
          const { error } = await supabase.from('pos_discounts').update(mapped).eq('id', id);
          success = !error;
          break;
        }
        case 'DELETE_POS_DISCOUNT': {
          const { error } = await supabase.from('pos_discounts').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'UPDATE_POS_SETTINGS': {
          const { error } = await supabase.from('pos_settings').update({
            library_name: action.payload.libraryName, address: action.payload.address,
            phone: action.payload.phone, email: action.payload.email,
            currency: action.payload.currency,
            ticket_message: action.payload.ticketMessage, printer_type: action.payload.printerType
          }).eq('id', 1);
          success = !error;
          break;
        }
        case 'INSERT_POS_RETURN': {
          const { lines, exchangeLines, ...returnData } = action.payload;
          const { error } = await supabase.from('pos_returns').insert([{
            id: returnData.id, return_number: returnData.returnNumber,
            transaction_id: isUuid(returnData.transactionId) ? returnData.transactionId : null,
            date: returnData.date,
            type: returnData.type, total_refund: returnData.totalRefund ?? 0,
            total_exchange: returnData.totalExchange ?? 0, status: returnData.status,
            notes: returnData.notes || null,
            created_by: isUuid(returnData.createdBy) ? returnData.createdBy : null
          }]);
          if (!error) {
            const allLinesData: any[] = [];
            if (lines && lines.length > 0) {
              lines.forEach((l: any) => {
                allLinesData.push({
                  id: l.id || uuidv4(),
                  return_id: returnData.id,
                  product_id: isUuid(l.productId) ? l.productId : null,
                  description: l.description,
                  quantity: l.quantity,
                  unit_price: l.unitPrice,
                  total: l.total,
                  reason: l.reason || 'Retour'
                });
              });
            }
            if (exchangeLines && exchangeLines.length > 0) {
              exchangeLines.forEach((l: any) => {
                allLinesData.push({
                  id: l.id || uuidv4(),
                  return_id: returnData.id,
                  product_id: isUuid(l.productId) ? l.productId : null,
                  description: l.description,
                  quantity: l.quantity,
                  unit_price: l.unitPrice,
                  total: l.total,
                  reason: 'Échange'
                });
              });
            }
            if (allLinesData.length > 0) {
              await supabase.from('pos_return_lines').insert(allLinesData);
            }
          }
          success = !error;
          break;
        }
        case 'UPDATE_POS_RETURN': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.status !== undefined) mapped.status = data.status;
          const { error } = await supabase.from('pos_returns').update(mapped).eq('id', id);
          success = !error;
          break;
        }
        case 'INSERT_PRODUCT_COMPLETION': {
          const { error } = await supabase.from('product_completions').insert([{
            id: action.payload.id,
            product_id: action.payload.productId,
            missing_field: action.payload.missingField,
            current_value: action.payload.currentValue,
            suggested_value: action.payload.suggestedValue,
            created_at: action.payload.createdAt
          }]);
          success = !error;
          break;
        }
        case 'UPDATE_PRODUCT_COMPLETION': {
          const { id, ...data } = action.payload;
          const { error } = await supabase.from('product_completions').update(data).eq('id', id);
          success = !error;
          break;
        }
        case 'DELETE_PRODUCT_COMPLETION': {
          const { error } = await supabase.from('product_completions').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_IMPORT_SESSION': {
          const { errors, ...sessionData } = action.payload;
          const { error } = await supabase.from('import_sessions').insert([{
            id: sessionData.id,
            filename: sessionData.filename,
            status: sessionData.status,
            total_rows: sessionData.totalRows,
            processed_rows: sessionData.processedRows,
            successful_creations: sessionData.successfulCreations,
            successful_updates: sessionData.successfulUpdates,
            ignored_rows: sessionData.ignoredRows,
            created_at: sessionData.createdAt,
            completed_at: sessionData.completedAt || null
          }]);
          if (!error && errors && errors.length > 0) {
            const errorData = errors.map((e: any) => ({
              row_number: e.row, session_id: sessionData.id, field_name: e.field,
              field_value: e.value, error_message: e.error, severity: e.severity
            }));
            await supabase.from('import_errors').insert(errorData);
          }
          success = !error;
          break;
        }
        case 'UPDATE_IMPORT_SESSION': {
          const { id, ...data } = action.payload;
          const mapped: any = {};
          if (data.status !== undefined) mapped.status = data.status;
          if (data.processedRows !== undefined) mapped.processed_rows = data.processedRows;
          if (data.successfulCreations !== undefined) mapped.successful_creations = data.successfulCreations;
          if (data.successfulUpdates !== undefined) mapped.successful_updates = data.successfulUpdates;
          if (data.ignoredRows !== undefined) mapped.ignored_rows = data.ignoredRows;
          if (data.completedAt !== undefined) mapped.completed_at = data.completedAt;
          const { error } = await supabase.from('import_sessions').update(mapped).eq('id', id);
          success = !error;
          break;
        }
        case 'DELETE_IMPORT_SESSION': {
          const { error } = await supabase.from('import_sessions').delete().eq('id', action.payload.id);
          success = !error;
          break;
        }
        case 'INSERT_IMPORT_ERROR': {
          const { error } = await supabase.from('import_errors').insert([{
            id: uuidv4(),
            row_number: action.payload.row,
            session_id: action.payload.sessionId || null,
            field_name: action.payload.field,
            field_value: action.payload.value,
            error_message: action.payload.error,
            severity: action.payload.severity
          }]);
          success = !error;
          break;
        }
        case 'INSERT_DOCUMENT': {
          const { id, name, type, sizeBytes, filePath, uploaderId, createdAt } = action.payload;
          const fileData: Blob | null = await db.documentFiles.getItem(id);
          let storageSuccess = true;
          
          if (fileData) {
            const { error: storageError } = await supabase.storage.from('crm_documents').upload(filePath, fileData, { upsert: true });
            if (storageError) {
              console.error('[Sync] INSERT_DOCUMENT Storage Error:', storageError);
              storageSuccess = false;
            }
          }
          
          if (storageSuccess) {
            const { error } = await supabase.from('crm_documents').insert([{
              id, name, type, size_bytes: sizeBytes, file_path: filePath, uploader_id: uploaderId, created_at: createdAt
            }]);
            success = !error;
          } else {
            success = false;
          }
          break;
        }
        case 'DELETE_DOCUMENT': {
          const { id, filePath } = action.payload;
          const { error: storageError } = await supabase.storage.from('crm_documents').remove([filePath]);
          const { error } = await supabase.from('crm_documents').delete().eq('id', id);
          success = !error && !storageError;
          break;
        }
        default:
          success = true; // Ignore unknown actions
      }

      // Qu'il y ait succès ou échec logique (rejet de la DB), on retire l'action pour éviter le syndrome de la Poison Pill.
      // Les vraies pannes réseau (fetch failed) lèveront une exception et tomberont dans le catch.
      // Marquer l'action comme traitée (pour la retirer de la file)
      processedIds.add(action.id);
      
      if (!success) {
        console.warn(`[Sync] Action ${action.type} ignorée suite à un rejet du serveur (erreur logique). Sauvegardée dans syncErrors.`);
        try {
          const errors = await db.syncErrors.getItem<any[]>('errors') || [];
          errors.push({ action, failedAt: new Date().toISOString() });
          await db.syncErrors.setItem('errors', errors);
        } catch(err) {
          console.error('Impossible de sauvegarder dans syncErrors', err);
        }

        // Notifier l'utilisateur pour les actions critiques (transactions, sessions de caisse)
        const criticalActions: SyncActionType[] = [
          'INSERT_POS_TRANSACTION', 'INSERT_POS_CASH_SESSION', 'UPDATE_POS_CASH_SESSION'
        ];
        if (criticalActions.includes(action.type)) {
          const labels: Partial<Record<SyncActionType, string>> = {
            'INSERT_POS_TRANSACTION': '⚠️ Une transaction de caisse n\'a pas pu être synchronisée avec le serveur. Consultez la page Erreurs de Sync.',
            'INSERT_POS_CASH_SESSION': '⚠️ L\'ouverture de session caisse n\'a pas pu être synchronisée.',
            'UPDATE_POS_CASH_SESSION': '⚠️ La fermeture de session caisse n\'a pas pu être synchronisée.',
          };
          const message = labels[action.type] || `⚠️ Échec de synchronisation : ${action.type}`;
          // Dispatche un CustomEvent que l'AppContext peut écouter pour afficher un toast
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sync-critical-error', { detail: { message, action } }));
          }
        }
      }
    } catch (e) {
      console.error('Erreur de synchronisation pour l\'action', action, e);
      break; // Stop sur la première erreur réseau
    }
  }

  // Sauvegarder la file d'attente restante sans écraser les nouvelles actions
  const latestQueue: SyncAction[] = (await db.syncQueue.getItem('queue')) || [];
  const nextQueue = latestQueue.filter(a => !processedIds.has(a.id));
  await db.syncQueue.setItem('queue', nextQueue);
  } finally {
    syncLock = false;
  }
};

// Ecouter les retours de connexion
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Connexion rétablie. Synchronisation en cours...');
    processSyncQueue();
  });
}
