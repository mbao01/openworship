import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { ServiceProject, StorageUsage } from "../../lib/types";
import { formatStorageBytes } from "../../lib/artifact-utils";
import { IconCloud, IconChevronDown } from "./ArtifactIcons";

export type Nav =
  | { kind: "all" }
  | { kind: "recent" }
  | { kind: "starred" }
  | { kind: "service"; id: string; name: string }
  | { kind: "cloud_branch" }
  | { kind: "cloud_shared" };

export function ArtifactsSidebar({
  projects,
  nav,
  onNav,
  usage,
  cloudExpanded,
  onToggleCloud,
}: {
  projects: ServiceProject[];
  nav: Nav;
  onNav: (n: Nav) => void;
  usage: StorageUsage | null;
  cloudExpanded: boolean;
  onToggleCloud: () => void;
}) {
  const isActive = (n: Nav) => JSON.stringify(n) === JSON.stringify(nav);

  const storageLabel = usage
    ? `${formatStorageBytes(usage.used_bytes)}${usage.quota_bytes ? ` / ${formatStorageBytes(usage.quota_bytes)}` : " used"}`
    : "2.4 GB / 5 GB";
  const storagePct = usage?.quota_bytes
    ? Math.min(100, (usage.used_bytes / usage.quota_bytes) * 100)
    : 48;

  return (
    <Sidebar
      data-qa="artifacts-sidebar"
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar"
    >
      <SidebarContent>
        {/* ── LOCAL ─────────────────────────────────────────────────────── */}
        <SidebarGroup>
          <SidebarGroupLabel>Local</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  data-qa="artifacts-nav-all"
                  tooltip="All Artifacts"
                  isActive={isActive({ kind: "all" })}
                  onClick={() => onNav({ kind: "all" })}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <rect
                      x="1"
                      y="1"
                      width="4.5"
                      height="4.5"
                      rx="0.6"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="7.5"
                      y="1"
                      width="4.5"
                      height="4.5"
                      rx="0.6"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="1"
                      y="7.5"
                      width="4.5"
                      height="4.5"
                      rx="0.6"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <rect
                      x="7.5"
                      y="7.5"
                      width="4.5"
                      height="4.5"
                      rx="0.6"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                  </svg>
                  <span>All Artifacts</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  data-qa="artifacts-nav-recent"
                  tooltip="Recent"
                  isActive={isActive({ kind: "recent" })}
                  onClick={() => onNav({ kind: "recent" })}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle
                      cx="6.5"
                      cy="6.5"
                      r="5"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <path
                      d="M6.5 4v2.5l1.5 1.5"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Recent</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  data-qa="artifacts-nav-starred"
                  tooltip="Starred"
                  isActive={isActive({ kind: "starred" })}
                  onClick={() => onNav({ kind: "starred" })}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path
                      d="M6.5 1l1.5 3.5H12L9 6.5l1 4-3.5-2.5L3 10.5l1-4L1 6.5h4z"
                      stroke="currentColor"
                      strokeWidth="1.1"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Starred</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── SERVICES ──────────────────────────────────────────────────── */}
        {projects.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Services</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projects.map((p) => (
                    <SidebarMenuItem key={p.id}>
                      <SidebarMenuButton
                        data-qa={`artifacts-nav-service-${p.id}`}
                        tooltip={p.name}
                        isActive={isActive({
                          kind: "service",
                          id: p.id,
                          name: p.name,
                        })}
                        onClick={() =>
                          onNav({ kind: "service", id: p.id, name: p.name })
                        }
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 13 13"
                          fill="none"
                        >
                          <path
                            d="M6.5 1L2 4v7h3.5V7.5h2V11H11V4z"
                            stroke="currentColor"
                            strokeWidth="1.1"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="truncate">{p.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* ── CLOUD ─────────────────────────────────────────────────────── */}
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Cloud</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible
                open={cloudExpanded}
                onOpenChange={onToggleCloud}
                asChild
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      data-qa="artifacts-nav-cloud-branch"
                      tooltip="My Branch"
                      isActive={
                        isActive({ kind: "cloud_branch" }) || cloudExpanded
                      }
                      onClick={() => onNav({ kind: "cloud_branch" })}
                    >
                      <IconCloud />
                      <span>My Branch</span>
                      <IconChevronDown
                        className={`ml-auto transition-transform duration-200 ${cloudExpanded ? "" : "-rotate-90"}`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {["Downtown", "Westside", "Youth Campus"].map(
                        (branch) => (
                          <SidebarMenuSubItem key={branch}>
                            <SidebarMenuSubButton>
                              <span className="size-1.5 shrink-0 rounded-full bg-current" />
                              <span>{branch}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ),
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <SidebarMenuItem>
                <SidebarMenuButton
                  data-qa="artifacts-nav-cloud-shared"
                  tooltip="Church Shared"
                  isActive={isActive({ kind: "cloud_shared" })}
                  onClick={() => onNav({ kind: "cloud_shared" })}
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <circle
                      cx="6.5"
                      cy="6.5"
                      r="5"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                    <path
                      d="M6.5 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0 3.5c-2 0-3 1-3 2h6c0-1-1-2-3-2z"
                      fill="currentColor"
                    />
                  </svg>
                  <span>Church Shared</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Storage footer ──────────────────────────────────────────────── */}
      <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:p-2">
        <div className="group-data-[collapsible=icon]:hidden">
          <div className="mb-[7px] h-[3px] overflow-hidden rounded-full bg-sidebar-border">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${storagePct}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[10px] text-sidebar-foreground/50">
              {storageLabel}
            </span>
            <button className="flex shrink-0 cursor-pointer items-center gap-[3px] border-none bg-transparent font-sans text-[10px] text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground">
              Manage
            </button>
          </div>
        </div>
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
          <IconCloud />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
