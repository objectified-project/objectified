import { getPublicTenants } from "../../lib/db/helper";
import { HomeClient } from "./HomeClient";

// Disable static caching to always fetch fresh data
export const dynamic = 'force-dynamic';

export default async function Home() {
  const tenants = await getPublicTenants();

  return <HomeClient tenants={tenants} />;
}

