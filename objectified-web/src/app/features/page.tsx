import type { Metadata } from "next";
import Image from "next/image";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Database,
  Layers,
  Zap,
  GitBranch,
  Lock,
  Users,
  FileCode,
  Eye,
  Download,
  Palette,
  Shield,
  Globe,
  BarChart3,
  Route,
  Search,
  Sparkles,
  MonitorSmartphone,
  SlidersHorizontal,
  LayoutGrid,
  Import,
  Workflow,
  Network,
  FileJson,
  Paintbrush,
  MousePointerClick,
} from "lucide-react";
import { Button } from "../components/ui/Button";

export const metadata: Metadata = {
  title: "Features - Objectified",
  description:
    "Explore the powerful features of Objectified — the visual API and schema design platform for enterprise teams.",
};

export default function FeaturesPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-b from-white to-zinc-50 px-6 py-20 dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="container relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
            <Sparkles className="h-4 w-4" />
            Continuously Improving
          </div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            Everything You Need to<br/>
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Design Better APIs
            </span>
          </h1>
          <p className="mb-8 text-xl text-zinc-600 dark:text-zinc-400">
            A unified visual platform for schema design, API path authoring,
            enterprise-grade importing, and OpenAPI specification generation —
            built for teams who ship faster.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="https://app.objectified.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="group">
                Launch App
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
            <a
              href="https://www.youtube.com/@objectifieddev"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline">
                Watch Demo
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ─── VISUAL SCHEMA CANVAS ─── */}
      <section className="border-b border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
                Schema Canvas
              </div>
              <h2 className="mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Visual Schema Designer
              </h2>
              <p className="mb-6 text-lg text-zinc-600 dark:text-zinc-400">
                Design data models on an interactive canvas with drag-and-drop
                simplicity. See relationships, constraints, and dependencies at
                a glance — no YAML editing required.
              </p>
              <ul className="space-y-3">
                {[
                  "Drag-and-drop class creation with property editors",
                  "Smart auto-layout algorithms",
                  "Color-coded groups with collapsible containers",
                  "Real-time relationship visualization with animated edges",
                  "Version comparison with side-by-side diff highlighting",
                  "10+ canvas themes including dark mode and blueprint",
                  "Canvas export to PNG, SVG, PDF, Mermaid, PlantUML, and more",
                  "Quality scoring with completeness and consistency grades",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-black dark:border-black">
                <Image
                  src="/features-01.png"
                  alt="Visual Schema Designer canvas showing drag-and-drop classes, relationships, and auto-layout"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PATHS DESIGNER ─── */}
      <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-20 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="order-2 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950 lg:order-1">
              <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-black dark:border-black">
                <Image
                  src="/features-02.png"
                  alt="Paths Designer showing HTTP operations, parameters, and response schema binding"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                Paths Designer
              </div>
              <h2 className="mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Visual API Path Authoring
              </h2>
              <p className="mb-6 text-lg text-zinc-600 dark:text-zinc-400">
                Design every endpoint visually — operations, parameters, request
                bodies, responses, and security schemes — all on a dedicated
                developer-focused canvas with HTTP method color coding and
                real-time OpenAPI validation.
              </p>
              <ul className="space-y-3">
                {[
                  "HTTP method nodes with GET, POST, PUT, PATCH, DELETE color coding",
                  "Drag-and-drop parameters, responses, and schema bindings",
                  "Multi-content-type support (JSON, XML, multipart/form-data)",
                  "Inline schema editing with class reference ($ref) binding",
                  "Response status code color bands (2xx, 3xx, 4xx, 5xx)",
                  "Security scheme configuration (API Key, Bearer, OAuth2)",
                  "Smart edge routing with animated data flow visualization",
                  "Auto-generate CRUD operations from existing schemas",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ENTERPRISE IMPORTER ─── */}
      <section className="border-b border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-purple-700 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-300">
                Enterprise Import
              </div>
              <h2 className="mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Import from Anywhere
              </h2>
              <p className="mb-6 text-lg text-zinc-600 dark:text-zinc-400">
                Bring your existing API specifications into Objectified with a
                guided, multi-step import wizard. Supports file upload, URL
                fetch, Git repository cloning, SwaggerHub, clipboard paste, and
                even AI-generated specs from natural language.
              </p>
              <ul className="space-y-3">
                {[
                  "OpenAPI 3.1, 3.0, Swagger 2.0, JSON Schema, and GraphQL",
                  "Git import from GitHub, GitLab, and Bitbucket with branch selection",
                  "SwaggerHub integration with public and private API support",
                  "AI-powered import: describe your API in plain English",
                  "Quality scoring (A–F) with completeness and consistency analysis",
                  "Transaction-based execution with approval workflow",
                  "Real-time progress tracking with live event logs",
                  "Schema selection with dependency resolution",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-black dark:border-black">
                <Image
                  src="/features-03.png"
                  alt="Enterprise Import wizard with multi-source import and quality scoring"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── COMPLETE FEATURE GRID ─── */}
      <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-20 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              Complete Platform Capabilities
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              Every tool you need to design, validate, export, and collaborate
              on APIs — in one place.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<LayoutGrid className="h-6 w-6" />}
              title="Interactive Canvas"
              description="Drag-and-drop schema design with smart auto-layout, grid snapping, minimap navigation, and zoom controls"
              color="blue"
            />
            <FeatureCard
              icon={<Route className="h-6 w-6" />}
              title="Paths Designer"
              description="Visual endpoint authoring with HTTP method color coding, parameter editing, and response schema binding"
              color="emerald"
            />
            <FeatureCard
              icon={<Import className="h-6 w-6" />}
              title="Multi-Source Import"
              description="Import from file, URL, Git, SwaggerHub, clipboard, or AI — with quality scoring and guided wizard"
              color="purple"
            />
            <FeatureCard
              icon={<Layers className="h-6 w-6" />}
              title="Multi-Tenant Architecture"
              description="Organize projects by teams and organizations with granular permission controls and isolated workspaces"
              color="green"
            />
            <FeatureCard
              icon={<GitBranch className="h-6 w-6" />}
              title="Version Control"
              description="Full version history with side-by-side comparison, diff highlighting, and semantic change tracking"
              color="indigo"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Code Generation"
              description="Generate OpenAPI specs, database migrations, and DTO stubs from your visual designs automatically"
              color="orange"
            />
            <FeatureCard
              icon={<Paintbrush className="h-6 w-6" />}
              title="10+ Canvas Themes"
              description="Light, dark, high contrast, blueprint, whiteboard, solarized, nord, and more — switch instantly"
              color="pink"
            />
            <FeatureCard
              icon={<Network className="h-6 w-6" />}
              title="Relationship Visualization"
              description="Animated edges with smart routing, cardinality labels, and constraint badges for clear data flow"
              color="cyan"
            />
            <FeatureCard
              icon={<FileCode className="h-6 w-6" />}
              title="Rich Export Options"
              description="Export canvas to PNG, SVG, PDF, Mermaid, PlantUML, GraphML, DOT, or raw JSON with an export wizard"
              color="violet"
            />
            <FeatureCard
              icon={<Search className="h-6 w-6" />}
              title="Canvas Search"
              description="Find any class or property instantly with Cmd+F search, regex support, and result highlighting"
              color="amber"
            />
            <FeatureCard
              icon={<Lock className="h-6 w-6" />}
              title="Enterprise Security"
              description="Role-based access control, SSO integration, audit logs, and compliance features for enterprise teams"
              color="rose"
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="API Security Schemes"
              description="Configure OAuth2, API Key, Bearer token, and OpenID Connect security directly on operations"
              color="red"
            />
            <FeatureCard
              icon={<Sparkles className="h-6 w-6" />}
              title="AI-Powered Import"
              description="Describe your API in plain English and let AI generate a complete OpenAPI specification for you"
              color="sky"
            />
            <FeatureCard
              icon={<SlidersHorizontal className="h-6 w-6" />}
              title="Quality Scoring"
              description="Automated A–F quality grades measuring completeness, consistency, best practices, and security coverage"
              color="teal"
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6" />}
              title="Public API Browser"
              description="Share your API specifications publicly and browse community-shared designs for inspiration"
              color="emerald"
            />
            <FeatureCard
              icon={<MousePointerClick className="h-6 w-6" />}
              title="Drag-and-Drop Everything"
              description="Operations, classes, properties, and schemas can all be dragged from the sidebar directly onto the canvas"
              color="orange"
            />
            <FeatureCard
              icon={<Eye className="h-6 w-6" />}
              title="Level of Detail"
              description="Nodes simplify automatically when zoomed out, showing only class names for a clean bird's-eye view"
              color="indigo"
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Schema Analytics"
              description="Track total classes, properties, relationships, and complexity metrics across your entire project"
              color="blue"
            />
          </div>
        </div>
      </section>

      {/* ─── HOW IT COMPARES ─── */}
      <section className="border-b border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              Why Teams Choose Objectified
            </h2>
            <p className="mx-auto max-w-2xl text-xl text-zinc-600 dark:text-zinc-400">
              Unlike text-only spec editors or heavyweight API gateways,
              Objectified is a visual-first design platform purpose-built for
              teams who think in data models and endpoints.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-4 pr-6 font-semibold text-zinc-900 dark:text-zinc-50">
                    Capability
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-blue-600 dark:text-blue-400">
                    Objectified
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-zinc-500 dark:text-zinc-400">
                    Swagger Editor
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-zinc-500 dark:text-zinc-400">
                    Stoplight Studio
                  </th>
                  <th className="px-4 py-4 text-center font-semibold text-zinc-500 dark:text-zinc-400">
                    Postman
                  </th>
                </tr>
              </thead>
              <tbody className="text-zinc-600 dark:text-zinc-400">
                {comparisonRows.map(({ feature, objectified, swagger, stoplight, postman }) => (
                  <tr
                    key={feature}
                    className="border-b border-zinc-100 dark:border-zinc-800/50"
                  >
                    <td className="py-3 pr-6 font-medium text-zinc-900 dark:text-zinc-200">
                      {feature}
                    </td>
                    <td className="px-4 py-3 text-center">{objectified}</td>
                    <td className="px-4 py-3 text-center">{swagger}</td>
                    <td className="px-4 py-3 text-center">{stoplight}</td>
                    <td className="px-4 py-3 text-center">{postman}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Comparison based on publicly available feature sets as of February
            2026. Feature availability may change.
          </p>
        </div>
      </section>

      {/* ─── DEVELOPER WORKFLOW ─── */}
      <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-20 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              Your Design-to-Deployment Workflow
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              From first schema sketch to production-ready OpenAPI spec in four
              steps
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-4">
            {[
              {
                step: 1,
                title: "Design Schemas",
                description:
                  "Drag classes onto the canvas, define properties and types, and draw relationships between your data models.",
                color: "bg-blue-600",
              },
              {
                step: 2,
                title: "Author Paths",
                description:
                  "Open the Paths Designer to create endpoints, bind schemas to request bodies and responses, and configure security.",
                color: "bg-emerald-600",
              },
              {
                step: 3,
                title: "Validate & Score",
                description:
                  "Run real-time OpenAPI validation, review quality scores, and fix issues before exporting your specification.",
                color: "bg-purple-600",
              },
              {
                step: 4,
                title: "Export & Ship",
                description:
                  "Export as OpenAPI YAML/JSON, generate code stubs, or share your API documentation with your team and consumers.",
                color: "bg-orange-600",
              },
            ].map(({ step, title, description, color }) => (
              <div key={step} className="text-center">
                <div
                  className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full ${color} text-xl font-bold text-white`}
                >
                  {step}
                </div>
                <h3 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {title}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="px-6 py-20">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-blue-600 to-indigo-600 p-12 text-center text-white dark:border-zinc-800">
            <h2 className="mb-4 text-4xl font-bold">
              Ready to design better APIs?
            </h2>
            <p className="mb-8 text-xl text-blue-100">
              Join the developers and teams already using Objectified to
              visually design, validate, and ship their API specifications.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="https://app.objectified.dev"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-white text-blue-600 hover:bg-zinc-100"
                >
                  Launch App
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a
                href="https://browse.objectified.dev"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  Browse Public APIs
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─── Comparison table data ─── */

const comparisonRows = [
  {
    feature: "Visual Schema Canvas",
    objectified: "✅",
    swagger: "❌",
    stoplight: "✅",
    postman: "❌",
  },
  {
    feature: "Visual Path / Endpoint Designer",
    objectified: "✅",
    swagger: "❌",
    stoplight: "Partial",
    postman: "❌",
  },
  {
    feature: "OpenAPI 3.1 Support",
    objectified: "✅",
    swagger: "✅",
    stoplight: "✅",
    postman: "✅",
  },
  {
    feature: "Drag-and-Drop Nodes",
    objectified: "✅",
    swagger: "❌",
    stoplight: "✅",
    postman: "❌",
  },
  {
    feature: "Multi-Format Import (Git, URL, Clipboard, AI)",
    objectified: "✅",
    swagger: "File only",
    stoplight: "File / URL",
    postman: "File / URL",
  },
  {
    feature: "AI-Powered Spec Generation",
    objectified: "✅",
    swagger: "❌",
    stoplight: "❌",
    postman: "❌",
  },
  {
    feature: "Quality Scoring (A–F)",
    objectified: "✅",
    swagger: "❌",
    stoplight: "Partial",
    postman: "❌",
  },
  {
    feature: "Canvas Themes (10+)",
    objectified: "✅",
    swagger: "❌",
    stoplight: "❌",
    postman: "❌",
  },
  {
    feature: "Canvas Export (PNG, SVG, PDF, Mermaid)",
    objectified: "✅",
    swagger: "❌",
    stoplight: "❌",
    postman: "❌",
  },
  {
    feature: "Version Side-by-Side Diff",
    objectified: "✅",
    swagger: "❌",
    stoplight: "✅",
    postman: "❌",
  },
  {
    feature: "Group Containers for Schemas",
    objectified: "✅",
    swagger: "❌",
    stoplight: "❌",
    postman: "❌",
  },
  {
    feature: "Smart Edge Routing (4 styles)",
    objectified: "✅",
    swagger: "❌",
    stoplight: "Basic",
    postman: "❌",
  },
  {
    feature: "Multi-Tenant / Team Workspaces",
    objectified: "✅",
    swagger: "❌",
    stoplight: "✅",
    postman: "✅",
  },
  {
    feature: "Free Personal Tier",
    objectified: "✅",
    swagger: "✅",
    stoplight: "✅",
    postman: "✅",
  },
];

/* ─── Reusable feature card ─── */

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400 group-hover:border-blue-300 dark:group-hover:border-blue-700",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400 group-hover:border-purple-300 dark:group-hover:border-purple-700",
    green: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400 group-hover:border-green-300 dark:group-hover:border-green-700",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400 group-hover:border-orange-300 dark:group-hover:border-orange-700",
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 group-hover:border-indigo-300 dark:group-hover:border-indigo-700",
    rose: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 group-hover:border-rose-300 dark:group-hover:border-rose-700",
    cyan: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400 group-hover:border-cyan-300 dark:group-hover:border-cyan-700",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400 group-hover:border-violet-300 dark:group-hover:border-violet-700",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400 group-hover:border-amber-300 dark:group-hover:border-amber-700",
    pink: "bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400 group-hover:border-pink-300 dark:group-hover:border-pink-700",
    red: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 group-hover:border-red-300 dark:group-hover:border-red-700",
    teal: "bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400 group-hover:border-teal-300 dark:group-hover:border-teal-700",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 group-hover:border-emerald-300 dark:group-hover:border-emerald-700",
    sky: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400 group-hover:border-sky-300 dark:group-hover:border-sky-700",
  };

  const iconBg = (colorClasses[color] || colorClasses.blue).split(" group-hover")[0];

  return (
    <div className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
      <div
        className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}
      >
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
    </div>
  );
}
