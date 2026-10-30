import {
  ArrowsLeftRight,
  CaretRight,
  CreditCard,
  DeviceMobile,
  Fingerprint,
  FirstAidKit,
  FolderSimple,
  FolderPlus,
  IdentificationCard,
  Key,
  LockKey,
  LockSimple,
  NotePencil,
  Password,
  Plus,
  Scan,
  ShieldCheck,
  SquaresFour,
  Star,
  type Icon,
} from "@phosphor-icons/react";
import { useId, useState } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { t, type Language, type VaultItem } from "../lib/vault";
import { cn } from "../utils/cn";
import { Avatar, Kbd, Logo, SectionLabel, Tooltip } from "./ui";
import GlassSelection from "./GlassSelection";

export type ToolName =
  | "generator"
  | "authenticator"
  | "security"
  | "sync"
  | "emergency"
  | "ocr"
  | "add";

type NavItem = { id: string; labelKey: Parameters<typeof t>[1]; icon: Icon };
type ToolItem = { id: ToolName; labelKey: Parameters<typeof t>[1]; icon: Icon; badge?: string };

const navItems: NavItem[] = [
  { id: "all", labelKey: "allItems", icon: SquaresFour },
  { id: "favorites", labelKey: "favorites", icon: Star },
  { id: "logins", labelKey: "logins", icon: Key },
  { id: "notes", labelKey: "secureNotes", icon: NotePencil },
  { id: "identities", labelKey: "identities", icon: IdentificationCard },
  { id: "payments", labelKey: "payments", icon: CreditCard },
];

const toolItems: ToolItem[] = [
  { id: "ocr", labelKey: "scanImport", icon: Scan, badge: "OCR" },
  { id: "generator", labelKey: "passwordGenerator", icon: Password },
  { id: "authenticator", labelKey: "authenticator", icon: Fingerprint, badge: "3" },
  { id: "security", labelKey: "securityCenter", icon: ShieldCheck },
  { id: "sync", labelKey: "p2pSync", icon: ArrowsLeftRight, badge: "NEW" },
  { id: "emergency", labelKey: "emergencyKit", icon: FirstAidKit },
];

const folderKeys = ["Work", "Personal", "Finance", "Archive"] as const;

export default function Sidebar({
  lang,
  active,
  folder,
  items,
  onNav,
  onFolder,
  onTool,
  onAdd,
  onLock,
  onOpenMobileMenu,
}: {
  lang: Language;
  active: string;
  folder: string | null;
  items: VaultItem[];
  onNav: (id: string) => void;
  onFolder: (folder: string | null) => void;
  onTool: (tool: ToolName) => void;
  onAdd: () => void;
  onLock: () => void;
  onOpenMobileMenu?: () => void;
}) {
  const groupId = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const folders = [...folderKeys, ...customFolders];

  const createFolder = () => {
    const name = folderName.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }
    if (!folders.includes(name)) setCustomFolders((current) => [...current, name]);
    setFolderName("");
    setCreatingFolder(false);
    onFolder(name);
  };

  const countFor = (id: string) => {
    if (id === "all") return items.length;
    if (id === "favorites") return items.filter((i) => i.favorite).length;
    if (id === "logins") return items.filter((i) => i.category === "login").length;
    if (id === "notes") return items.filter((i) => i.category === "note").length;
    if (id === "identities") return items.filter((i) => i.category === "identity").length;
    if (id === "payments") return items.filter((i) => i.category === "payment").length;
    return 0;
  };

  return (
    <LayoutGroup id={groupId}>
    <aside className="glass vault-sidebar hidden h-full w-[246px] shrink-0 flex-col overflow-hidden rounded-[28px] lg:flex xl:w-[260px]" onPointerLeave={() => setHovered(null)}>
      <div className="flex items-center justify-between pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo size={39} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[17px] font-semibold leading-none tracking-[-0.035em] text-main">
                VaultZero
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[7.5px] font-bold uppercase leading-none tracking-[0.14em] text-faint">
              <LockSimple size={8} weight="fill" />
              Local-only vault
            </p>
          </div>
        </div>
        <Tooltip label="Security center" side>
          <button
            onClick={() => onTool("security")}
            className="icon-button hidden h-7 w-7 rounded-lg xl:flex"
            aria-label="Open security center"
          >
            <ShieldCheck size={12} weight="duotone" />
          </button>
        </Tooltip>
      </div>

      <button
        onClick={onAdd}
        className="primary-button sidebar-add group shrink-0"
      >
        <span className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-md bg-white/20 transition-transform group-hover:rotate-90">
          <Plus size={12} weight="bold" />
        </span>
        <span className="truncate">{t(lang, "addNew")}</span>
        <span className="sidebar-add-badge hidden xl:inline-flex">⌘N</span>
      </button>

      <motion.div layoutScroll className="thin-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
        <SectionLabel className="sidebar-section pb-2 pt-1">{t(lang, "workspace")}</SectionLabel>
        <nav className="space-y-0.5" aria-label="Vault navigation">
          {navItems.map((item) => {
            const selected = active === item.id && !folder;
            const ItemIcon = item.icon;
            const count = countFor(item.id);
            return (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(`nav-${item.id}`); }}
                onFocus={() => setHovered(`nav-${item.id}`)}
                onBlur={() => setHovered(null)}
                aria-current={selected ? "page" : undefined}
                data-glass-option="true"
                className={cn(
                  "sidebar-nav-item group relative flex h-[36px] w-full items-center gap-2.5 rounded-[11px] px-2 text-left",
                  selected ? "text-main" : "text-soft hover:text-main",
                )}
              >
                {selected && <GlassSelection id="sidebar-selected" />}
                {hovered === `nav-${item.id}` && !selected && <GlassSelection id="sidebar-hover" hover />}
                {selected && (
                  <span data-active-marker="true"
                    className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full"
                    style={{ background: "var(--accent)", boxShadow: "0 0 8px var(--accent-glow)" }}
                  />
                )}
                <ItemIcon
                  size={17}
                  weight={selected ? "duotone" : "regular"}
                  style={{ color: selected ? "var(--accent)" : undefined }}
                />
                <span className={cn("truncate text-[11.5px]", selected ? "font-semibold" : "font-medium")}>
                  {t(lang, item.labelKey)}
                </span>
                <span
                  className={cn(
                    "ml-auto font-mono text-[8.5px] tabular-nums",
                    selected ? "text-accent" : "text-faint",
                  )}
                >
                  {String(count).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="mx-2 my-3 h-px bg-[var(--border-soft)]" />

        <SectionLabel className="sidebar-section pb-2 pt-1">{t(lang, "tools")}</SectionLabel>
        <nav className="space-y-0.5" aria-label="Tools">
          {toolItems.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => onTool(tool.id)}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(`tool-${tool.id}`); }}
                onFocus={() => setHovered(`tool-${tool.id}`)}
                onBlur={() => setHovered(null)}
                data-glass-option="true"
                className="sidebar-nav-item group relative flex h-[34px] w-full items-center gap-2.5 rounded-[10px] px-2 text-left text-soft hover:text-main"
              >
                {hovered === `tool-${tool.id}` && <GlassSelection id="sidebar-hover" hover />}
                <ToolIcon size={17} weight="duotone" className="text-muted transition-colors group-hover:text-accent" />
                <span className="truncate text-[11.5px] font-medium">{t(lang, tool.labelKey)}</span>
                {tool.badge && (
                  <span
                    className={cn(
                      "ml-auto rounded-full border px-1.5 py-0.5 text-[7px] font-bold",
                      tool.badge === "NEW" ? "text-accent" : "text-muted",
                    )}
                    style={{
                      borderColor: tool.badge === "NEW" ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "var(--border-soft)",
                      background: tool.badge === "NEW" ? "var(--accent-soft)" : "var(--glass-soft)",
                    }}
                  >
                    {tool.id === "authenticator" ? items.filter((item) => item.totp).length : tool.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mx-2 my-3 h-px bg-[var(--border-soft)]" />

        <div className="sidebar-section flex items-center justify-between pb-2 pt-1">
          <SectionLabel>{t(lang, "folders")}</SectionLabel>
          <Tooltip label={t(lang, "newFolder")} side>
            <button
              className="flex h-5 w-5 items-center justify-center rounded-md text-faint transition-colors hover:bg-[var(--hover)] hover:text-main"
              aria-label={t(lang, "newFolder")}
              onClick={() => setCreatingFolder(true)}
            >
              <FolderPlus size={12} weight="duotone" />
            </button>
          </Tooltip>
        </div>
        <div className="space-y-0.5">
          {folders.map((name) => {
            const count = items.filter((i) => i.folder === name).length;
            const selected = folder === name;
            return (
              <button
                key={name}
                onClick={() => onFolder(name)}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") setHovered(`folder-${name}`); }}
                data-glass-option="true"
                className={cn(
                  "relative flex h-[32px] w-full items-center gap-2.5 rounded-[9px] px-2 text-left",
                  selected ? "text-main" : "text-muted hover:text-main",
                )}
              >
                {selected && <GlassSelection id="sidebar-selected" />}
                {hovered === `folder-${name}` && !selected && <GlassSelection id="sidebar-hover" hover />}
                <FolderSimple size={14} weight={selected ? "fill" : "duotone"} className="text-faint" />
                <span className="truncate text-[11.5px] font-medium">{name}</span>
                <span className="ml-auto font-mono text-[8px] tabular-nums text-faint">{count}</span>
                {selected && <CaretRight size={9} className="text-accent" />}
              </button>
            );
          })}
          {creatingFolder && (
            <div className="mt-1 flex items-center gap-1.5 rounded-[9px] border border-[var(--accent)]/30 bg-[var(--glass-strong)] px-1.5 py-1">
              <FolderPlus size={12} weight="duotone" className="shrink-0 text-accent" />
              <input
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createFolder();
                  if (event.key === "Escape") {
                    setCreatingFolder(false);
                    setFolderName("");
                  }
                }}
                onBlur={createFolder}
                placeholder="Folder name"
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-[9.5px] text-main outline-none placeholder:text-faint"
                aria-label="New folder name"
              />
              <button onClick={createFolder} className="flex h-4 w-4 items-center justify-center rounded text-accent" aria-label="Create folder">
                <CaretRight size={9} weight="bold" />
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <div className="mt-2 shrink-0">
        <div
          className="mb-2 flex items-center gap-2.5 rounded-[13px] border p-2.5"
          style={{ background: "var(--glass-soft)", borderColor: "var(--border-soft)" }}
        >
          <button
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left"
            onClick={() => onTool("security")}
            aria-label="View local vault security"
          >
          <span
            className="relative flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-[9px] border"
            style={{ background: "var(--success-soft)", borderColor: "color-mix(in srgb, var(--success) 20%, transparent)", color: "var(--success)" }}
          >
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_var(--success)]" />
            <ShieldCheck size={15} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[9.5px] font-bold leading-none text-main">
              {t(lang, "offlineNote")}
              <span className="h-1 w-1 rounded-full" style={{ background: "var(--success)" }} />
            </p>
            <p className="mt-1 truncate text-[8px] leading-none text-faint">XChaCha20 · Argon2id · local</p>
          </div>
          </button>
          <Tooltip label="Panic lock · Ctrl L" side={false} up>
            <button
              onClick={onLock}
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border border-[var(--border-soft)] bg-[var(--glass-strong)] text-muted transition-colors hover:text-main"
              aria-label="Lock vault now"
            >
              <LockKey size={11} weight="duotone" />
            </button>
          </Tooltip>
        </div>

        <button
          onClick={onOpenMobileMenu}
          aria-label="Vault preferences"
          className="flex w-full items-center gap-2.5 rounded-[12px] px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--hover)]"
        >
          <Avatar size={29} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10.5px] font-semibold leading-tight text-main">Ayaan Rahman</p>
            <p className="mt-0.5 truncate text-[8px] leading-tight text-faint">
              {items.length} {t(lang, "items")} · {t(lang, "synced")}
            </p>
          </div>
          <Kbd>⌘ ,</Kbd>
        </button>
      </div>
    </aside>
    </LayoutGroup>
  );
}

export function MobileQuickMenu({
  lang,
  items,
  onTool,
  onNav,
}: {
  lang: Language;
  items: VaultItem[];
  onTool: (tool: ToolName) => void;
  onNav: (id: string) => void;
}) {
  const total = items.length;
  return (
    <div className="space-y-4 pt-1">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t(lang, "allItems"), count: total, icon: SquaresFour, nav: "all" },
          { label: t(lang, "favorites"), count: items.filter((i) => i.favorite).length, icon: Star, nav: "favorites" },
          { label: t(lang, "logins"), count: items.filter((i) => i.category === "login").length, icon: Key, nav: "logins" },
        ].map((stat) => (
          <button
            key={stat.label}
            onClick={() => onNav(stat.nav)}
            className="glass-soft flex flex-col items-start rounded-[14px] p-3 text-left"
          >
            <stat.icon size={18} weight="duotone" className="mb-2 text-accent" />
            <span className="font-display text-[19px] font-semibold leading-none text-main">{stat.count}</span>
            <span className="mt-1 text-[9px] text-muted">{stat.label}</span>
          </button>
        ))}
      </div>
      <div className="glass-soft rounded-[15px] p-1.5">
        {toolItems.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onTool(tool.id)}
            className="flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left text-main transition-colors hover:bg-[var(--hover)]"
          >
            <tool.icon size={19} weight="duotone" className="text-accent" />
            <span className="text-[12px] font-medium">{t(lang, tool.labelKey)}</span>
            {tool.id === "emergency" ? (
              <FirstAidKit size={13} className="ml-auto text-danger" />
            ) : (
              <CaretRight size={13} className="ml-auto text-faint" />
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 py-2 text-[9px] text-faint">
        <DeviceMobile size={12} weight="duotone" />
        {t(lang, "offlineCopy")}
      </div>
    </div>
  );
}
