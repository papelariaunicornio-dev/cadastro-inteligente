/**
 * Dashboard page — Server Component.
 * Fetches data server-side and passes to client component.
 */

import { getProductCounts, getRecentNfImports } from '@/lib/data';
import { DashboardView } from '@/components/dashboard/dashboard-view';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [counts, nfs] = await Promise.all([
    getProductCounts(),
    getRecentNfImports(),
  ]);

  return (
    <DashboardView
      initialCounts={counts}
      initialNfs={nfs.list}
    />
  );
}
