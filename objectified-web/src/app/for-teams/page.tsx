import {
  ArrowRight,
  Building2,
  Users,
  TrendingDown,
  Clock,
  Zap,
  ShieldCheck,
  GitBranch,
  Code2,
  Database,
  CheckCircle2,
  HelpCircle
} from "lucide-react";
import { Button } from "../components/ui/Button";

export default function ForTeamsPage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-b from-white to-zinc-50 px-6 py-20 dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900 sm:py-32">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="container relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
              <Building2 className="h-4 w-4" />
              For Development Teams
            </div>
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl lg:text-7xl">
              Built for Teams Who{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Ship Faster
              </span>
            </h1>
            <p className="mb-10 text-xl text-zinc-600 dark:text-zinc-400">
              Reduce development time, cut costs, and eliminate documentation debt with the platform that brings
              your entire team together around a single source of truth.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="https://app.objectified.dev" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="group">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
              <a href="#roi-calculator">
                <Button size="lg" variant="outline">
                  Calculate Your Savings
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Who This Is For */}
      <section className="border-b border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              Who Objectified Is Built For
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              Whether you're a startup or enterprise, Objectified accelerates your development workflow
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* API Development Teams */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Code2 className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                API Development Teams
              </h3>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                Backend developers building RESTful APIs who need clear specifications, consistent schemas, and automated documentation.
              </p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                  <span>Eliminate spec drift</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                  <span>Generate consistent DTOs</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                  <span>Auto-sync documentation</span>
                </li>
              </ul>
            </div>

            {/* Database Architects */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Database Architects
              </h3>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                DBAs and data engineers designing complex schemas who need visualization, version control, and migration management.
              </p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                  <span>Visual schema design</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                  <span>Automated migrations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                  <span>Multi-database support</span>
                </li>
              </ul>
            </div>

            {/* Product Teams */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Product Teams
              </h3>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                Product managers and technical leads who need to understand API contracts, plan features, and align stakeholders.
              </p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Visual data models</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Non-technical collaboration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span>Stakeholder alignment</span>
                </li>
              </ul>
            </div>

            {/* Frontend Developers */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Frontend Developers
              </h3>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                UI developers who need clear API contracts, type-safe SDKs, and reliable backend specifications.
              </p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                  <span>Type-safe SDKs</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                  <span>Clear API contracts</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                  <span>Mock server generation</span>
                </li>
              </ul>
            </div>

            {/* DevOps Engineers */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <GitBranch className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                DevOps Engineers
              </h3>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                Infrastructure teams managing deployments, CI/CD pipelines, and database migrations across environments.
              </p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
                  <span>Automated migrations</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
                  <span>Environment consistency</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
                  <span>CI/CD integration</span>
                </li>
              </ul>
            </div>

            {/* Enterprise CTOs */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Enterprise CTOs
              </h3>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                Technical leaders who need governance, compliance, and visibility across all API and database assets.
              </p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                  <span>Central governance</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                  <span>Audit trails</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />
                  <span>Cost reduction</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Cost Savings Section */}
      <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-20 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              How Objectified Saves Your Company Money
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              Real cost savings that impact your bottom line
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Development Time Reduction */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-start justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <Clock className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">60%</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Time Saved</div>
                </div>
              </div>
              <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Reduce Development Time
              </h3>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                Eliminate hours of manual API documentation, schema design, and boilerplate code generation.
              </p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <TrendingDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                  <span><strong>Before:</strong> 2-3 weeks for API design + documentation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span><strong>After:</strong> 3-5 days with visual design + auto-generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    💰 Save $15,000-$30,000 per API project
                  </span>
                </li>
              </ul>
            </div>

            {/* Reduced Technical Debt */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-start justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-purple-600">80%</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Less Debt</div>
                </div>
              </div>
              <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Eliminate Technical Debt
              </h3>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                Stop paying the "documentation debt tax" where specs and code drift apart over time.
              </p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <TrendingDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                  <span><strong>Before:</strong> 10-15 hours/month maintaining docs</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span><strong>After:</strong> Auto-synced specs, zero maintenance</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    💰 Save $12,000-$18,000 per year per team
                  </span>
                </li>
              </ul>
            </div>

            {/* Onboarding Efficiency */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-start justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
                  <Users className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-600">75%</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Faster Onboarding</div>
                </div>
              </div>
              <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Faster Team Onboarding
              </h3>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                New developers understand your APIs and schemas instantly with visual documentation.
              </p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <TrendingDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span><strong>Before:</strong> 2-4 weeks to understand system</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span><strong>After:</strong> 3-5 days with visual models</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    💰 Save $8,000-$12,000 per new hire
                  </span>
                </li>
              </ul>
            </div>

            {/* Reduced Bug Fixes */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-start justify-between">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                  <Zap className="h-6 w-6" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-orange-600">70%</div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Fewer Bugs</div>
                </div>
              </div>
              <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Prevent Integration Bugs
              </h3>
              <p className="mb-4 text-zinc-600 dark:text-zinc-400">
                Type-safe code generation and contract testing catch issues before production.
              </p>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-2">
                  <TrendingDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-600" />
                  <span><strong>Before:</strong> 20-30 integration bugs per quarter</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                  <span><strong>After:</strong> 5-10 bugs caught at compile time</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    💰 Save $25,000-$40,000 per year in bug fixes
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Total Savings */}
          <div className="mt-12 rounded-2xl border-2 border-blue-600 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 text-center dark:from-blue-950/30 dark:to-indigo-950/30">
            <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              Estimated Annual Savings
            </div>
            <div className="mb-2 text-5xl font-bold text-zinc-900 dark:text-zinc-50">
              $60,000 - $100,000
            </div>
            <div className="mb-6 text-lg text-zinc-600 dark:text-zinc-400">
              Per 5-person development team
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Based on industry averages for time saved, reduced bugs, and eliminated technical debt
            </p>
          </div>
        </div>
      </section>

      {/* Questions Answered Section */}
      <section className="border-b border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              Questions Objectified Answers
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              Get instant answers to critical questions that slow down development
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* API Questions */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <HelpCircle className="h-5 w-5" />
                <h3 className="font-semibold">API Design Questions</h3>
              </div>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li>• What endpoints does this API expose?</li>
                <li>• What's the request/response format?</li>
                <li>• Which parameters are required?</li>
                <li>• What authentication is needed?</li>
                <li>• What are the error responses?</li>
                <li>• Is this API versioned?</li>
              </ul>
            </div>

            {/* Database Questions */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <HelpCircle className="h-5 w-5" />
                <h3 className="font-semibold">Database Questions</h3>
              </div>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li>• What tables exist in the database?</li>
                <li>• What are the relationships?</li>
                <li>• Which fields are indexed?</li>
                <li>• What constraints are defined?</li>
                <li>• How do I migrate this schema?</li>
                <li>• What's the data model?</li>
              </ul>
            </div>

            {/* Integration Questions */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                <HelpCircle className="h-5 w-5" />
                <h3 className="font-semibold">Integration Questions</h3>
              </div>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li>• How do I connect to this API?</li>
                <li>• What SDK should I use?</li>
                <li>• How do I handle errors?</li>
                <li>• What's the rate limit?</li>
                <li>• How do I test this integration?</li>
                <li>• Where's the documentation?</li>
              </ul>
            </div>

            {/* Team Questions */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <HelpCircle className="h-5 w-5" />
                <h3 className="font-semibold">Team Questions</h3>
              </div>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li>• Who owns this API?</li>
                <li>• When was it last updated?</li>
                <li>• What changed in this version?</li>
                <li>• Who approved this schema?</li>
                <li>• What's the review process?</li>
                <li>• How do I request access?</li>
              </ul>
            </div>

            {/* Compliance Questions */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <HelpCircle className="h-5 w-5" />
                <h3 className="font-semibold">Compliance Questions</h3>
              </div>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li>• Is this data GDPR compliant?</li>
                <li>• What PII is stored?</li>
                <li>• Who has access to this data?</li>
                <li>• What's our data retention policy?</li>
                <li>• Are changes audited?</li>
                <li>• How do we handle deletions?</li>
              </ul>
            </div>

            {/* Business Questions */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <HelpCircle className="h-5 w-5" />
                <h3 className="font-semibold">Business Questions</h3>
              </div>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <li>• What features can we build?</li>
                <li>• What data do we have access to?</li>
                <li>• What's the timeline estimate?</li>
                <li>• What dependencies exist?</li>
                <li>• How will this impact users?</li>
                <li>• What's the cost to implement?</li>
              </ul>
            </div>
          </div>

          <div className="mt-12 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-8 text-center dark:from-blue-950/20 dark:to-indigo-950/20">
            <h3 className="mb-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Stop Asking. Start Building.
            </h3>
            <p className="mb-6 text-zinc-600 dark:text-zinc-400">
              Every question answered instantly means less time in meetings and more time shipping features.
            </p>
            <a href="https://app.objectified.dev" target="_blank" rel="noopener noreferrer">
              <Button size="lg" className="group">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <section id="roi-calculator" className="border-b border-zinc-200 bg-zinc-50 px-6 py-20 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              Calculate Your Savings
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              See how much Objectified could save your team
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-8 space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Number of developers on your team
                </label>
                <input
                  type="number"
                  placeholder="e.g., 5"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  defaultValue="5"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Average developer hourly rate ($)
                </label>
                <input
                  type="number"
                  placeholder="e.g., 100"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  defaultValue="100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Number of API projects per year
                </label>
                <input
                  type="number"
                  placeholder="e.g., 4"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  defaultValue="4"
                />
              </div>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 dark:from-blue-950/30 dark:to-indigo-950/30">
              <div className="mb-2 text-center text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Estimated Annual Savings
              </div>
              <div className="mb-4 text-center text-4xl font-bold text-blue-600 dark:text-blue-400">
                $72,000
              </div>
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span>Development time saved:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">$32,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Technical debt reduced:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">$15,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Faster onboarding:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">$10,000</span>
                </div>
                <div className="flex justify-between">
                  <span>Bug prevention:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">$15,000</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-500">
              * Estimates based on industry averages and typical usage patterns
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-blue-600 to-indigo-600 p-12 text-center text-white dark:border-zinc-800">
            <h2 className="mb-4 text-4xl font-bold">
              Ready to Save Time and Money?
            </h2>
            <p className="mb-8 text-xl text-blue-100">
              Join development teams who've reduced API development time by 60% and saved thousands in technical debt.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="https://app.objectified.dev" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="secondary" className="bg-white text-blue-600 hover:bg-zinc-100">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="https://www.youtube.com/@objectifieddev" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  Watch Demo
                </Button>
              </a>
            </div>
            <p className="mt-6 text-sm text-blue-100">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
