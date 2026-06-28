"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
} from "lucide-react";
import ImportDialog from "@/app/components/ade/dashboard/ImportDialog";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { LoadingState } from "@/app/components/ui/LoadingState";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { toast } from "sonner";
import {
  dashboardContentStackClass,
  dashboardMainClass,
  dashboardTableWrapClass,
  dashboardTableTheadClass,
  dashboardThClass,
  dashboardThRightClass,
  dashboardTbodyClass,
  dashboardTrHoverClass,
} from "@/app/components/ade/dashboard/dashboardScreenClasses";
import {
  formatLastDiscovered,
  mcpBrowseGroupsFromPayload,
  mcpFilterGroups,
  mcpScoreLabel,
  mcpScoreVariant,
  type McpBrowseHostGroup,
} from "@/app/components/ade/dashboard/mcp/mcpBrowseUi";

export default function McpBrowsePage() {
  const { data: session } = useSession();
  const sessionUser = session?.user as
    | { user_id?: string; current_tenant_id?: string }
    | undefined;
  const currentTenantId = sessionUser?.current_tenant_id;
  const currentUserId = sessionUser?.user_id;

  const [groups, setGroups] = useState<McpBrowseHostGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenantId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/mcp/browse", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : res.statusText,
        );
      }
      setGroups(mcpBrowseGroupsFromPayload(data));
    } catch (e) {
      console.error(e);
      setGroups([]);
      toast.error("Could not load the MCP catalog.");
    } finally {
      setLoading(false);
    }
  }, [currentTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => mcpFilterGroups(groups, search),
    [groups, search],
  );

  const totals = useMemo(() => {
    const endpointCount = groups.reduce((sum, g) => sum + g.endpoints.length, 0);
    const capabilityCount = groups.reduce(
      (sum, g) => sum + g.capability_count,
      0,
    );
    return { hostCount: groups.length, endpointCount, capabilityCount };
  }, [groups]);

  return (
    <>
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
                <Server
                  className="h-6 w-6 text-indigo-600 dark:text-indigo-400"
                  aria-hidden
                />
                MCP Catalog
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Browse the MCP servers cataloged in this workspace, grouped by
                host. Pick one to inspect its tools, resources, and prompts.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                className="h-auto min-h-10 shrink-0 whitespace-nowrap py-2"
                onClick={() => void load()}
                title="Reload the catalog"
              >
                <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                Refresh
              </Button>
              <Button
                type="button"
                className="h-auto min-h-10 shrink-0 whitespace-nowrap py-2"
                onClick={() => setImportOpen(true)}
                disabled={!currentTenantId}
                title="Add an MCP server to the catalog"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Add MCP server
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className={dashboardMainClass} aria-busy={loading}>
        <div className={dashboardContentStackClass}>
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="relative min-w-[260px] max-w-md flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, host, URL, or category…"
                className="bg-gray-50 pl-9 dark:bg-gray-900/50"
              />
            </div>
            <div className="ml-auto flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{totals.hostCount} hosts</span>
              <span aria-hidden>·</span>
              <span>{totals.endpointCount} endpoints</span>
              <span aria-hidden>·</span>
              <span>{totals.capabilityCount} capabilities</span>
            </div>
          </div>

          <div className="space-y-6 px-6 pb-8 pt-2">
            {loading ? (
              <div className={dashboardTableWrapClass}>
                <LoadingState
                  minHeightClassName="min-h-[220px]"
                  message="Loading the MCP catalog…"
                />
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                className="mt-6"
                icon={<Server className="h-10 w-10 text-white" aria-hidden />}
                title={
                  groups.length === 0
                    ? "No MCP endpoints yet"
                    : "No matches"
                }
                description={
                  groups.length === 0
                    ? "Register an MCP server in the catalog. Once it is discovered, its endpoints appear here grouped by host with capability counts and quality scores."
                    : "Try adjusting your search."
                }
              />
            ) : (
              filtered.map((group) => (
                <section key={group.host}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {group.host}
                    </h3>
                    <Badge variant="secondary">
                      {group.endpoint_count} endpoint
                      {group.endpoint_count === 1 ? "" : "s"}
                    </Badge>
                    <Badge variant="outline">
                      {group.capability_count} capabilities
                    </Badge>
                  </div>
                  <div className={dashboardTableWrapClass}>
                    <table className="w-full text-sm">
                      <thead className={dashboardTableTheadClass}>
                        <tr>
                          <th className={dashboardThClass}>Endpoint</th>
                          <th className={dashboardThClass}>Capabilities</th>
                          <th className={dashboardThClass}>Score</th>
                          <th className={dashboardThClass}>Last discovered</th>
                          <th className={dashboardThRightClass}>
                            <span className="sr-only">Open</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className={dashboardTbodyClass}>
                        {group.endpoints.map((ep) => (
                          <tr key={ep.id} className={dashboardTrHoverClass}>
                            <td className="px-6 py-3 align-middle">
                              <Link
                                href={`/ade/dashboard/mcp/${ep.id}`}
                                className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                              >
                                {ep.name}
                              </Link>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span>{ep.transport}</span>
                                {ep.quarantined ? (
                                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                    <ShieldAlert className="h-3 w-3" aria-hidden />
                                    quarantined
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-6 py-3 align-middle text-gray-600 dark:text-gray-300">
                              <span title="tools / resources / resource templates / prompts">
                                {ep.tool_count}t · {ep.resource_count}r ·{" "}
                                {ep.resource_template_count}rt ·{" "}
                                {ep.prompt_count}p
                              </span>
                            </td>
                            <td className="px-6 py-3 align-middle">
                              <Badge variant={mcpScoreVariant(ep.score)}>
                                {mcpScoreLabel(ep.score, ep.grade)}
                              </Badge>
                            </td>
                            <td className="px-6 py-3 align-middle text-gray-600 dark:text-gray-300">
                              {formatLastDiscovered(ep.last_discovered_at)}
                            </td>
                            <td className="px-6 py-3 text-right align-middle">
                              <Link
                                href={`/ade/dashboard/mcp/${ep.id}`}
                                className="inline-flex items-center text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                aria-label={`Open ${ep.name}`}
                              >
                                <ArrowRight className="h-4 w-4" aria-hidden />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </main>

      {currentTenantId && currentUserId ? (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onSuccess={() => void load()}
          tenantId={currentTenantId}
          userId={currentUserId}
          initialSource={importOpen ? "mcp" : null}
        />
      ) : null}
    </>
  );
}
