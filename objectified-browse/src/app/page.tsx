import Link from "next/link";
import { getPublicTenants } from "../../lib/db/helper";
import { HomeClient } from "./HomeClient";

export default async function Home() {
  const tenants = await getPublicTenants();

  return <HomeClient tenants={tenants} />;
}

