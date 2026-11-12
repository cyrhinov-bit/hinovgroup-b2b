export type CrmRole =
  | 'Directeur'
  | 'Directeur adjoint'
  | 'Responsable'
  | 'Commercial'
  | 'SuperAdmin';

export type CrmModuleKey =
  | 'crmPrestationsEnabled'
  | 'crmCaisseEnabled'
  | 'crmMaintenanceEnabled'
  | 'crmStocksEnabled'
  | 'crmTiersEnabled'
  | 'crmCommerciauxEnabled'
  | 'crmCommissionsEnabled'
  | 'crmFacturationEnabled'
  | 'crmSupFacturesEnabled'
  | 'crmReportsEnabled'
  | 'crmTeamReportsEnabled';

const DIRECTION: readonly CrmRole[] = ['Directeur', 'Directeur adjoint', 'SuperAdmin'];
const DIRECTION_AND_RESPONSABLE: readonly CrmRole[] = [...DIRECTION, 'Responsable'];
const OPERATIONAL_CRM: readonly CrmRole[] = [...DIRECTION_AND_RESPONSABLE, 'Commercial'];

export const CRM_MODULE_ACCESS = {
  crmPrestationsEnabled: OPERATIONAL_CRM,
  crmCaisseEnabled: DIRECTION_AND_RESPONSABLE,
  crmMaintenanceEnabled: DIRECTION_AND_RESPONSABLE,
  crmStocksEnabled: DIRECTION_AND_RESPONSABLE,
  crmTiersEnabled: OPERATIONAL_CRM,
  crmCommerciauxEnabled: DIRECTION_AND_RESPONSABLE,
  crmCommissionsEnabled: OPERATIONAL_CRM,
  crmFacturationEnabled: OPERATIONAL_CRM,
  crmSupFacturesEnabled: OPERATIONAL_CRM,
  crmReportsEnabled: OPERATIONAL_CRM,
  crmTeamReportsEnabled: DIRECTION,
} satisfies Record<CrmModuleKey, readonly CrmRole[]>;

export function isCrmModuleAvailable(moduleKey: CrmModuleKey, role: string): boolean {
  return CRM_MODULE_ACCESS[moduleKey].some(allowedRole => allowedRole === role);
}
