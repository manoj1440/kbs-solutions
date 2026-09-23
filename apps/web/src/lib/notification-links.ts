export type WebArea = 'admin' | 'manager' | 'accounts';

/**
 * F-701 / F-804: where a notification target opens in each web area. `targetRole` comes from the API's scope re-check
 * (User targets); unknown targets have no web page and stay readable in the list.
 */
export function notificationHref(area: WebArea, entityType: string, id: string, targetRole?: string | null): string | null {
  switch (area) {
    case 'admin':
      if (entityType === 'Lead') return `/admin/leads/${id}`;
      if (entityType === 'PayoutRequest') return `/admin/payouts/requests/${id}`;
      if (entityType === 'MisImportBatch') return `/admin/mis/batches/${id}`;
      if (entityType === 'User') return targetRole === 'ADVISOR' ? `/admin/onboarding/${id}` : `/admin/users/${id}`;
      return null;
    case 'manager':
      if (entityType === 'Lead') return `/manager/leads/${id}`;
      if (entityType === 'PayoutRequest') return `/manager/payouts/requests/${id}`;
      if (entityType === 'User' && targetRole === 'TELECALLER') return `/manager/telecallers/${id}`;
      if (entityType === 'User' && targetRole === 'ADVISOR') return `/manager/advisors/${id}`;
      return null;
    case 'accounts':
      return entityType === 'PayoutRequest' ? `/accounts/requests/${id}` : null;
  }
}
