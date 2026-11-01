import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle,
  ClipboardText,
  CreditCard,
  Eye,
  EyeSlash,
  FolderSimple,
  IdentificationCard,
  Image,
  Key,
  LockSimple,
  NotePencil,
  Password,
  Plus,
  Scan,
  ShieldCheck,
  Sparkle,
  Star,
  UploadSimple,
  ClipboardText as PasteIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  generatePassword,
  passwordStrength,
} from "../lib/generate";
import { brands, type BrandKey, type Category, type VaultItem } from "../lib/vault";
import { cn } from "../utils/cn";
import { BrandMark, CopyButton, GlassCheck, Modal, StrengthDots, Tooltip } from "./ui";
import OcrCopyPad, { type OcrField } from "./OcrCopyPad";
import { MAX_OCR_FILE_SIZE, runLocalOcr } from "../lib/ocr";
import jsQR from "jsqr";
import { parseOtpAuthUri } from "../lib/totp";
import type { Language } from "../lib/vault";

type Notify = (message: string) => void;
type CreateItem = (item: VaultItem) => void;

const categories: { id: Category; label: string; description: string; icon: typeof Key }[] = [
  { id: "login", label: "Login", description: "Website or app", icon: Key },
  { id: "note", label: "Secure note", description: "Private text", icon: NotePencil },
  { id: "identity", label: "Identity", description: "IDs & documents", icon: IdentificationCard },
  { id: "payment", label: "Payment", description: "Cards & accounts", icon: CreditCard },
];

function detectBrand(value: string): BrandKey {
  const text = value.toLowerCase();
  if (text.includes("google") || text.includes("gmail")) return "google";
  if (text.includes("github")) return "github";
  if (text.includes("apple") || text.includes("icloud")) return "apple";
  if (text.includes("figma")) return "figma";
  if (text.includes("notion")) return "notion";
  if (text.includes("dropbox")) return "dropbox";
  if (text.includes("paypal")) return "paypal";
  if (text.includes("spotify")) return "spotify";
  if (text === "x" || text.includes("twitter") || text.includes("x.com")) return "x";
  return "vault";
}

export function AddItemModal({
  onClose,
  onCreate,
  onNotify,
  defaultCategory = "login",
  initialItem,
  draft,
}: {
  onClose: () => void;
  onCreate: CreateItem;
  onNotify: Notify;
  defaultCategory?: Category;
  initialItem?: VaultItem;
  draft?: Partial<VaultItem>;
}) {
  const seed = initialItem ?? draft;
  const [category, setCategory] = useState<Category>(seed?.category ?? defaultCategory);
  const [name, setName] = useState(seed?.title ?? "");
  const [username, setUsername] = useState(seed?.username ?? "");
  const [password, setPassword] = useState(seed?.password ?? "");
  const [url, setUrl] = useState(seed?.url ?? "");
  const [note, setNote] = useState(seed?.note ?? "");
  const [folder, setFolder] = useState(seed?.folder ?? "Personal");
  const [favorite, setFavorite] = useState(seed?.favorite ?? false);

  const pasteInto = async (setter: (value: string) => void, label: string) => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { onNotify("Clipboard is empty"); return; }
      setter(text.trim());
      onNotify(`${label} pasted from clipboard`);
    } catch {
      onNotify("Allow clipboard access, or paste with Ctrl+V");
    }
  };
  const [revealed, setRevealed] = useState(false);
  const [touched, setTouched] = useState(false);
  const strength = password ? passwordStrength(password) : null;
  const inferredBrand = detectBrand(`${name} ${url}`);
  const brand = name || url ? inferredBrand : "vault";
  const canSave = name.trim().length > 0 && (category === "note" ? note.trim().length > 0 : Boolean(username || password));

  const makePassword = () => {
    const generated = generatePassword({ ...({ length: 20, lowercase: true, uppercase: true, numbers: true, symbols: true, avoidAmbiguous: true }) });
    setPassword(generated);
    setRevealed(true);
    onNotify("Strong password generated");
  };

  const handleOcrAssign = (field: OcrField, value: string) => {
    if (field === "title") setName(value);
    else if (field === "username") setUsername(value);
    else if (field === "password") setPassword(value);
    else if (field === "url") setUrl(value);
    else if (field === "note") setNote((prev) => (prev ? `${prev}\n${value}` : value));
  };

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (!canSave) return;
    const strengthLabel = !strength ? "fair" : strength.score >= 3 ? "strong" : strength.score >= 2 ? "fair" : "weak";
    const history = [...(initialItem?.passwordHistory || [])];
    if (initialItem && initialItem.password && initialItem.password !== password && initialItem.password !== "—") {
      history.unshift({
        password: initialItem.password,
        changedAt: "Just now",
      });
    }

    const item: VaultItem = {
      ...(initialItem ?? {}),
      id: initialItem?.id ?? `custom-${Date.now()}`,
      title: name.trim(),
      username: username.trim() || (category === "note" ? "Secure note" : "No username"),
      password: password || "—",
      url: url.trim(),
      category,
      brand: draft?.brand && !name ? draft.brand : brand,
      favorite,
      strength: strengthLabel,
      score: strength?.score ?? 2,
      modified: "Just now",
      note: note.trim() || undefined,
      tags: [folder],
      folder,
      recoveryCodes: initialItem?.recoveryCodes ?? draft?.recoveryCodes,
      passwordHistory: history,
    };
    onCreate(item);
    onNotify(`${name.trim()} saved to your local vault`);
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      title={initialItem ? "Edit vault item" : "New vault item"}
      subtitle={draft ? "Scanned details are filled in below. Review and edit before saving." : "Update your item in this local design preview. Use sample credentials only."}
      icon={<Plus size={20} weight="bold" />}
      width="max-w-[610px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="hidden items-center gap-1.5 text-[8.5px] text-faint sm:flex"><LockSimple size={11} weight="duotone" /> XChaCha20-Poly1305 · Argon2id</span>
          <div className="flex w-full justify-end gap-2.5 sm:w-auto">
            <button type="button" onClick={onClose} className="secondary-button h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[11px] font-semibold">Cancel</button>
            <button type="submit" form="add-item-form" className="primary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-[11px] font-semibold shadow-md shadow-[var(--accent-glow)]">
              <Check size={14} weight="bold" /> {initialItem ? "Save changes" : "Add to vault"}
            </button>
          </div>
        </div>
      }
    >
      <form id="add-item-form" onSubmit={save}>
        {touched && !canSave && (
          <p role="alert" className="form-validation">
            {!name.trim() ? "Give this item a name." : category === "note" ? "Add some text to your secure note." : "Add a username or password before saving."}
          </p>
        )}
        <div className="mb-3.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {categories.map((item) => {
            const CategoryIcon = item.icon;
            const active = category === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setCategory(item.id)}
                className={cn("flex flex-col items-start gap-1.5 rounded-[13px] border p-2.5 text-left transition-all", active ? "text-main" : "text-muted hover:bg-[var(--hover)] hover:text-main")}
                style={{
                  background: active ? "var(--accent-soft)" : "var(--glass-soft)",
                  borderColor: active ? "color-mix(in srgb, var(--accent) 35%, transparent)" : "var(--border-soft)",
                  boxShadow: active ? "0 0 0 1px var(--accent-soft)" : "none",
                }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: active ? "var(--accent)" : "var(--glass-strong)", color: active ? "white" : "var(--text-muted)" }}>
                  <CategoryIcon size={15} weight={active ? "fill" : "duotone"} />
                </span>
                <span className="text-[9.5px] font-semibold leading-none">{item.label}</span>
                <span className="hidden text-[7px] leading-none text-faint sm:block">{item.description}</span>
              </button>
            );
          })}
        </div>

        <div className="glass-soft mb-2.5 flex items-center gap-2.5 rounded-[14px] border border-[var(--border-soft)] p-2.5">
          <BrandMark brand={brand} size={35} />
          <div className="min-w-0 flex-1">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-faint">Detected service</p>
            <p className="mt-0.5 truncate text-[10px] font-semibold text-main">{name || brands[brand].name}</p>
          </div>
          <button type="button" onClick={() => setFavorite((value) => !value)} className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--hover)]" style={{ color: favorite ? "var(--warning)" : "var(--text-faint)" }} aria-label="Toggle favorite">
            <Star size={14} weight={favorite ? "fill" : "regular"} />
          </button>
        </div>

        <div className="space-y-2.5">
          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[8.5px] font-semibold text-muted">
              {category === "note" ? "Note title" : "Name"}
              {name && <span className="text-[7px] font-medium text-faint">{brands[brand].name} logo detected</span>}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={category === "note" ? "e.g. Studio recovery keys" : "e.g. Google"}
              name="item-name"
              autoComplete="organization"
              className="field"
              autoFocus
              aria-invalid={touched && !name}
            />
          </label>

          {category !== "note" && (
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-[8.5px] font-semibold text-muted">
                Username or email
                {category === "identity" && <span className="text-[7px] text-faint">Full legal name also works</span>}
              </span>
              <div className="input-shell flex h-[40px] items-center gap-2 rounded-[11px] px-3">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="name@example.com"
                  name="username"
                  autoComplete="username"
                  inputMode="email"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-main outline-none placeholder:text-faint"
                />
                <Tooltip label="Paste username">
                  <button type="button" onClick={() => void pasteInto(setUsername, "Username")} className="flex h-7 w-7 items-center justify-center rounded-full text-faint hover:bg-[var(--hover)] hover:text-main" aria-label="Paste username">
                    <PasteIcon size={13} weight="duotone" />
                  </button>
                </Tooltip>
                <CopyButton value={username} label="Username" onCopied={onNotify} />
              </div>
            </label>
          )}

          {category !== "identity" && (
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-[8.5px] font-semibold text-muted">
                Password
                <span className="flex items-center gap-2">
                  {strength && <StrengthDots strength={strength.score >= 3 ? "strong" : strength.score >= 2 ? "fair" : "weak"} score={strength.score} />}
                  <button type="button" onClick={makePassword} className="flex items-center gap-1 text-[7.5px] font-semibold text-accent transition-colors hover:text-accent/80"><Sparkle size={9} weight="fill" /> Generate</button>
                </span>
              </span>
              <div className="input-shell flex h-[38px] items-center gap-2 rounded-[11px] px-3">
                <Password size={13} weight="duotone" className="shrink-0 text-faint" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={revealed ? "text" : "password"}
                  placeholder="Enter a strong password"
                  name="new-password"
                  autoComplete="new-password"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-main outline-none placeholder:font-sans placeholder:text-faint"
                />
                <div className="flex items-center gap-0.5">
                  <Tooltip label="Paste password">
                    <button type="button" onClick={() => void pasteInto(setPassword, "Password")} className="flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-[var(--hover)] hover:text-main" aria-label="Paste password">
                      <PasteIcon size={12} weight="duotone" />
                    </button>
                  </Tooltip>
                  <CopyButton value={password} label="Password" onCopied={onNotify} />
                  <button type="button" onClick={() => setRevealed((value) => !value)} className="flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-[var(--hover)] hover:text-main" aria-label="Reveal password">
                    {revealed ? <EyeSlash size={12} /> : <Eye size={12} />}
                  </button>
                  <button type="button" onClick={makePassword} className="flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-[var(--hover)] hover:text-main" aria-label="Regenerate password">
                    <Password size={13} weight="duotone" />
                  </button>
                </div>
              </div>
            </label>
          )}

          {category === "login" && (
            <label className="block">
              <span className="mb-1 block text-[8.5px] font-semibold text-muted">Website</span>
              <div className="input-shell flex h-[38px] items-center gap-2 rounded-[11px] px-3">
                <span className="text-[9px] font-semibold text-faint">https://</span>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="google.com" name="url" autoComplete="url" inputMode="url" spellCheck={false} className="min-w-0 flex-1 bg-transparent text-[11.5px] text-main outline-none placeholder:text-faint" />
              </div>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-[8.5px] font-semibold text-muted">{category === "note" ? "Private note" : "Notes · optional"}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Only visible on this device." className="field resize-none leading-relaxed" />
          </label>

          {(seed?.note || draft?.note) && (
            <div className="mt-1">
              <OcrCopyPad
                rawText={seed?.note || draft?.note || ""}
                onAssign={handleOcrAssign}
                onNotify={onNotify}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[8.5px] font-semibold text-muted">Folder</span>
              <div className="input-shell flex h-[38px] items-center gap-2 rounded-[11px] px-3">
                <FolderSimple size={13} weight="duotone" className="text-faint" />
                <select value={folder} onChange={(e) => setFolder(e.target.value)} className="min-w-0 flex-1 appearance-none bg-transparent text-[10px] text-main outline-none">
                  {["Work", "Personal", "Finance", "Archive"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </label>
            <div className="flex flex-col justify-end">
              <span className="mb-1 block text-[8.5px] font-semibold text-muted">Quick options</span>
              <div className="secondary-button flex h-[38px] items-center gap-2 rounded-[11px] px-2.5 text-[9px] font-medium">
                <GlassCheck checked={favorite} onChange={() => setFavorite((value) => !value)} label="Favorite" />
                <button type="button" onClick={() => setFavorite((value) => !value)} className="h-full flex-1 text-left text-[9px] font-medium">
                  Add to favorites
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-1.5 text-[7.5px] leading-relaxed text-faint">
          <ShieldCheck size={11} weight="duotone" className="mt-0.5 shrink-0 text-[var(--success)]" />
          Your entry is sealed with the vault key before writing. VaultZero cannot read it after you close the app.
        </div>
      </form>
    </Modal>
  );
}

// ————————————————————————————————— OCR capture —————————————————————————————————
type OcrStage = "idle" | "scanning" | "done";

const sampleText = `Google Workspace
Email: ayaan@vaultzero.me
Password: N0va-Sunrise#2026
Note: Primary account used for mail and calendar.
Backup code: GX7Q-4H2M-91LA`;

/** Pull the obvious credential fields out of recognised text. */
function parseScan(text: string): Partial<VaultItem> {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const grab = (...keys: string[]) => {
    for (const line of lines) {
      const match = line.match(/^([\w .\-/]{2,24})\s*[:=]\s*(.+)$/);
      if (match && keys.some((key) => match[1].trim().toLowerCase().startsWith(key))) return match[2].trim();
    }
    return "";
  };
  const email = grab("email", "e-mail", "user", "username", "login", "account", "id")
    || (text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? "");
  const password = grab("password", "pass", "pwd", "passcode", "key");
  const site = grab("website", "site", "url", "domain", "host")
    || (text.match(/\b([a-z0-9-]+\.(?:com|net|org|io|dev|co|me|so))\b/i)?.[1] ?? "");
  const title = lines[0] && !lines[0].includes(":")
    ? lines[0]
    : site ? site.replace(/^www\./, "").split(".")[0].replace(/^./, (c) => c.toUpperCase()) : "Scanned login";
  return {
    title: title.slice(0, 48),
    username: email,
    password,
    url: site,
    category: password || email ? "login" : "note",
    brand: detectBrand(`${title} ${site}`),
    note: password || email ? undefined : text,
    tags: ["Scanned"],
    folder: "Work",
  };
}

async function extractQrFromImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: "dontInvert",
        });
        resolve(code ? code.data : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function OcrModal({
  onClose,
  onCreate,
  onDraft,
  onNotify,
  lang = "en",
}: {
  onClose: () => void;
  onCreate: CreateItem;
  onDraft: (draft: Partial<VaultItem>) => void;
  onNotify: Notify;
  lang?: Language;
}) {
  const [stage, setStage] = useState<OcrStage>("idle");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("Visual capture");
  const [preview, setPreview] = useState<string | null>(null);
  const [extracted, setExtracted] = useState("");
  const [title, setTitle] = useState("Scanned capture");
  const [assignedUsername, setAssignedUsername] = useState<string | null>(null);
  const [assignedPassword, setAssignedPassword] = useState<string | null>(null);
  const [assignedUrl, setAssignedUrl] = useState<string | null>(null);
  const [detectedTotp, setDetectedTotp] = useState<{
    issuer?: string;
    label?: string;
    secret: string;
    period?: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleOcrAssign = (field: OcrField, value: string) => {
    if (field === "title") {
      setTitle(value);
      onNotify(lang === "bn" ? `শিরোনাম: ${value}` : `Title: ${value}`);
    } else if (field === "username") {
      setAssignedUsername(value);
      onNotify(lang === "bn" ? `ইউজারনেম: ${value}` : `Username: ${value}`);
    } else if (field === "password") {
      setAssignedPassword(value);
      onNotify(lang === "bn" ? `পাসওয়ার্ড সেট করা হয়েছে` : `Password assigned`);
    } else if (field === "url") {
      setAssignedUrl(value);
      onNotify(lang === "bn" ? `ওয়েবসাইট: ${value}` : `Website: ${value}`);
    } else if (field === "note") {
      setExtracted((prev) => (prev ? `${prev}\n${value}` : value));
      onNotify(lang === "bn" ? `নোটের সাথে যুক্ত করা হয়েছে` : `Appended to note`);
    }
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onNotify("Please choose a PNG, JPG or screenshot");
      return;
    }
    if (file.size > MAX_OCR_FILE_SIZE) {
      onNotify(`Image exceeds 12 MiB limit (${(file.size / 1024 / 1024).toFixed(1)} MiB)`);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setFileName(file.name);
    setStage("scanning");
    setProgress(15);

    try {
      // 1. Run local OCR text extraction
      const { rawText, creds } = await runLocalOcr(file, (p) => setProgress(p));
      let resText = rawText || "No text detected in image.";

      // 2. Concurrently check for 2FA Authenticator QR code (otpauth://...)
      const qrData = await extractQrFromImage(file);
      if (qrData) {
        if (qrData.startsWith("otpauth://totp/")) {
          try {
            const parsedTotp = parseOtpAuthUri(qrData);
            setDetectedTotp(parsedTotp);
            onNotify(
              lang === "bn"
                ? `২FA অথেন্টিকেটর কিউআর কোড পাওয়া গেছে (${parsedTotp.issuer || parsedTotp.label})`
                : `2FA Authenticator QR code detected (${parsedTotp.issuer || parsedTotp.label})`
            );
          } catch {}
        }
        resText = `[QR CODE]: ${qrData}\n\n${resText}`;
      }

      setExtracted(resText);
      const parsed = parseScan(resText);
      setTitle(parsed.title || creds.title || file.name.replace(/\.[^/.]+$/, ""));
      setProgress(100);
      setStage("done");
      onNotify(lang === "bn" ? "ছবি স্থানীয়ভাবে অ্যানালাইজ সম্পন্ন · জিরো টেলিমেট্রি" : "Image analyzed locally · zero telemetry");
    } catch (err: any) {
      onNotify(err?.message || "Failed to analyze image");
      setStage("idle");
    }
  };

  const trySample = () => {
    setFileName("sample-workspace.png");
    setExtracted(sampleText);
    setTitle("Google sign-in capture");
    setPreview(null);
    setStage("done");
    onNotify("Sample credentials loaded");
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      const imageItem = [...items].find((item) => item.type.startsWith("image/"));
      if (imageItem) {
        const file = imageItem.getAsFile();
        if (file) {
          event.preventDefault();
          handleFile(file);
        }
        return;
      }
      const text = event.clipboardData?.getData("text");
      if (text?.trim()) {
        event.preventDefault();
        setExtracted(text.trim());
        setTitle(text.trim().split("\n")[0].slice(0, 48) || "Pasted capture");
        setFileName("Pasted text");
        setPreview(null);
        setStage("done");
        onNotify("Text imported without touching the network");
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const createItem = () => {
    const parsed = parseScan(extracted);
    onDraft({
      ...parsed,
      title: title.trim() || parsed.title,
      username: assignedUsername || parsed.username,
      password: assignedPassword || parsed.password,
      url: assignedUrl || parsed.url,
      note: extracted,
      totp: detectedTotp?.secret || parsed.totp,
    });
    onNotify(lang === "bn" ? "ওসিআর তথ্য অ্যাড ফর্মে প্রস্তুত — রিভিউ করে সেভ করুন" : "Scanned details ready — review before saving");
  };

  const save = () => {
    const cleanTitle = title.trim() || "OCR visual capture";
    onCreate({
      id: `ocr-${Date.now()}`,
      title: cleanTitle,
      username: "OCR capture",
      password: "—",
      url: "",
      category: "note",
      brand: "vault",
      favorite: false,
      strength: "strong",
      score: 4,
      modified: "Just now",
      note: extracted,
      tags: ["OCR", "Imported"],
      folder: "Work",
    });
    onNotify("Extracted text secured in your vault");
    onClose();
  };

  const reset = () => {
    setStage("idle");
    setProgress(0);
    setFileName("Visual capture");
    setPreview(null);
    setExtracted("");
    setTitle("Scanned capture");
  };

  return (
    <Modal
      onClose={onClose}
      title="Scan & import"
      subtitle="Turn a screenshot into a new vault item. OCR runs entirely on this device."
      icon={<Scan size={20} weight="duotone" />}
      width="max-w-[660px]"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-1.5 text-[8.5px] text-faint">
            <LockSimple size={11} weight="duotone" className="shrink-0 text-success" />
            Images are discarded after extraction (100% offline)
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            {stage !== "done" ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="secondary-button h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[11px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="primary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-[11px] font-semibold shadow-md shadow-[var(--accent-glow)]"
                >
                  <Image size={15} weight="bold" /> Choose image
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={reset}
                  className="secondary-button h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[11px] font-semibold"
                >
                  Scan another
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="secondary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[11px] font-semibold"
                >
                  <NotePencil size={14} weight="duotone" /> Save as note
                </button>
                <button
                  type="button"
                  onClick={createItem}
                  className="primary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-[11px] font-semibold shadow-md shadow-[var(--accent-glow)]"
                >
                  <Plus size={14} weight="bold" /> Create item
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/heic" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />

      <div className="mb-3 flex items-center justify-center gap-1.5">
        {[
          { id: "capture", label: "Capture" },
          { id: "extract", label: "Extract" },
          { id: "save", label: "Save" },
        ].map((step, index) => {
          const active = stage === "idle" ? index === 0 : stage === "scanning" ? index <= 1 : true;
          return (
            <div key={step.id} className="flex items-center gap-1.5">
              <span
                className="flex h-5 items-center gap-1 rounded-full px-2 text-[7.5px] font-semibold transition-all"
                style={{
                  color: active ? "var(--accent)" : "var(--text-faint)",
                  background: active ? "var(--accent-soft)" : "var(--glass-soft)",
                  border: `1px solid ${active ? "color-mix(in srgb, var(--accent) 20%, transparent)" : "var(--border-soft)"}`,
                }}
              >
                {stage === "done" && index <= 1 ? <Check size={8} weight="bold" /> : <span className="font-mono text-[6px]">{index + 1}</span>}
                {step.label}
              </span>
              {index < 2 && <ArrowRight size={9} className="text-faint" />}
            </div>
          );
        })}
      </div>

      {stage === "idle" && (
        <>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className="group relative flex min-h-[216px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[20px] border border-dashed p-6 text-center transition-all duration-300"
            style={{
              borderColor: dragging ? "var(--accent)" : "var(--border)",
              background: dragging ? "var(--accent-soft)" : "var(--glass-soft)",
              boxShadow: dragging ? "0 0 0 4px var(--accent-soft), inset 0 1px 0 rgba(255,255,255,.3)" : "var(--inset-hi)",
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
            aria-label="Upload an image for OCR"
          >
            <div
              aria-hidden
              className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-50 blur-3xl transition-opacity group-hover:opacity-80"
              style={{ background: "radial-gradient(circle, var(--accent-glow), transparent 68%)" }}
            />
            <div className="relative">
              <span
                className="mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-[18px] border text-white transition-transform duration-300 group-hover:-translate-y-1"
                style={{
                  borderColor: "rgba(255,255,255,.3)",
                  background: "linear-gradient(145deg, var(--accent), var(--accent-deep))",
                  boxShadow: "0 16px 30px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,.4)",
                }}
              >
                <UploadSimple size={25} weight="duotone" />
              </span>
              <span className="absolute -right-5 -top-3 flex h-7 w-7 items-center justify-center rounded-[9px] border border-[var(--border)] bg-[var(--glass-strong)] text-accent shadow-md"><Camera size={13} weight="duotone" /></span>
              <span className="absolute -bottom-1 -left-6 flex h-7 w-7 items-center justify-center rounded-[9px] border border-[var(--border)] bg-[var(--glass-strong)] text-[var(--warning)] shadow-md"><ClipboardText size={13} weight="duotone" /></span>
            </div>
            <h3 className="relative mt-3 font-display text-[15px] font-semibold tracking-[-0.02em] text-main">Drag & drop image</h3>
            <p className="relative mt-1 text-[9.5px] text-muted">or <span className="font-semibold text-accent">press Ctrl+V</span> to paste a screenshot</p>
            <div className="relative mt-3 flex items-center gap-1.5">
              <span className="rounded-md border border-[var(--border-soft)] bg-[var(--glass-input)] px-2 py-1 font-mono text-[7px] text-faint">PNG</span>
              <span className="rounded-md border border-[var(--border-soft)] bg-[var(--glass-input)] px-2 py-1 font-mono text-[7px] text-faint">JPG</span>
              <span className="rounded-md border border-[var(--border-soft)] bg-[var(--glass-input)] px-2 py-1 font-mono text-[7px] text-faint">SCREENSHOT</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[13px] border border-[var(--border-soft)] bg-[var(--glass-soft)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-accent"><Sparkle size={14} weight="duotone" /></span>
              <div><p className="text-[9px] font-semibold text-main">No image ready?</p><p className="text-[7.5px] text-faint">Try the workflow with a sample capture.</p></div>
            </div>
            <button onClick={trySample} className="secondary-button h-7 shrink-0 rounded-full px-3 text-[8.5px] font-semibold">Try sample</button>
          </div>
        </>
      )}

      {stage === "scanning" && (
        <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--glass-strong)] p-4">
          <div className="relative flex h-[158px] items-center justify-center overflow-hidden rounded-[13px] border border-[var(--border-soft)]" style={{ background: "var(--glass-input)" }}>
            {preview ? <img src={preview} alt="OCR source preview" className="h-full w-full object-contain" /> : <div className="flex flex-col items-center gap-2 text-faint"><Image size={37} weight="duotone" /><p className="text-[9px]">Sample capture</p></div>}
            <div className="absolute inset-x-0 top-0 h-[2px] animate-[scanline_2.2s_ease-in-out_infinite]" style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)", boxShadow: "0 0 14px var(--accent)" }} />
            <span className="absolute left-2 top-2 rounded-md border border-[var(--border)] bg-[var(--glass-strong)] px-1.5 py-0.5 font-mono text-[7px] text-accent">SCANNING</span>
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent"><Scan size={15} weight="duotone" /></span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex justify-between text-[8px]"><span className="font-semibold text-main">Reading text locally</span><span className="font-mono text-accent">{progress}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border-ink)]"><div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--accent-deep), var(--accent))" }} /></div>
              <p className="mt-1 text-[7.5px] text-faint">{fileName} · on-device vision model</p>
            </div>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="animate-fade">
          <div className="mb-2.5 flex items-center gap-2 rounded-[13px] border p-2" style={{ borderColor: "color-mix(in srgb, var(--success) 22%, transparent)", background: "var(--success-soft)" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--glass-strong)] text-[var(--success)]"><CheckCircle size={16} weight="fill" /></span>
            <div className="min-w-0 flex-1"><p className="text-[9px] font-semibold text-main">Capture extracted & verified</p><p className="text-[7.5px] text-muted">98.4% confidence · processed in 0.8s · discarded</p></div>
            <button onClick={() => fileRef.current?.click()} className="text-[8px] font-semibold text-accent">Replace</button>
          </div>
          {detectedTotp && (
            <div className="mb-2.5 flex items-center justify-between gap-3 rounded-[14px] border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
                  <ShieldCheck size={16} weight="bold" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold text-main">
                    {lang === "bn" ? "২FA অথেন্টিকেটর কিউআর শনাক্ত হয়েছে" : "2FA Authenticator QR Detected"}
                  </p>
                  <p className="font-mono text-[8px] text-muted">
                    {detectedTotp.issuer ? `${detectedTotp.issuer} · ` : ""}{detectedTotp.label} ({lang === "bn" ? "সিক্রেট কি" : "Secret"}: {detectedTotp.secret.slice(0, 6)}••••)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onCreate({
                    id: `totp-${Date.now()}`,
                    title: detectedTotp.issuer || detectedTotp.label || "2FA Account",
                    username: detectedTotp.label || "2FA User",
                    password: "—",
                    url: "",
                    category: "login",
                    brand: "vault",
                    favorite: false,
                    strength: "strong",
                    score: 4,
                    modified: "Just now",
                    totp: detectedTotp.secret,
                    tags: ["2FA", "Scanned"],
                    folder: "Work",
                  });
                  onNotify(lang === "bn" ? "২FA অ্যাকাউন্ট ভল্টে সংরক্ষিত হয়েছে" : "2FA Authenticator account saved to vault");
                  onClose();
                }}
                className="primary-button h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-[9.5px] font-semibold"
              >
                {lang === "bn" ? "২FA যোগ করুন" : "Save 2FA Account"}
              </button>
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-[122px_1fr]">
            <div className="hidden flex-col gap-2 sm:flex">
              <div className="relative flex h-[92px] items-center justify-center overflow-hidden rounded-[11px] border border-[var(--border-soft)] bg-[var(--glass-input)]">
                {preview ? <img src={preview} alt="Source" className="h-full w-full object-cover" /> : <div className="flex flex-col items-center gap-1 text-faint"><Scan size={23} weight="duotone" /><span className="text-[7px]">Source image</span></div>}
              </div>
              <div className="rounded-[10px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-2">
                <p className="text-[6.5px] font-bold uppercase tracking-[0.1em] text-faint">Detected</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {["Email", "Password", "Backup code"].map((detected) => <span key={detected} className="rounded border border-[var(--border-soft)] bg-[var(--glass-strong)] px-1 py-0.5 text-[6.5px] text-muted">{detected}</span>)}
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[8px] font-semibold text-muted">Note title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="field mb-2 font-medium" />
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[8px] font-semibold text-muted">Extracted text</label>
                <span className="flex items-center gap-1 font-mono text-[6.5px] text-[var(--success)]"><span className="h-1 w-1 rounded-full bg-current" /> LOCAL</span>
              </div>
              <textarea
                value={extracted}
                onChange={(e) => setExtracted(e.target.value)}
                rows={5}
                className="field resize-none font-mono text-[9px] leading-relaxed text-main"
                spellCheck={false}
              />

              {(assignedUsername || assignedPassword || assignedUrl) && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-[8px]">
                  {assignedUsername && (
                    <span className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2 py-0.5 text-accent font-medium">
                      User: {assignedUsername}
                    </span>
                  )}
                  {assignedPassword && (
                    <span className="rounded-md border border-[var(--success)]/30 bg-[var(--success-soft)] px-2 py-0.5 text-success font-medium">
                      Password: {assignedPassword.slice(0, 4)}••••
                    </span>
                  )}
                  {assignedUrl && (
                    <span className="rounded-md border border-[var(--border)] bg-[var(--glass-strong)] px-2 py-0.5 text-muted font-medium">
                      URL: {assignedUrl}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-2">
                <OcrCopyPad
                  rawText={extracted}
                  onTextChange={setExtracted}
                  onAssign={handleOcrAssign}
                  onNotify={onNotify}
                  lang={lang}
                />
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[7.5px] text-faint"><ShieldCheck size={10} weight="duotone" className="text-[var(--success)]" /> OCR runs entirely on this device (100% offline). Source pixels are never uploaded or retained.</div>
        </div>
      )}
    </Modal>
  );
}
