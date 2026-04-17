import {
  getPublicTenants,
  getRecentlyPublishedVersions,
  getMostVersionedProjects,
  getNewestTenants,
  getDirectoryStats,
} from '../../lib/db/helper';
import { HomeClient } from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [tenants, recentVersions, popularProjects, newestTenants, stats] = await Promise.all([
    getPublicTenants(),
    getRecentlyPublishedVersions(8),
    getMostVersionedProjects(8),
    getNewestTenants(8),
    getDirectoryStats(),
  ]);

  return (
    <HomeClient
      tenants={tenants}
      recentVersions={recentVersions}
      popularProjects={popularProjects}
      newestTenants={newestTenants}
      stats={stats}
    />
  );
}
