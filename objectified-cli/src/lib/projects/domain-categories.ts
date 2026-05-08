/**
 * Domain category ids for projects (#243 / objectified-ui `project-domain-categories.ts`).
 * Used when GET …/domains is unavailable and for interactive labels.
 */
export type ProjectDomainChoice = { id: string; label: string };

export const PROJECT_DOMAIN_CATEGORY_NONE = "none";

export const PROJECT_DOMAIN_CHOICES: readonly ProjectDomainChoice[] = [
  { id: "iot", label: "IoT device schemas" },
  { id: "social", label: "Social media entities" },
  { id: "gaming", label: "Gaming (Player, Match, Leaderboard)" },
  { id: "travel", label: "Travel & hospitality" },
  { id: "media", label: "Media & entertainment" },
  { id: "ecommerce", label: "E-commerce (Product, Cart, Order, Payment, Shipping)" },
  { id: "healthcare", label: "Healthcare (Patient, Appointment, Medication, Insurance)" },
  { id: "finance", label: "Finance (Account, Transaction, Investment, Loan)" },
  { id: "saas", label: "SaaS (Tenant, User, Subscription, Usage)" },
  { id: "education", label: "Education (Course, Student, Assignment, Grade)" },
  { id: "realestate", label: "Real Estate (Property, Listing, Agent, Transaction)" },
  { id: "logistics", label: "Logistics (Shipment, Route, Warehouse, Delivery)" },
];

const ids = PROJECT_DOMAIN_CHOICES.map((c) => c.id);

/** Fallback allowlist when the projects domains API is not deployed (#3204). */
export const PROJECT_DOMAIN_FALLBACK_IDS: readonly string[] = ids;

export function domainChoiceLabel(id: string): string | undefined {
  return PROJECT_DOMAIN_CHOICES.find((c) => c.id === id)?.label;
}
