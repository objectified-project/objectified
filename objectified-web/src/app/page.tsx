import {
  ArrowRight,
  Code2,
  Database,
  Layers,
  Zap,
  Lock,
  Star,
  GitBranch
} from "lucide-react";
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
            <h1 className="mb-6 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl lg:text-7xl">
              Design APIs & Databases{" "}
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Visually
              </span>
            </h1>
            <p className="mb-10 text-xl text-zinc-600 dark:text-zinc-400">
              The modern platform for creating OpenAPI specifications and database schemas.
              Build faster with our intuitive visual editor, manage teams, and scale with confidence.
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
            {/* Feature 1 */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-blue-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Code2 className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Visual API Designer
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Design your schemas visually with drag-and-drop. Full OpenAPI 3.1.0 support with automatic specification generation.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-purple-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-purple-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Database Schema Editor
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Create and modify database schemas with an intuitive visual interface. Support for SQL, MongoDB, Redis, and more.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-green-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-green-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Multi-Tenant Architecture
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Organize your projects with teams and organizations. Share schemas, collaborate, and manage permissions easily.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-orange-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-orange-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Code Generation
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Generate DTO stubs, database migrations, and multiple database exports from your specifications automatically.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-indigo-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-indigo-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                <GitBranch className="h-4 w-4" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Version Control
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Track changes, compare versions, and roll back when needed. Full history of all your API modifications.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group rounded-2xl border border-zinc-200 bg-white p-8 transition-all hover:border-rose-300 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-rose-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Enterprise Security
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Role-based access control, SSO integration, audit logs, and compliance features for enterprise teams.
              </p>
            </div>
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

          <div className="grid gap-12 lg:grid-cols-3">
            <div className="text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
                1
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Design Visually
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Use our drag-and-drop interface to create database schemas and API endpoints. No code required.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 text-2xl font-bold text-white">
                2
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Generate Code
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Automatically generate OpenAPI specs, database migrations, and API documentation from your designs.
              </p>
            </div>

            <div className="text-center">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-600 text-2xl font-bold text-white">
                3
              </div>
              <h3 className="mb-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Deploy & Scale
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400">
                Export to your favorite framework or use our built-in deployment options. Scale with confidence.
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="space-y-4">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Public API</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Pet Store API v2.0</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">REST</span>
                    <span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">15 endpoints</span>
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Public API</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">E-Commerce Platform API</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">REST</span>
                    <span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">42 endpoints</span>
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Public API</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Social Media Integration API</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">REST</span>
                    <span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">28 endpoints</span>
                  </div>
                </div>
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
              Join thousands of developers already using Objectified to design and manage their APIs
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
