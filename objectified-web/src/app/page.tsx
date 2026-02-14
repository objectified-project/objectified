import {
  ArrowRight,
  Code2,
  Database,
  Layers,
  Zap,
  Lock,
  Star,
  GitBranch,
  Route,
  Import,
  LayoutGrid,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "./components/ui/Button";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-zinc-200 bg-gradient-to-b from-white to-zinc-50 px-6 py-20 dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900 sm:py-32">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="container relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
              <Star className="h-4 w-4" />
              Now in Public Beta
            </div>
            <h1 className="mb-8 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl lg:text-7xl">
              Design APIs & Databases{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Visually
              </span>
            </h1>
            <p className="mb-8 text-2xl font-semibold text-zinc-700 dark:text-zinc-300 sm:text-3xl">
              Your data: Designed, Defined, Discovered.
            </p>
            <p className="mb-12 text-xl text-zinc-600 dark:text-zinc-400">
              The modern platform for creating OpenAPI specifications and database schemas.<br/>
              Design schemas on an interactive canvas, author API paths visually, import from anywhere, and export production-ready specs.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="https://app.objectified.dev" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="group">
                  Launch App
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
              <a href="https://browse.objectified.dev" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline">
                  Browse APIs
                </Button>
              </a>
              <a href="https://www.youtube.com/@objectifieddev" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline">
                  Watch Demo
                </Button>
              </a>
            </div>
            <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-500">
              No credit card required • Free forever for personal use
            </p>
          </div>
        </div>
      </section>

      {/* Features Overview */}
      <section className="border-b border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              Everything you need to build better APIs
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              Powerful features that streamline your entire API development workflow
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 — Schema Canvas */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-blue-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Visual Schema Canvas
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Design data models on an interactive canvas with drag-and-drop, smart auto-layout, color-coded groups, animated edges, and 10+ themes.
              </p>
            </div>

            {/* Feature 2 — Paths Designer */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-emerald-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-emerald-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                <Route className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Paths Designer
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Author API endpoints visually with HTTP method color coding, parameter editing, response schema binding, and real-time OpenAPI validation.
              </p>
            </div>

            {/* Feature 3 — Enterprise Import */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-purple-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-purple-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                <Import className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Enterprise Import
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Import from file, URL, Git, SwaggerHub, clipboard, or AI. Guided wizard with quality scoring, validation, and transaction-based execution.
              </p>
            </div>

            {/* Feature 4 — Code Generation */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-orange-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-orange-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Export &amp; Code Generation
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Export to OpenAPI YAML/JSON, PNG, SVG, PDF, Mermaid, PlantUML, and more. Generate DTO stubs and database migrations automatically.
              </p>
            </div>

            {/* Feature 5 — Version Control */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-indigo-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-indigo-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <GitBranch className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Version Control &amp; Diff
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Track changes with full version history. Compare versions side by side with diff highlighting for added, modified, and removed schemas.
              </p>
            </div>

            {/* Feature 6 — AI-Powered */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-sky-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-sky-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                AI-Powered Design
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Describe your API in plain English and let AI generate a complete OpenAPI specification. Quality scoring grades your spec from A to F.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/features">
              <Button size="lg" variant="outline" className="group">
                See All Features
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-20 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              How Objectified Works
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              From design to deployment in three simple steps
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-4">
            <div className="text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                1
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Design Schemas
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Drag classes onto the canvas, define properties and types, and draw relationships — or import an existing OpenAPI spec.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white">
                2
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Author Paths
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Switch to the Paths Designer to create endpoints, bind schemas to request bodies and responses, and configure security.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 text-2xl font-bold text-white">
                3
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Validate &amp; Score
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Run real-time OpenAPI validation, review quality scores from A to F, and fix issues before exporting.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-600 text-2xl font-bold text-white">
                4
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Export &amp; Ship
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Export as OpenAPI YAML/JSON, generate code stubs, or share your API documentation with your team and consumers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Public Browser Section */}
      <section className="border-b border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
                <Database className="h-4 w-4" />
                Public API Browser
              </div>
              <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
                Explore Public OpenAPI Specifications
              </h2>
              <p className="mb-6 text-lg text-zinc-600 dark:text-zinc-400">
                Discover and learn from publicly available OpenAPI specifications shared by the community.
                Browse real-world API designs, get inspiration for your projects, and see how others structure their APIs.
              </p>
              <ul className="mb-8 space-y-3 text-zinc-600 dark:text-zinc-400">
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    ✓
                  </div>
                  <span>Browse hundreds of public API specifications</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    ✓
                  </div>
                  <span>View detailed endpoint documentation and schemas</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    ✓
                  </div>
                  <span>Learn best practices from community-shared designs</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    ✓
                  </div>
                  <span>Share your own APIs with the community</span>
                </li>
              </ul>
              <a href="https://browse.objectified.dev" target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="group">
                  Browse Public APIs
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </a>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="relative aspect-video overflow-hidden rounded-lg border-2 border-black dark:border-black">
                <Image
                  src="/browser-01.png"
                  alt="Public API Browser — explore OpenAPI specifications"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="border-b border-zinc-200 px-6 py-16 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-blue-600 dark:text-blue-400">
                500+
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">
                Active Projects
              </div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-purple-600 dark:text-purple-400">
                50k+
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">
                API Endpoints Designed
              </div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-green-600 dark:text-green-400">
                1k+
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">
                Happy Developers
              </div>
            </div>
            <div className="text-center">
              <div className="mb-2 text-4xl font-bold text-orange-600 dark:text-orange-400">
                99.9%
              </div>
              <div className="text-zinc-600 dark:text-zinc-400">
                Uptime SLA
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20">
        <div className="container mx-auto max-w-4xl">
          <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-blue-600 to-indigo-600 p-12 text-center text-white dark:border-zinc-800">
            <h2 className="mb-4 text-4xl font-bold">
              Ready to build better APIs?
            </h2>
            <p className="mb-8 text-xl text-blue-100">
              Join developers and teams already using Objectified to visually design, validate, and ship their API specifications.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href="https://app.objectified.dev" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="secondary" className="bg-white text-blue-600 hover:bg-zinc-100">
                  Launch App
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="https://browse.objectified.dev" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
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
