import type { Metadata } from "next";
import Link from "next/link";
import {
  Code2,
  Database,
  Layers,
  Zap,
  GitBranch,
  Lock,
  Users,
  FileCode,
  Workflow,
  Settings,
  Eye,
  Download,
  ArrowRight,
  CheckCircle2,
  Palette,
  Shield,
  Globe,
  BarChart3
} from "lucide-react";
import { Button } from "../components/ui/Button";

export const metadata: Metadata = {
  title: "Features - Objectified",
  description: "Explore the powerful features of Objectified for API and database design",
};

export default function FeaturesPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="border-b border-zinc-200 bg-gradient-to-b from-white to-zinc-50 px-6 py-16 dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="mb-4 text-5xl font-bold text-zinc-900 dark:text-zinc-50">
            Powerful Features for Modern Development
          </h1>
          <p className="text-xl text-zinc-600 dark:text-zinc-400">
            Everything you need to design, build, and manage your APIs and databases
          </p>
        </div>
      </section>

      {/* Visual API Designer */}
      <section className="border-b border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                <Code2 className="h-6 w-6" />
              </div>
              <h2 className="mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Visual API Designer
              </h2>
              <p className="mb-6 text-lg text-zinc-600 dark:text-zinc-400">
                Design REST APIs with an intuitive drag-and-drop interface. No need to write YAML or JSON by hand.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Drag-and-drop schema creation
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Full OpenAPI 3.1.0 compliance
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Automatic specification generation
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Real-time validation and error checking
                  </span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="aspect-video rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Workflow className="h-24 w-24 text-white/80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Database Schema Editor */}
      <section className="border-b border-zinc-200 bg-zinc-50 px-6 py-20 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="order-2 lg:order-1 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="aspect-video rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <Database className="h-24 w-24 text-white/80" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                <Database className="h-6 w-6" />
              </div>
              <h2 className="mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                Database Schema Editor
              </h2>
              <p className="mb-6 text-lg text-zinc-600 dark:text-zinc-400">
                Create and modify database schemas visually. Support for multiple database types.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Visual schema design with relationships
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    PostgreSQL and MongoDB support
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Auto-generate migration scripts
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Data type validation and constraints
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* All Features Grid */}
      <section className="border-b border-zinc-200 px-6 py-20 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
              Complete Feature Set
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              All the tools you need in one platform
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Layers className="h-6 w-6" />}
              title="Multi-Tenant"
              description="Organize projects by teams and organizations with granular permission controls"
              color="green"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6" />}
              title="Code Generation"
              description="Generate server stubs, client SDKs, and database migrations automatically"
              color="orange"
            />
            <FeatureCard
              icon={<GitBranch className="h-6 w-6" />}
              title="Version Control"
              description="Track all changes with full version history and comparison tools"
              color="indigo"
            />
            <FeatureCard
              icon={<Lock className="h-6 w-6" />}
              title="Enterprise Security"
              description="SSO, RBAC, audit logs, and compliance features built-in"
              color="rose"
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Collaboration"
              description="Work together in real-time with your team members"
              color="cyan"
            />
            <FeatureCard
              icon={<FileCode className="h-6 w-6" />}
              title="Export Options"
              description="Export to OpenAPI, JSON Schema, SQL, or your favorite format"
              color="violet"
            />
            <FeatureCard
              icon={<Eye className="h-6 w-6" />}
              title="Live Preview"
              description="See your API documentation update in real-time as you design"
              color="amber"
            />
            <FeatureCard
              icon={<Palette className="h-6 w-6" />}
              title="Custom Themes"
              description="Customize the look and feel of your documentation"
              color="pink"
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="API Security"
              description="Define authentication, rate limiting, and security schemes"
              color="red"
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6" />}
              title="Public Sharing"
              description="Share your APIs publicly or with specific collaborators"
              color="teal"
            />
            <FeatureCard
              icon={<BarChart3 className="h-6 w-6" />}
              title="Analytics"
              description="Track usage, performance, and adoption metrics"
              color="emerald"
            />
            <FeatureCard
              icon={<Download className="h-6 w-6" />}
              title="Import/Export"
              description="Import existing OpenAPI specs and export in multiple formats"
              color="sky"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50">
            Ready to experience the difference?
          </h2>
          <p className="mb-8 text-xl text-zinc-600 dark:text-zinc-400">
            Start designing better APIs and databases today
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="group">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline">
                Talk to Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    green: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400",
    rose: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
    cyan: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
    pink: "bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400",
    red: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
    teal: "bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
    sky: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400",
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ${colorClasses[color]}`}>
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}
