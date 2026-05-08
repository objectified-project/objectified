import { describe, expect, it } from "vitest";

import { stableDeepSort } from "../src/lib/output.js";
import {
  activeTenantMark,
  formatTenantInfoHumanLines,
  formatTenantsListHumanLines,
  type TenantInfoForDisplay,
  type TenantMembershipRow,
} from "../src/lib/tenants/format.js";

const sampleTenants: TenantMembershipRow[] = [
  { slug: "acme-corp", name: "Acme Corporation", role: "admin" },
  { slug: "acme-staging", name: "Acme (staging)", role: "admin" },
  { slug: "contoso-ltd", name: "Contoso Ltd.", role: "member" },
];

describe("tenants renderers (#3198)", () => {
  it("human tenants list with active default (Unicode star)", () => {
    const lines = formatTenantsListHumanLines({
      tenants: sampleTenants,
      profile: "default",
      profileTenantSlug: "acme-corp",
      langAscii: false,
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("human tenants list uses ASCII star when langAscii", () => {
    const lines = formatTenantsListHumanLines({
      tenants: sampleTenants,
      profile: "default",
      profileTenantSlug: "acme-corp",
      langAscii: true,
    });
    expect(lines.join("\n")).toMatchSnapshot();
  });

  it("stable JSON document for tenants list command", () => {
    const doc = stableDeepSort({
      profile: "default",
      default_tenant_slug: "acme-corp",
      tenants: sampleTenants,
      total: 3,
    });
    expect(JSON.stringify(doc, null, 2)).toMatchSnapshot();
  });

  it("human tenant info", () => {
    const info: TenantInfoForDisplay = {
      slug: "acme-corp",
      name: "Acme Corporation",
      plan: "Enterprise",
      created_at: "2024-08-12",
      members_count: 34,
      projects_count: 7,
      versions_count: 142,
      published_versions_count: 38,
      storage_used_bytes: 1_288_490_189,
      storage_quota_bytes: 107_374_182_400,
    };
    expect(formatTenantInfoHumanLines(info).join("\n")).toMatchSnapshot();
  });

  it("activeTenantMark", () => {
    expect(activeTenantMark(false)).toBe("★");
    expect(activeTenantMark(true)).toBe("*");
  });
});
