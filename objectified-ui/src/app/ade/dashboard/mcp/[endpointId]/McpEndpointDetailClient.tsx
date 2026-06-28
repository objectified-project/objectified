"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FileText, Server, Wrench } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { LoadingState } from "@/app/components/ui/LoadingState";
import { EmptyState } from "@/app/components/ui/EmptyState";
import {
  dashboardContentStackClass,
  dashboardMainClass,
  dashboardPanelPaddedClass,
} from "@/app/components/ade/dashboard/dashboardScreenClasses";
import {
  formatLastDiscovered,
  mcpEndpointDetailFromPayload,
  mcpGroupItemsByType,
  mcpScoreLabel,
  mcpScoreVariant,
  mcpVersionDetailFromPayload,
  type McpEndpointDetail,
  type McpVersionDetail,
} from "@/app/components/ade/dashboard/mcp/mcpBrowseUi";

interface Props {
  endpointId: string;
}

export default function McpEndpointDetailClient({ endpointId }: Props) {
  const [endpoint, setEndpoint] = useState<McpEndpointDetail | null>(null);
  const [version, setVersion] = useState<McpVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const epRes = await fetch(`/api/mcp/endpoints/${endpointId}`, {
        credentials: "include",
      });
      const epData = await epRes.json().catch(() => ({}));
      if (!epRes.ok) {
        throw new Error(
          typeof epData.error === "string" ? epData.error : epRes.statusText,
        );
      }
      const ep = mcpEndpointDetailFromPayload(epData);
      setEndpoint(ep);

      if (ep?.current_version_id) {
        const vRes = await fetch(
          `/api/mcp/endpoints/${endpointId}/versions/${ep.current_version_id}`,
          { credentials: "include" },
        );
        const vData = await vRes.json().catch(() => ({}));
        if (vRes.ok) {
          setVersion(mcpVersionDetailFromPayload(vData));
        } else {
          setVersion(null);
        }
      } else {
        setVersion(null);
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Could not load endpoint.");
      setEndpoint(null);
      setVersion(null);
    } finally {
      setLoading(false);
    }
  }, [endpointId]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemGroups = version ? mcpGroupItemsByType(version.items) : [];

  return (
    <>
      <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="px-6 py-4">
          <Link
            href="/ade/dashboard/mcp"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to MCP Catalog
          </Link>
          <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Server
              className="h-6 w-6 text-indigo-600 dark:text-indigo-400"
              aria-hidden
            />
            {endpoint?.name ?? "MCP Endpoint"}
          </h2>
          {endpoint ? (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {endpoint.endpoint_url} · {endpoint.transport}
            </p>
          ) : null}
        </div>
      </header>

      <main className={dashboardMainClass} aria-busy={loading}>
        <div className={dashboardContentStackClass}>
          <div className="px-6 pb-8 pt-4">
            {loading ? (
              <LoadingState
                minHeightClassName="min-h-[220px]"
                message="Loading endpoint…"
              />
            ) : error || !endpoint ? (
              <EmptyState
                icon={<Server className="h-10 w-10 text-white" aria-hidden />}
                title="Endpoint unavailable"
                description={
                  error ?? "This MCP endpoint could not be found in your catalog."
                }
              />
            ) : (
              <div className="space-y-6">
                {/* Version & score summary */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className={dashboardPanelPaddedClass}>
                    <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Quality score
                    </div>
                    <div className="mt-2">
                      <Badge variant={mcpScoreVariant(version?.score ?? null)}>
                        {mcpScoreLabel(version?.score ?? null, version?.grade ?? null)}
                      </Badge>
                    </div>
                  </div>
                  <div className={dashboardPanelPaddedClass}>
                    <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Current version
                    </div>
                    <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                      {version
                        ? version.version_tag ?? `v${version.version_seq}`
                        : "—"}
                    </div>
                  </div>
                  <div className={dashboardPanelPaddedClass}>
                    <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Server
                    </div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">
                      {version?.server_name ?? "—"}
                      {version?.server_version ? ` (${version.server_version})` : ""}
                    </div>
                  </div>
                  <div className={dashboardPanelPaddedClass}>
                    <div className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Last discovered
                    </div>
                    <div className="mt-2 text-sm text-gray-900 dark:text-white">
                      {formatLastDiscovered(endpoint.last_discovered_at)}
                    </div>
                  </div>
                </div>

                {/* Capabilities: tools / resources / resource templates / prompts */}
                {!version ? (
                  <EmptyState
                    variant="compact"
                    icon={<Wrench className="h-8 w-8 text-white" aria-hidden />}
                    title="Not yet discovered"
                    description="This endpoint has no current version snapshot. Run discovery to populate its tools, resources, and prompts."
                  />
                ) : itemGroups.length === 0 ? (
                  <EmptyState
                    variant="compact"
                    icon={<Wrench className="h-8 w-8 text-white" aria-hidden />}
                    title="No capabilities"
                    description="The current version snapshot declares no tools, resources, or prompts."
                  />
                ) : (
                  itemGroups.map((group) => (
                    <section key={group.key}>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                        {group.key === "prompt" ? (
                          <FileText className="h-4 w-4 text-indigo-500" aria-hidden />
                        ) : (
                          <Wrench className="h-4 w-4 text-indigo-500" aria-hidden />
                        )}
                        {group.label}
                        <Badge variant="secondary">{group.items.length}</Badge>
                      </h3>
                      <div className={`${dashboardPanelPaddedClass} space-y-3`}>
                        {group.items.map((item) => (
                          <div
                            key={`${group.key}:${item.name}`}
                            className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0 dark:border-gray-700"
                          >
                            <div className="font-medium text-gray-900 dark:text-white">
                              {item.title ?? item.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.uri ?? item.uri_template ?? item.name}
                            </div>
                            {item.description ? (
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
