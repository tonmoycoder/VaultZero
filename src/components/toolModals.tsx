import {
  ArrowClockwise,
  ArrowsLeftRight,
  Broadcast,
  Camera,
  Clock,
  Copy,
  Devices,
  DownloadSimple,
  FilePdf,
  FirstAidKit,
  Key,
  LockSimple,
  PaperPlaneTilt,
  Password,
  Printer,
  QrCode,
  ShieldCheck,
  Sparkle,
  Trash,
  WifiHigh,
} from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The QR decoder, loaded on demand.
 *
 * PERFORMANCE: the decoder is 132 KB of JavaScript. It was imported
 * statically, so it was part of the initial download even though it is
 * only needed when the camera scanner runs.
 *
 * The camera scans a frame on every animation frame, so the module has to
 * be fetched exactly once and then reused. The promise is cached, which
 * means the first frame waits for the download and every later frame gets
 * the module synchronously.
 */
let jsQrPromise: Promise<typeof import("jsqr").default> | null = null;

function loadJsQr(): Promise<typeof import("jsqr").default> {
  jsQrPromise ??= import("jsqr").then((module) => module.default);
  return jsQrPromise;
}
import { t, type Language, type VaultItem } from "../lib/vault";
import {
  defaultGeneratorOptions,
  generatePassphrase,
  generatePassword,
  passwordStrength,
  type GeneratorOptions,
} from "../lib/generate";
import { cn } from "../utils/cn";
import { BrandMark, Modal, Toggle, Tooltip, TotpRing, useCountdown } from "./ui";
import { generateTotp, isValidTotpSecret, resolveTotpConfig, validateGoogleAuthSecret } from "../lib/totp";
import { copySecure } from "../lib/clipboard";
import { invokeNativeCommand } from "../lib/platform";
import { isValidPeerAddress, mergeSummary, parsePeerInput, parsePeerVaultPayload } from "../lib/p2pMerge";

type Notify = (message: string) => void;

/** Formats a 6-digit pairing PIN as "123 456" for readability. */
function formatPin(pin: string): string {
  const clean = pin.replace(/\D/g, "");
  if (clean.length !== 6) return pin;
  return `${clean.slice(0, 3)} ${clean.slice(3)}`;
}

async function copyValue(value: string, onNotify: Notify, message: string) {
  await copySecure(value, { timeoutMs: 30_000 });
  onNotify(message);
}

// ————————————————————————————————— Password generator —————————————————————————————————
export function GeneratorModal({ onClose, onNotify }: { onClose: () => void; onNotify: Notify }) {
  const [mode, setMode] = useState<"password" | "passphrase">("password");
  const [options, setOptions] = useState<GeneratorOptions>(defaultGeneratorOptions);
  const [password, setPassword] = useState(() => generatePassword(defaultGeneratorOptions));
  const [words, setWords] = useState(5);
  const [separator, setSeparator] = useState("-");
  // PERFORMANCE (V-38): the wordlist is loaded on demand, so the very first
  // passphrase is produced asynchronously. The generator shows a short
  // "loading" state until it resolves.
  const [phrase, setPhrase] = useState("");
  const [phraseLoading, setPhraseLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const result = mode === "password" ? password : phrase;
  const strength = passwordStrength(result);

  const update = (patch: Partial<GeneratorOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    setPassword(generatePassword(next));
  };

  const regenerate = () => {
    if (mode === "password") {
      setPassword(generatePassword(options));
      return;
    }
    setPhraseLoading(true);
    void generatePassphrase(words, separator, true).then((next) => {
      setPhrase(next);
      setPhraseLoading(false);
    });
  };

  useEffect(() => {
    let cancelled = false;
    setPhraseLoading(true);
    void generatePassphrase(words, separator, true).then((next) => {
      if (cancelled) return;
      setPhrase(next);
      setPhraseLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [words, separator]);

  const toggles: { key: keyof GeneratorOptions; label: string; hint: string }[] = [
    { key: "uppercase", label: "Uppercase", hint: "A–Z" },
    { key: "lowercase", label: "Lowercase", hint: "a–z" },
    { key: "numbers", label: "Numbers", hint: "0–9" },
    { key: "symbols", label: "Symbols", hint: "!@#" },
    { key: "avoidAmbiguous", label: "Avoid look-alikes", hint: "Il1O0" },
  ];

  return (
    <Modal
      onClose={onClose}
      title="Password generator"
      subtitle="Cryptographically random. Created and kept on this device."
      icon={<Password size={20} weight="duotone" />}
      width="max-w-[540px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[8.5px] text-faint">
            <LockSimple size={11} weight="duotone" className="shrink-0 text-success" />
            Never sent to a server
          </span>
          <div className="flex items-center gap-2.5">
            <button onClick={onClose} className="secondary-button h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[11px] font-semibold">Done</button>
            <button
              onClick={() => void copyValue(result, onNotify, "Generated password copied")}
              className="primary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-[11px] font-semibold shadow-md shadow-[var(--accent-glow)]"
            >
              <Copy size={12} weight="bold" /> Use password
            </button>
          </div>
        </div>
      }
    >
      <div className="mt-1 flex rounded-full border border-[var(--border-soft)] bg-[var(--glass-input)] p-[3px]">
        {(["password", "passphrase"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setMode(option)}
            className={cn(
              "h-7 flex-1 rounded-full text-[9.5px] font-semibold capitalize transition-all",
              mode === option ? "bg-[var(--glass-strong)] text-main shadow-sm" : "text-muted hover:text-main",
            )}
            style={{ border: mode === option ? "1px solid var(--border)" : "1px solid transparent" }}
          >
            {option === "password" ? "Random password" : "Memorable passphrase"}
          </button>
        ))}
      </div>

      <div
        className="relative mt-3 overflow-hidden rounded-[18px] border p-4"
        style={{
          borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border))",
          background: "linear-gradient(145deg, var(--accent-soft), var(--glass-strong))",
        }}
      >
        <div aria-hidden className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[var(--accent)] opacity-10 blur-2xl" />
        <div className="relative mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-[0.13em] text-faint">
            <Sparkle size={10} weight="fill" style={{ color: "var(--accent)" }} />
            Your new {mode}
          </span>
          <div className="flex items-center gap-1">
            <Tooltip label="Regenerate">
              <button
                onClick={regenerate}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-all hover:rotate-45 hover:bg-[var(--hover)] hover:text-main"
                aria-label="Regenerate password"
              >
                <ArrowClockwise size={14} weight="duotone" />
              </button>
            </Tooltip>
            <Tooltip label={visible ? "Hide" : "Show"}>
              <button
                onClick={() => setVisible((value) => !value)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-[var(--hover)] hover:text-main"
                aria-label={visible ? "Hide password" : "Show password"}
              >
                <span className="text-[8px] font-bold">{visible ? "HIDE" : "SHOW"}</span>
              </button>
            </Tooltip>
            <Tooltip label="Copy password">
              <button
                onClick={() => void copyValue(result, onNotify, "Generated password copied")}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-[var(--hover)] hover:text-main"
                aria-label="Copy password"
              >
                <Copy size={13} weight="duotone" />
              </button>
            </Tooltip>
          </div>
        </div>
        <p
          className={cn(
            "relative min-h-[48px] break-all font-mono font-semibold leading-[1.45] tracking-[-0.02em] text-main",
            mode === "password" ? "text-[19px]" : "text-[17px]",
            !visible && "select-none blur-[7px]",
          )}
        >
          {phraseLoading && mode === "passphrase" ? (
            <span className="text-[11px] font-sans font-medium text-faint">Loading wordlist…</span>
          ) : (
            result
          )}
        </p>
        <div className="relative mt-3 flex items-center justify-between gap-2 border-t border-[var(--border-soft)] pt-2.5">
          <span className="flex items-center gap-1.5 text-[8.5px] font-semibold" style={{ color: strength.color }}>
            <ShieldCheck size={12} weight="duotone" /> {strength.label}
          </span>
          <span className="flex flex-1 max-w-[120px] gap-[3px]">
            {[1, 2, 3, 4].map((n) => (
              <span
                key={n}
                className="h-[4px] flex-1 rounded-full"
                style={{ background: n <= strength.score ? strength.color : "var(--border-ink)" }}
              />
            ))}
          </span>
          <span className="font-mono text-[7.5px] text-faint">{strength.entropy} bits</span>
        </div>
      </div>

      {mode === "password" ? (
        <>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[9px] font-semibold text-soft">Length</span>
              <span className="rounded-md border border-[var(--border-soft)] bg-[var(--glass-soft)] px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
                {options.length}
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={64}
              value={options.length}
              onChange={(e) => update({ length: Number(e.target.value) })}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
              style={{
                accentColor: "var(--accent)",
                background: `linear-gradient(90deg, var(--accent) ${((options.length - 8) / 56) * 100}%, var(--border-ink) ${((options.length - 8) / 56) * 100}%)`,
              }}
              aria-label="Password length"
            />
            <div className="mt-1 flex justify-between font-mono text-[7px] text-faint"><span>8</span><span>24</span><span>64</span></div>
          </div>
          <div className="glass-soft mt-3 divide-y divide-[var(--border-soft)] overflow-hidden rounded-[15px] border border-[var(--border-soft)]">
            {toggles.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 px-3 py-[9px]">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--glass-soft)] font-mono text-[10px] font-semibold text-muted">
                    {item.hint.slice(0, 3)}
                  </span>
                  <span className="text-[10px] font-medium text-soft">{item.label}</span>
                </div>
                <Toggle
                  checked={options[item.key] as boolean}
                  onChange={(value) => update({ [item.key]: value })}
                  label={item.label}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="glass-soft mt-4 space-y-3 rounded-[15px] border border-[var(--border-soft)] p-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between"><span className="text-[9px] font-semibold text-soft">Word count</span><span className="font-mono text-[9px] text-accent">{words}</span></div>
            <input type="range" min={3} max={9} value={words} onChange={(e) => setWords(Number(e.target.value))} className="h-1.5 w-full cursor-pointer rounded-full" style={{ accentColor: "var(--accent)", background: "var(--border-ink)" }} aria-label="Word count" />
          </div>
          <div>
            <p className="mb-1.5 text-[9px] font-semibold text-soft">Separator</p>
            <div className="flex gap-1.5">
              {["-", " ", ".", "_"].map((sep) => (
                <button
                  key={sep}
                  onClick={() => setSeparator(sep)}
                  className={cn("flex h-7 min-w-8 items-center justify-center rounded-lg border px-2 font-mono text-[10px] transition-all", separator === sep ? "text-accent" : "text-muted")}
                  style={{ borderColor: separator === sep ? "var(--accent)" : "var(--border-soft)", background: separator === sep ? "var(--accent-soft)" : "var(--glass-input)" }}
                >
                  {sep === " " ? "space" : sep}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="mt-3 text-center text-[8px] leading-relaxed text-faint">
        Uses your device's secure random source. VaultZero keeps no generator history.
      </p>
    </Modal>
  );
}

// ————————————————————————————————— Authenticator —————————————————————————————————
type AuthAccount = { id: string; title: string; brand?: VaultItem["brand"]; code: string; added?: boolean };

export function AuthenticatorModal({
  items,
  onClose,
  onNotify,
  onOpenSync,
}: {
  items: VaultItem[];
  onClose: () => void;
  onNotify: Notify;
  onOpenSync: () => void;
}) {
  const { remaining, progress } = useCountdown();
  const accounts = useMemo<AuthAccount[]>(
    () => items.filter((item) => isValidTotpSecret(item.totp)).map((item) => ({ id: item.id, title: item.title, brand: item.brand, code: item.totp! })),
    [items],
  );
  const [extra, setExtra] = useState<AuthAccount[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [secretError, setSecretError] = useState("");
  const [liveCodes, setLiveCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const allAccounts = [
      ...items.filter((item) => isValidTotpSecret(item.totp)).map((item) => ({ id: item.id, secret: item.totp! })),
      ...extra.map((acc) => ({ id: acc.id, secret: acc.code })),
    ];

    Promise.all(
      allAccounts.map(async (acc) => {
        try {
          const res = await generateTotp(resolveTotpConfig(acc.secret));
          return { id: acc.id, code: res.code };
        } catch {
          // Never display the setup secret as if it were a one-time code.
          return { id: acc.id, code: "••• •••" };
        }
      })
    ).then((results) => {
      if (!cancelled) {
        const map: Record<string, string> = {};
        for (const r of results) {
          map[r.id] = r.code;
        }
        setLiveCodes(map);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [items, extra, remaining]);

  const addAccount = () => {
    setSecretError("");
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSecretError("Account name is required");
      return;
    }
    const validation = validateGoogleAuthSecret(secret, "en");
    if (!validation.valid) {
      setSecretError(validation.error || "Invalid Base32 secret key");
      return;
    }
    const cleanSecret = validation.cleanKey;
    setExtra((current) => [...current, { id: `new-${Date.now()}`, title: trimmedName, code: cleanSecret, added: true }]);
    setName("");
    setSecret("");
    setSecretError("");
    setAdding(false);
    onNotify("✓ Authenticator account added locally with valid Base32 secret");
  };

  const removeAccount = (id: string) => {
    setExtra((current) => current.filter((a) => a.id !== id));
    onNotify("Account removed");
  };

  return (
    <Modal
      onClose={onClose}
      title="Authenticator"
      subtitle="Time-based one-time passwords, updated every 30 seconds."
      icon={<ShieldCheck size={20} weight="duotone" />}
      width="max-w-[520px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[8.5px] text-faint"><WifiHigh size={12} weight="duotone" /> {t("en", "synced")}</span>
          <button onClick={onOpenSync} className="secondary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-[11px] font-semibold">
            <ArrowsLeftRight size={14} weight="duotone" /> Sync to phone
          </button>
        </div>
      }
    >
      <div className="glass-soft mb-3 flex items-center gap-3 rounded-[16px] border border-[var(--border-soft)] p-3">
        <TotpRing size={44} remaining={remaining} progress={progress} stroke={3} />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold text-main">Authenticator clock</p>
          <p className="mt-0.5 text-[8px] text-faint">Next rotation in {remaining} seconds</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border-ink)]">
            <div className="h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${progress * 100}%`, background: "var(--accent)" }} />
          </div>
        </div>
        <span className="rounded-full border px-2 py-1 font-mono text-[7px] text-[var(--success)]" style={{ borderColor: "color-mix(in srgb, var(--success) 20%, transparent)", background: "var(--success-soft)" }}>
          SHA-1 · 6
        </span>
      </div>

      <div className="space-y-1.5">
        {[...accounts, ...extra].map((account) => (
          <div key={account.id} className="group flex items-center gap-2.5 rounded-[13px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-2.5 transition-colors hover:bg-[var(--hover)]">
            {account.brand ? (
              <BrandMark brand={account.brand} size={33} />
            ) : (
              <span className="flex h-[33px] w-[33px] items-center justify-center rounded-[10px] border border-[var(--border-soft)] bg-[var(--glass-strong)] text-accent">
                <Key size={15} weight="duotone" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10.5px] font-semibold text-main">{account.title}</p>
              <p className="mt-0.5 text-[7.5px] text-faint">
                {account.brand ? `${account.brand.toLowerCase()}.com` : "RFC 6238 TOTP"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[13px] font-semibold tracking-[0.08em] text-main">{liveCodes[account.id] || account.code}</p>
              <p className="mt-0.5 text-[7px]" style={{ color: remaining <= 5 ? "var(--danger)" : "var(--success)" }}>{remaining}s remaining</p>
            </div>
            <TotpRing size={26} remaining={remaining} progress={progress} stroke={2.2} />
            <div className="flex items-center gap-1">
              <Tooltip label="Copy code">
                <button onClick={() => void copyValue((liveCodes[account.id] || account.code).replace(/\s/g, ""), onNotify, "Authenticator code copied")} className="flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-[var(--hover)] hover:text-main" aria-label="Copy authenticator code">
                  <Copy size={12} />
                </button>
              </Tooltip>
              {account.added && (
                <Tooltip label="Remove account">
                  <button onClick={() => removeAccount(account.id)} className="flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]" aria-label="Remove account">
                    <Trash size={12} />
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="glass-soft mt-3 rounded-[15px] border border-[var(--border-soft)] p-3">
          <p className="mb-2 text-[9px] font-semibold text-soft">Add authenticator account</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name (e.g. GitHub)" className="field" autoFocus />
            <input value={secret} onChange={(e) => { setSecret(e.target.value); setSecretError(""); }} placeholder="Setup key (required Base32)" className="field font-mono" />
          </div>
          {secretError && (
            <p className="mt-1 text-[8px] font-medium text-danger">{secretError}</p>
          )}
          <div className="mt-2 flex justify-end gap-1.5">
            <button onClick={() => { setAdding(false); setSecretError(""); }} className="secondary-button h-7 rounded-full px-3 text-[9px]">Cancel</button>
            <button onClick={addAccount} disabled={!name.trim() || !secret.trim()} className="primary-button h-7 rounded-full px-3 text-[9px] disabled:opacity-40">Add account</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-[var(--border)] py-2.5 text-[9px] font-semibold text-muted transition-colors hover:bg-[var(--hover)] hover:text-main">
          <QrCode size={14} weight="duotone" /> Add account or scan a QR code
        </button>
      )}
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[7.5px] text-faint">
        <LockSimple size={9} weight="duotone" /> Codes are generated on this device without network access.
      </p>
    </Modal>
  );
}

// ————————————————————————————————— Security center —————————————————————————————————
export { default as SecurityCenterModal } from "./SecurityCenter";

export function SyncModal({ onClose, onNotify, items, onMerge, lang = "en" }: {
  onClose: () => void;
  onNotify: Notify;
  items: VaultItem[];
  onMerge: (remote: VaultItem[]) => void;
  lang?: Language;
}) {
  const S = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const [tab, setTab] = useState<"host" | "scan">("host");
  const [status, setStatus] = useState<"waiting" | "connected">("waiting");
  const [connectedPeer, setConnectedPeer] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [peerInputError, setPeerInputError] = useState("");
  const [peerPin, setPeerPin] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [qrImageError, setQrImageError] = useState("");
  const [transferring, setTransferring] = useState(false);
  // SECURITY/V-17: the P2P flow used to be a pure mock that reported success
  // without transferring anything. These hold the REAL host state produced by
  // the Rust `start_p2p_host` command.
  const [hostPin, setHostPin] = useState<string | null>(null);
  const [hostPort, setHostPort] = useState<number | null>(null);
  const [hosting, setHosting] = useState(false);
  const [discovered, setDiscovered] = useState<Array<{ id: string; name: string; ip: string; port: number }>>([]);

  const isMobileDevice = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && typeof window !== "undefined" && window.innerWidth < 800);
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  // V-75: rAF callbacks close over stale render state. A ref is the only
  // reliable way to stop the scanner loop the instant the camera is stopped.
  const cameraActiveRef = useRef(false);
  const qrFileRef = useRef<HTMLInputElement | null>(null);

  /*
   * SECURITY: the PIN is generated locally with a CSPRNG. It is never
   * hard-coded and never transmitted in the clear.
   *
   * It used to be three digits long. The host lockout allows five failed
   * attempts, which is a sensible limit for a six-digit code — 10^6
   * possibilities — but for a three-digit code the whole space is only
   * 10^3, so the limit was worthless. The code has to match the length the
   * lockout was designed for, and the display already formats it as
   * "123 456".
   *
   * Each digit is drawn from its own uniform range rather than being
   * `byte % 10`, which would bias every digit towards the lower end of
   * the range and shrink the effective key space.
   */
  const [localPin] = useState(() => {
    const digits: number[] = [];
    while (digits.length < 6) {
      // `crypto.getRandomValues` rejects a request larger than 65536
      // bytes, and the rejection sampler needs a few bytes per draw.
      const bytes = new Uint8Array(6);
      crypto.getRandomValues(bytes);
      for (const byte of bytes) {
        if (digits.length === 6) break;
        // 250 is the largest multiple of 10 that fits in a byte, so the
        // values 250..255 are rejected and the draw stays uniform.
        if (byte < 250) digits.push(byte % 10);
      }
    }
    return digits.join("");
  });

  /**
   * V-52: the QR used to advertise a hardcoded LAN address and port 1420 before the
   * native host had even started. The real host binds an ephemeral port, so
   * the QR is only meaningful once `start_p2p_host` returns its live port.
   * When the app runs inside Tauri the hostname is a loopback alias and is
   * deliberately left empty: the other device must use Discover Peers.
   */
  const lanHost = useMemo(() => {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const localOnly = !hostname || /^(localhost|tauri\.localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i.test(hostname);
    return localOnly ? "" : hostname;
  }, []);
  const hostPayload = useMemo(() => JSON.stringify({
    app: "vaultzero",
    version: 2,
    ip: lanHost,
    port: hostPort ?? 0,
    code: hostPin ?? localPin,
    protocol: "pake-xchacha20-v2",
  }), [lanHost, hostPort, hostPin, localPin]);

  /**
   * Starts the real Rust P2P host. The vault payload is encrypted by the
   * Rust core before it touches the socket — the renderer never handles
   * plaintext on the wire.
   */
  const handleStartHost = async () => {
    if (hosting) return;
    setHosting(true);
    try {
      const info = await invokeNativeCommand<{ port: number; pin: string; device_name: string }>(
        "start_p2p_host",
        { pin: localPin, deviceName: "VaultZero-Peer" },
      );
      setHostPort(info.port);
      setHostPin(info.pin);
      // V-86: hosting is NOT a connection. The old code turned the banner
      // green and invented "This device · port N" as a peer, which made
      // Send/Receive look live while `peerCoordinates()` could never parse
      // it. Stay in the waiting state until a transfer actually succeeds.
      setStatus("waiting");
      onNotify(`P2P host started on port ${info.port}. Waiting for a peer. PIN ${info.pin}`);
    } catch (err: any) {
      setHosting(false);
      onNotify(err?.safeMessage || "Failed to start the P2P host.");
    }
  };

  /**
   * Discovers VaultZero peers broadcasting on the local network.
   */
  const handleDiscover = async () => {
    try {
      const peers = await invokeNativeCommand<Array<{ id: string; name: string; ip: string; port: number }>>(
        "discover_peers",
      );
      setDiscovered(peers || []);
      if (!peers || peers.length === 0) {
        onNotify("No VaultZero peers found on this network.");
      }
    } catch (err: any) {
      onNotify(err?.safeMessage || "Peer discovery failed.");
    }
  };

  // Camera scanner lifecycle (V-75)
  // Android WebView only shows the runtime permission prompt in response to a
  // real user gesture. Auto-starting on tab change produced an immediate
  // "Permission denied" and made the panel look as if it closed itself. Only
  // the explicit "Start camera" button may request the camera now.
  useEffect(() => {
    if (tab !== "scan" || !isMobileDevice) stopCamera();
    return () => {
      stopCamera();
    };
  }, [tab, isMobileDevice]);

  const startCamera = async () => {
    setCameraError("");
    cameraActiveRef.current = false;
    setCameraActive(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this environment");
      }
      // When android.permission.CAMERA is absent the promise never settles.
      // Bound the wait so the UI explains the problem instead of hanging.
      const request = navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      const stream = await Promise.race([
        request,
        new Promise<MediaStream>((_, reject) =>
          window.setTimeout(() => reject(new Error("Camera permission timed out")), 15000)
        ),
      ]);
      streamRef.current = stream;
      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true");
      await videoRef.current.play();
      cameraActiveRef.current = true;
      setCameraActive(true);
      animFrameRef.current = requestAnimationFrame(tickScanner);
    } catch (err: any) {
      cameraActiveRef.current = false;
      setCameraActive(false);
      setCameraError(
        /denied|not allowed|permission/i.test(err?.message || "")
          ? "Camera permission denied — allow it in Android Settings, then retry."
          : err?.message || "Camera unavailable — tap Start camera to retry."
      );
    }
  };

  const stopCamera = () => {
    cameraActiveRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const tickScanner = () => {
    if (!cameraActiveRef.current) return;
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      if (cameraActiveRef.current) animFrameRef.current = requestAnimationFrame(tickScanner);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // The decoder is fetched once and then reused for every frame. The
    // scanner keeps its frame loop running while the module is in flight,
    // so the first decoded frame simply arrives a moment later.
    void loadJsQr().then((jsQR) => {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      handleScannedCode(code ? code.data : null);
    });

    if (cameraActiveRef.current) animFrameRef.current = requestAnimationFrame(tickScanner);
  };

  /**
   * Handles a decoded QR payload.
   *
   * PERFORMANCE: the decoder resolves asynchronously now, so the result
   * arrives outside the frame loop. The loop keeps running in the
   * meantime, which means a frame that was decoded before the scanner
   * stopped could still arrive afterwards; the camera check makes sure a
   * late result cannot reopen a session that was already closed.
   */
  const handleScannedCode = (text: string | null, fromImage = false) => {
    if (!text || (!cameraActive && !fromImage)) return;

    try {
      const parsed = JSON.parse(text);
      if (parsed.app === "vaultzero" || parsed.ip) {
        // V-17 / V-52: a scanned QR is a *peer selection*, not a completed
        // connection. Capture BOTH the address and the host's pairing PIN —
        // the old code put the PIN into the address field and authenticated
        // with this device's own local PIN, so remote connections always
        // failed the handshake.
        const peer = parsePeerInput(text);
        const candidate = peer.address ?? (parsed.ip ? `${parsed.ip}${parsed.port ? `:${parsed.port}` : ""}` : "");
        // V-86: a QR payload with no usable LAN address is a PIN-only pairing
        // hint. It must NOT paint an arbitrary string as a "connected" peer.
        if (candidate && !isValidPeerAddress(candidate)) {
          onNotify("QR code has no valid LAN address. Use Discover Peers or the 6-digit PIN.");
          return;
        }
        stopCamera();
        if (candidate) {
          setConnectedPeer(candidate);
          setManualCode(candidate);
          setPeerInputError("");
        }
        if (peer.pin) setPeerPin(peer.pin);
        setStatus("waiting");
        onNotify(
          candidate
            ? `Peer selected: ${candidate} — start the transfer to authenticate.`
            : "Pairing PIN received — use Discover Peers to pick a LAN address.",
        );
        return;
      }
      onNotify("This QR code is not a VaultZero pairing code.");
    } catch {
      // Raw text QR: only a real LAN address may become a peer.
      stopCamera();
      if (isValidPeerAddress(text)) {
        setConnectedPeer(text);
        setManualCode(text);
        setPeerInputError("");
        onNotify("Peer selected via QR scan — start the transfer to authenticate.");
      } else {
        onNotify("This QR code is not a valid VaultZero LAN address. Use the 6-digit PIN instead.");
      }
      return;
    }
  };

  /**
   * V-84: native fallback when Android denies CAMERA (or the device has no
   * camera). A file picker with `capture="environment"` still lets the user
   * take / choose a QR photo; the same jsQR decoder then selects the peer.
   */
  const handleQrImage = async (file: File | undefined) => {
    if (!file) return;
    setQrImageError("");
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const jsQR = await loadJsQr();
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" });
      if (!code?.data) {
        setQrImageError(S("এই ছবিতে QR কোড পাওয়া যায়নি।", "No QR code found in that image."));
        return;
      }
      setQrImageError("");
      handleScannedCode(code.data, true);
    } catch {
      setQrImageError(S("ছবিটি পড়া যায়নি। অন্য ছবি চেষ্টা করুন।", "Could not read that image. Try another one."));
    }
  };

  const handleManualConnect = () => {
    const raw = manualCode.trim();
    const peer = parsePeerInput(raw);
    if (!peer.address && !peer.pin) {
      // A transient toast alone felt like "Connect does nothing" (user
      // report). Keep a persistent, bilingual explanation next to the field.
      setPeerInputError(
        S(
          `“${raw || "—"}” বৈধ পিয়ার ঠিকানা নয়। IP:port (যেমন ১৯২.১৬৮.১.৫:৫২১৩৭) অথবা ৬-অঙ্কের PIN দিন।`,
          `"${raw || "—"}" is not a valid peer address. Use IP:port (e.g. 192.168.1.5:52137) or the 6-digit PIN.`,
        ),
      );
      onNotify("Enter a peer IP:port and/or the host's 6-digit pairing PIN.");
      return;
    }
    setPeerInputError("");
    // V-17: selecting a peer is not the same as authenticating to it. The
    // status only flips to "connected" once the handshake succeeds.
    if (peer.address) setConnectedPeer(peer.address);
    if (peer.pin) setPeerPin(peer.pin);
    setStatus("waiting");
    onNotify(`Peer selected: ${peer.address ?? "PIN only"} — start the transfer to authenticate.`);
  };

  const peerCoordinates = () => {
    if (!connectedPeer || !isValidPeerAddress(connectedPeer)) return null;
    const [ip, portText] = connectedPeer.split(":");
    const port = Number(portText ?? hostPort ?? 0);
    if (!port || port > 65535) return null;
    return { ip, port, pin: peerPin ?? hostPin ?? localPin };
  };

  const handleSendVault = async () => {
    setTransferring(true);
    try {
      // Real encrypted transfer to the connected peer. The Rust core performs
      // the authenticated key exchange and encrypts the payload.
      const coords = peerCoordinates();
      if (!coords) {
        onNotify("No live peer port yet. Scan the host QR after it starts hosting.");
        return;
      }
      await invokeNativeCommand("sync_vault_payload", {
        peerIp: coords.ip,
        peerPort: coords.port,
        pin: coords.pin,
      });
      setStatus("connected");
      onNotify("Encrypted vault snapshot sent to peer.");
    } catch (err: any) {
      onNotify(err?.safeMessage || "Encrypted transfer failed.");
    } finally {
      setTransferring(false);
    }
  };

  const handleReceiveMerge = async () => {
    setTransferring(true);
    try {
      const coords = peerCoordinates();
      if (!coords) {
        onNotify("No live peer port yet. Scan the host QR after it starts hosting.");
        return;
      }
      const payload = await invokeNativeCommand<string>("sync_vault_payload", {
        peerIp: coords.ip,
        peerPort: coords.port,
        pin: coords.pin,
      });
      // V-52: actually merge. `sync_vault_payload` returns the peer's vault
      // JSON (the authenticated channel already decrypted it in Rust). We
      // validate every field, normalise Rust Vault entries into VaultItems,
      // then append only ids that are not already present locally.
      const remote = parsePeerVaultPayload(payload);
      if (remote.length === 0) {
        onNotify("Peer vault is empty — nothing to merge.");
        return;
      }
      const summary = mergeSummary(items, remote);
      onMerge(remote);
      setStatus("connected");
      onNotify(
        `Merged ${summary.added} new item${summary.added === 1 ? "" : "s"} from peer ` +
        `(${summary.duplicates} already in your vault).`
      );
    } catch (err: any) {
      onNotify(err?.safeMessage || (err instanceof Error ? err.message : "Encrypted receive failed."));
    } finally {
      setTransferring(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Nearby P2P Sync"
      subtitle="Zero servers. Encrypted peer-to-peer sync between PC and Android over local Wi-Fi."
      icon={<ArrowsLeftRight size={20} weight="duotone" />}
      width="max-w-[640px]"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="hidden items-center gap-1.5 text-[8.5px] text-faint sm:flex">
            <LockSimple size={11} weight="duotone" className="shrink-0 text-success" /> PAKE + Channel Binding · XChaCha20-Poly1305
          </span>
          {/* V-86: at 360px the three actions overflowed and "Close" was
              pushed off the left edge. Wrapping keeps every action on screen
              without adding a hidden horizontal scroll area. */}
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="secondary-button h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[11px] font-semibold sm:px-5"
            >
              Close
            </button>
            {connectedPeer && (
              <>
                <button
                  type="button"
                  onClick={handleSendVault}
                  disabled={transferring}
                  className="secondary-button flex h-9 items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold sm:px-4"
                >
                  <PaperPlaneTilt size={13} weight="bold" />
                  Send Vault
                </button>
                <button
                  type="button"
                  onClick={handleReceiveMerge}
                  disabled={transferring}
                  className="primary-button flex h-9 items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold sm:px-4"
                >
                  <DownloadSimple size={13} weight="bold" />
                  Receive & Merge
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      {/* Real Handshake Status Banner */}
      <div
        className="flex items-center justify-between gap-2 rounded-full border px-3 py-1.5"
        style={{
          borderColor:
            status === "connected"
              ? "color-mix(in srgb, var(--success) 25%, transparent)"
              : "color-mix(in srgb, var(--warning) 25%, transparent)",
          background: status === "connected" ? "var(--success-soft)" : "var(--warning-soft)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              status === "connected" ? "bg-success" : "bg-warning animate-pulse"
            )}
          />
          <span
            className="text-[9px] font-semibold"
            style={{ color: status === "connected" ? "var(--success)" : "var(--warning)" }}
          >
            {connectedPeer
              ? `Peer selected: ${connectedPeer}`
              : hostPort !== null
                ? `Hosting on port ${hostPort} · waiting for a peer`
                : "Waiting for peer selection…"}
          </span>
        </div>
        <span className="font-mono text-[8px] text-muted">LAN Port: {hostPort ?? "—"}</span>
      </div>

      {/* Mode Tabs */}
      <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-[16px] border border-[var(--border-soft)] bg-[var(--glass-input)] p-1.5">
        <button
          type="button"
          onClick={() => setTab("host")}
          className={cn(
            "flex h-9 shrink-0 items-center justify-center gap-2 rounded-[11px] text-[11px] font-semibold transition-all whitespace-nowrap",
            tab === "host"
              ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent-glow)]"
              : "text-muted hover:bg-[var(--hover)] hover:text-main"
          )}
        >
          <QrCode size={15} weight="bold" />
          Host / Show QR
        </button>
        <button
          type="button"
          onClick={() => setTab("scan")}
          className={cn(
            "flex h-9 shrink-0 items-center justify-center gap-2 rounded-[11px] text-[11px] font-semibold transition-all whitespace-nowrap",
            tab === "scan"
              ? "bg-[var(--accent)] text-white shadow-md shadow-[var(--accent-glow)]"
              : "text-muted hover:bg-[var(--hover)] hover:text-main"
          )}
        >
          <Camera size={15} weight="bold" />
          {isMobileDevice ? "Scan QR / Camera" : "Scan QR / Connect"}
        </button>
      </div>

      {/* Tab A: Host / Show Clean QR */}
      {tab === "host" && (
        <div className="mt-3.5 flex flex-col items-center justify-center rounded-[20px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-5 text-center">
          {hostPort !== null ? (
            <div className="rounded-[18px] border-2 border-white/60 bg-white p-3 shadow-xl">
              {/* Clean QR: includeMargin=true, level=M, NO center logo for camera readability.
                  V-52: only rendered after the native host reports its live port. */}
              <QRCodeSVG
                value={hostPayload}
                size={168}
                bgColor="#ffffff"
                fgColor="#17152b"
                level="M"
                includeMargin={true}
                title="VaultZero Pairing QR Code"
              />
            </div>
          ) : (
            <div className="flex h-[168px] w-[168px] items-center justify-center rounded-[18px] border-2 border-dashed p-4 text-center text-[9px] leading-relaxed text-muted" style={{ borderColor: "var(--border)" }}>
              Start the encrypted host to generate a live pairing QR with its real port and PIN.
            </div>
          )}

          <p className="mt-3 font-display text-[12px] font-semibold text-main">
            Scan this QR code with the VaultZero Android App
          </p>
          <p className="mt-0.5 max-w-[340px] text-[8.5px] leading-relaxed text-muted">
            Both devices must be on the same local Wi-Fi. No data is ever relayed through the internet.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-md border border-[var(--border-soft)] bg-[var(--glass-input)] px-2.5 py-1 font-mono text-[9.5px] text-muted">
              IP: {lanHost || "not detected · use Discover"}
            </span>
            <button
              type="button"
              onClick={() => void copyValue(hostPin ?? localPin, onNotify, "Pairing code copied")}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--glass-input)] px-2.5 py-1 font-mono text-[10.5px] font-semibold text-accent"
              aria-label="Copy pairing PIN"
            >
              PIN: {formatPin(hostPin ?? localPin)}
              <Copy size={11} className="text-faint" />
            </button>
          </div>

          {/* V-17: the real host control. Without this the QR code advertised a
              transfer that never happened. */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void handleStartHost()}
              disabled={hosting}
              className="primary-button flex h-8 items-center gap-1.5 rounded-full px-4 text-[10px] font-semibold disabled:opacity-50"
              aria-label="Start encrypted P2P host"
            >
              <Broadcast size={13} weight="bold" />
              {hosting ? "Hosting…" : "Start Encrypted Host"}
            </button>
            <button
              type="button"
              onClick={() => void handleDiscover()}
              className="secondary-button flex h-8 items-center gap-1.5 rounded-full px-4 text-[10px] font-semibold"
              aria-label="Discover nearby VaultZero peers"
            >
              <WifiHigh size={13} weight="bold" />
              Discover Peers
            </button>
          </div>

          {hostPort !== null && (
            <p className="mt-2 text-[8.5px] font-medium text-success">
              Host active on port {hostPort} · payload encrypted with XChaCha20-Poly1305
            </p>
          )}

          {discovered.length > 0 && (
            <div className="mt-2.5 w-full space-y-1">
              <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-faint">Nearby peers</p>
              {discovered.map((peer) => (
                <button
                  key={peer.id}
                  type="button"
                  onClick={() => {
                    setConnectedPeer(`${peer.ip}:${peer.port}`);
                    setStatus("waiting");
                    onNotify(`Selected peer ${peer.name} — start the transfer to authenticate.`);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-[11px] border border-[var(--border-soft)] bg-[var(--glass-input)] px-2.5 py-1.5 text-left hover:bg-[var(--hover)]"
                >
                  <span className="truncate text-[10px] font-semibold text-main">{peer.name}</span>
                  <span className="font-mono text-[8.5px] text-muted">{peer.ip}:{peer.port}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab B: Scan QR / Camera & Manual Input */}
      {tab === "scan" && (
        <div className="mt-3.5 flex flex-col items-center justify-center rounded-[20px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-4 text-center">
          {isMobileDevice ? (
            <div className="relative h-[190px] w-full max-w-[280px] overflow-hidden rounded-[16px] border border-[var(--border)] bg-black/80 shadow-inner">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* Target Reticle */}
              <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-dashed border-[var(--accent)] opacity-70 animate-pulse" />

              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center text-white">
                  <Camera size={24} className="opacity-60" />
                  <p className="mt-1 text-[9px] font-semibold">Camera standby</p>
                  {cameraError && <p className="mt-0.5 text-[7.5px] text-amber-300">{cameraError}</p>}
                  <button
                    type="button"
                    onClick={startCamera}
                    className="secondary-button mt-2 h-6 rounded-full px-2.5 text-[8px] font-semibold text-white"
                  >
                    Start camera
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mb-2 w-full max-w-[360px] rounded-[16px] border border-[var(--border-soft)] bg-[var(--glass-input)] p-3 text-left">
              <p className="flex items-center gap-1.5 text-[9.5px] font-semibold text-main">
                <WifiHigh size={14} weight="duotone" className="text-accent" />
                Desktop Direct LAN Pairing
              </p>
              <p className="mt-1 text-[8px] leading-relaxed text-muted">
                Desktop PCs host the pairing session via QR code. To connect from this PC to another host, enter the peer IP or 6-digit PIN below.
              </p>
            </div>
          )}

          <p className="mt-2.5 text-[9px] text-muted">
            {isMobileDevice ? "Point camera at the host QR code or enter peer details:" : "Enter peer host IP or pairing PIN:"}
          </p>

          {/* V-84: if the camera is denied, a QR photo still pairs the device. */}
          <button
            type="button"
            onClick={() => qrFileRef.current?.click()}
            className="mt-2 flex min-h-[44px] w-full max-w-[340px] items-center justify-center gap-2 rounded-[12px] border border-[var(--border-soft)] bg-[var(--glass-input)] px-3 py-2 text-[10px] font-semibold text-main hover:bg-[var(--hover)]"
          >
            {S("📷 ছবি থেকে QR পড়ুন / ক্যামেরা ছবি তুলুন", "📷 Read QR from an image / take a photo")}
          </button>
          <input
            ref={qrFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleQrImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {/* V-86: a denied camera must point at the working fallback instead
              of leaving "Start camera" as a dead button (user screenshot). */}
          {cameraError && (
            <p className="mt-1.5 max-w-[340px] text-center text-[9px] font-semibold leading-relaxed text-amber-300">
              {S("ক্যামেরা পাওয়া যায়নি — উপরের QR ছবির অপশনটি ব্যবহার করুন।", "Camera unavailable — use the QR photo option instead.")}
            </p>
          )}
          {qrImageError && (
            <p className="mt-1 text-[9px] font-semibold text-amber-300">{qrImageError}</p>
          )}

          <div className="mt-2 flex w-full max-w-[340px] items-center gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => {
                setManualCode(e.target.value);
                if (peerInputError) setPeerInputError("");
              }}
              placeholder="10.0.0.5:52137/123456 or 123456"
              className="min-w-0 flex-1 rounded-[11px] border border-[var(--border-soft)] bg-[var(--glass-input)] px-3 py-1.5 font-mono text-[10px] text-main outline-none placeholder:text-faint"
            />
            <button
              type="button"
              onClick={handleManualConnect}
              className="primary-button h-[33px] rounded-[11px] px-3 text-[9.5px] font-semibold"
            >
              Connect
            </button>
          </div>

          {peerInputError && (
            <p role="alert" className="mt-1.5 w-full max-w-[340px] text-[9px] font-semibold leading-relaxed text-amber-300">
              {peerInputError}
            </p>
          )}
          <p className="mt-2 text-[8px] leading-relaxed text-faint">
            {connectedPeer ? `Selected: ${connectedPeer}` : "No peer selected yet."}
            {peerPin ? ` · pairing PIN ${peerPin}` : " · scan the host QR to pick up its PIN"}
          </p>
        </div>
      )}

      {/* V-88: on a 390px phone this duplicate footnote pushed the Host tab
          39px past the scrollport, so it was drawn half-cut behind the fixed
          footer. The modal subtitle ("Zero servers. Encrypted peer-to-peer
          sync…") and the desktop footer hint ("PAKE + Channel Binding ·
          XChaCha20-Poly1305") already carry the same information. Keep the
          note on desktop, drop it on phones so nothing is clipped. */}
      <div className="mt-3 hidden items-center justify-center gap-1.5 text-[8px] text-faint sm:flex">
        <Devices size={12} weight="duotone" />
        Zero-knowledge local connection · Authenticated key exchange with channel binding
      </div>
    </Modal>
  );
}

// ————————————————————————————————— Emergency kit —————————————————————————————————
export function EmergencyKitModal({
  onClose,
  onNotify,
  lang = "en",
}: {
  onClose: () => void;
  onNotify: Notify;
  lang?: Language;
}) {
  /*
   * V-65: a hardcoded document ID meant every kit ever printed carried the
   * same identifier. Each generated kit now gets its own CSPRNG id, so a
   * physical copy can be uniquely identified and revoked.
   */
  const documentId = useMemo(() => {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    return `VZ-EK-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${suffix}`;
  }, []);

  // V-71: the printable kit is a user-facing document. It follows the app's
  // language switch (English mode stays English — no regression), so the
  // Bengali UI produces a Bengali physical recovery sheet too.
  const S = (bn: string, en: string) => (lang === "bn" ? bn : en);

  const savePdf = () => {
    const html = `<!doctype html><html lang="${S("bn", "en")}"><head><title>${S("ভল্টজিরো ইমার্জেন্সি কিট", "VaultZero Emergency Kit")}</title><style>
      @page { margin: 24mm; }
      * { box-sizing: border-box; }
      body { font-family: ${S('"Hind Siliguri", "Noto Sans Bengali", Arial, sans-serif', '"Helvetica Neue", Arial, sans-serif')}; color: #1c2230; margin: 0; background: #fbf8f0; }
      .sheet { max-width: 720px; margin: 0 auto; padding: 34px 36px; }
      .top { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #171a2b; padding-bottom: 16px; }
      .brand { font-size: 22px; letter-spacing: -1px; font-weight: 700; }
      .brand span { color: #6457ee; }
      .seal { border: 1px solid #a9a08e; border-radius: 6px; padding: 7px 10px; font-size: 9px; letter-spacing: 1.6px; color: #7e7462; }
      .kicker { margin-top: 28px; font-size: 9px; font-weight: 700; letter-spacing: 3px; color: #7e7462; }
      h1 { font-size: 31px; letter-spacing: -1px; margin: 8px 0 6px; }
      .sub { font-size: 12px; line-height: 1.8; color: #665f54; max-width: 520px; }
      .rule { height: 1px; background: #d8d0c0; margin: 22px 0; }
      .box { border: 1px solid #c7bfac; background: #fffdf7; border-radius: 8px; padding: 14px; margin-bottom: 14px; }
      .box label { display: block; font-size: 10px; font-weight: 700; letter-spacing: 1.6px; color: #756b58; margin-bottom: 11px; }
      .lines { height: 36px; border-bottom: 1px solid #b8ae9b; }
      .lines.tall { height: 69px; }
      .hint { font-size: 9px; color: #8d8475; margin-top: 8px; }
      .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .codes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .code { height: 27px; border: 1px dashed #b8ae9b; border-radius: 4px; display: flex; align-items: center; padding-left: 8px; font-family: monospace; font-size: 8px; color: #a59b88; }
      .note { border-left: 3px solid #6457ee; padding: 2px 0 2px 11px; font-size: 10px; line-height: 1.8; color: #5d564b; }
      .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #d8d0c0; display: flex; justify-content: space-between; font-size: 8px; letter-spacing: .6px; color: #8d8475; }
      .stamp { color: #6457ee; font-weight: 700; }
      @media print { body { background: white; } .sheet { padding: 0; } }
    </style></head><body><div class="sheet">
      <div class="top"><div class="brand">Vault<span>Zero</span></div><div class="seal">${S("জরুরি প্রবেশ · গোপনীয়", "Emergency access · confidential")}</div></div>
      <div class="kicker">${S("অফলাইন রিকভারি ডকুমেন্ট", "Offline recovery document")}</div>
      <h1>${S("জরুরি প্রবেশ কিট", "Emergency access kit")}</h1>
      <p class="sub">${S("এই ডকুমেন্টটি কোনো নিরাপদ ভৌত স্থানে রাখুন। VaultZero জিরো-নলেজ: আপনার মাস্টার পাসওয়ার্ড অন্য কেউ রিসেট বা উদ্ধার করতে পারে না।", "Store this document somewhere physically secure. VaultZero is zero-knowledge: your master password cannot be reset or recovered by anyone else.")}</p>
      <div class="rule"></div>
      <div class="box"><label>${S("মাস্টার পাসওয়ার্ড", "Master password")}</label><div class="lines tall"></div><p class="hint">${S("হাতে লিখুন। এই ডকুমেন্টের ছবি তুলবেন না বা ডিজিটালি সংরক্ষণ করবেন না।", "Write by hand. Never photograph or store this document digitally.")}</p></div>
      <div class="two">
        <div class="box"><label>${S("পাসওয়ার্ড ইঙ্গিত", "Password hint")}</label><div class="lines"></div></div>
        <div class="box"><label>${S("ভল্ট তৈরির তারিখ", "Vault created")}</label><div class="lines"></div></div>
      </div>
      <div class="two">
        <div class="box"><label>${S("জরুরি যোগাযোগের নাম", "Emergency contact name")}</label><div class="lines"></div></div>
        <div class="box"><label>${S("ফোন / সম্পর্ক", "Phone / relationship")}</label><div class="lines"></div></div>
      </div>
      <div class="box"><label>${S("রিকভারি কী", "Recovery key")}</label><div class="codes"><div class="code">— — — —</div><div class="code">— — — —</div><div class="code">— — — —</div><div class="code">— — — —</div></div><p class="hint">${S("VaultZero → ইমার্জেন্সি কিট থেকে চারটি অংশই হাতে লিখুন।", "Handwrite all four groups from VaultZero → Emergency Kit.")}</p></div>
      <div class="note">${S("অনুমোদিত ব্যক্তিকে এমন ডিভাইসে VaultZero চালু করতে হবে যেখানে লোকাল ভল্ট ফাইল (local-vault.pmv) আছে; লক স্ক্রিনে \"Forgot master password? Recover vault\" বেছে নিয়ে অফলাইনে উপরের হাতে-লেখা ২৪-অক্ষরের রিকভারি কীটি দিতে হবে।", "The authorized person should launch VaultZero from a device that already holds the local vault file (local-vault.pmv), choose \"Forgot master password? Recover vault\" on the lock screen, and enter the handwritten 24-character recovery key above while offline.")}</div>
      <div class="footer"><span>${S("ডকুমেন্ট আইডি", "DOCUMENT ID")} · ${documentId}</span><span class="stamp">${S("ভল্টজিরো · শুধু লোকাল", "VAULTZERO · LOCAL ONLY")}</span><span>${S("পাতা ১ / ১", "PAGE 1 / 1")}</span></div>
    </div></body></html>`;

    const win = window.open("", "_blank", "width=900,height=1000");
    if (win) {
      win.document.write(html);
      win.document.close();
      window.setTimeout(() => { win.focus(); win.print(); }, 450);
    } else {
      // V-65: WebView2 and hardened browsers often block pop-ups. Printing
      // through an in-document frame keeps the whole flow inside the single
      // native window instead of failing with "Allow pop-ups".
      const frame = document.createElement("iframe");
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;height:1000px;border:0;";
      document.body.appendChild(frame);
      const frameDoc = frame.contentWindow?.document;
      if (!frameDoc) {
        frame.remove();
        onNotify(S("ইমার্জেন্সি কিট সংরক্ষণে পপ-আপ অনুমতি দিন", "Allow pop-ups to save your emergency kit"));
        return;
      }
      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();
      window.setTimeout(() => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        window.setTimeout(() => frame.remove(), 1000);
      }, 450);
    }
    onNotify(S("ইমার্জেন্সি কিট প্রস্তুত — PDF হিসেবে সংরক্ষণ করুন", "Emergency kit prepared — save as PDF"));
  };

  return (
    <Modal
      onClose={onClose}
      title={S("ইমার্জেন্সি কিট", "Emergency kit")}
      subtitle={S("ডিজিটাল ভল্টের একটি ভৌত নিরাপত্তা-রশি। হাতে পূরণ করে নিরাপদ স্থানে রাখুন।", "A physical lifeline for a digital vault. Fill it in by hand and keep it safe.")}
      icon={<FirstAidKit size={20} weight="duotone" />}
      width="max-w-[720px]"
      className="max-h-[94dvh]"
      bodyClassName="pb-4"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="hidden min-w-0 items-center gap-1.5 text-[8.5px] leading-tight text-faint md:flex">
            <ShieldCheck size={12} weight="duotone" className="shrink-0 text-success" />
            {S("PDF কেবল লোকালে সংরক্ষিত। অনলাইনে কিছু পাঠানো হয় না।", "PDF saved locally. Nothing sent online.")}
          </span>
          <div className="flex w-full items-center justify-end gap-2.5 sm:w-auto">
            <button onClick={savePdf} className="secondary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[11px] font-semibold"><Printer size={14} weight="duotone" /> {S("প্রিন্ট", "Print")}</button>
            <button onClick={savePdf} className="primary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-[11px] font-semibold shadow-md shadow-[var(--accent-glow)]"><FilePdf size={14} weight="bold" /> {S("PDF হিসেবে সংরক্ষণ", "Save as PDF")}</button>
          </div>
        </div>
      }
    >
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <span className="flex items-center gap-1.5 text-[8px] font-medium text-faint"><FilePdf size={11} weight="duotone" /> {S("প্রিভিউ · A4 খাড়া", "Preview · A4 portrait")}</span>
        <span className="flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--glass-soft)] px-2 py-1 text-[7px] text-muted"><LockSimple size={8} weight="duotone" /> {S("হাতে লিখুন", "Fill by hand")}</span>
      </div>
      <div className="overflow-hidden rounded-[10px] shadow-[0_24px_50px_rgba(20,15,35,.24)]">
        <div id="emergency-kit" className={cn("relative overflow-hidden p-5 sm:p-7", lang === "bn" && "font-bangla")} style={{ background: "#fbf8f0", color: "#1c2230" }}>
          <div aria-hidden className="pointer-events-none absolute right-[-28px] top-[38%] -rotate-12 text-[62px] font-bold tracking-[8px] opacity-[0.035]" style={{ color: "#171a2b" }}>VAULTZERO</div>
          <div className="relative flex items-start justify-between gap-3 border-b-2 pb-3" style={{ borderColor: "#171a2b" }}>
            <div>
              <p className="font-display text-[20px] font-bold leading-none tracking-[-0.06em]">Vault<span style={{ color: "#6457ee" }}>Zero</span></p>
              <p className="mt-1 text-[7px] font-semibold tracking-[0.12em]" style={{ color: "#8d8475" }}>{S("ব্যক্তিগত · অফলাইন · সিল করা", "Private · offline · sealed")}</p>
            </div>
            <div className="rounded-[5px] border px-2 py-1.5 text-right" style={{ borderColor: "#b9b09d" }}>
              <p className="text-[6.5px] font-bold tracking-[0.08em]" style={{ color: "#8d8475" }}>{S("জরুরি প্রবেশ", "Emergency access")}</p>
              <p className="mt-0.5 text-[6.5px] font-bold" style={{ color: "#6457ee" }}>{S("গোপনীয়", "CONFIDENTIAL")}</p>
            </div>
          </div>
          <p className="relative mt-4 text-[7px] font-bold tracking-[0.12em]" style={{ color: "#8d8475" }}>{S("অফলাইন রিকভারি ডকুমেন্ট", "Offline recovery document")}</p>
          <h3 className="relative mt-1 font-display text-[24px] font-semibold leading-none tracking-[-0.035em]">{S("জরুরি প্রবেশ কিট", "Emergency access kit")}</h3>
          <p className="relative mt-2 max-w-[470px] text-[8px] leading-relaxed" style={{ color: "#6b6458" }}>{S("এই ডকুমেন্টটি কোনো নিরাপদ ভৌত স্থানে রাখুন। VaultZero জিরো-নলেজ: আপনার মাস্টার পাসওয়ার্ড অন্য কেউ রিসেট বা উদ্ধার করতে পারে না।", "Store this document somewhere physically secure. VaultZero is zero-knowledge: your master password cannot be reset or recovered by anyone else.")}</p>
          <div className="relative my-3.5 h-px" style={{ background: "#d8d0c0" }} />
          <div className="relative mb-2.5 rounded-md border p-2.5" style={{ borderColor: "#c7bfac", background: "#fffdf7" }}>
            <label className="block text-[7px] font-bold tracking-[0.1em]" style={{ color: "#756b58" }}>{S("মাস্টার পাসওয়ার্ড", "Master password")}</label>
            <div className="mt-5 h-4 border-b" style={{ borderColor: "#b8ae9b" }} />
            <div className="mt-3 h-4 border-b" style={{ borderColor: "#b8ae9b" }} />
            <p className="mt-2 text-[7px]" style={{ color: "#8d8475" }}>{S("হাতে লিখুন। এই ডকুমেন্টের ছবি তুলবেন না বা ডিজিটালি সংরক্ষণ করবেন না।", "Write by hand. Never photograph or store this document digitally.")}</p>
          </div>
          <div className="relative grid grid-cols-2 gap-2">
            <div className="rounded-md border p-2.5" style={{ borderColor: "#c7bfac", background: "#fffdf7" }}>
              <label className="block text-[7px] font-bold tracking-[0.1em]" style={{ color: "#756b58" }}>{S("পাসওয়ার্ড ইঙ্গিত", "Password hint")}</label>
              <div className="mt-5 h-4 border-b" style={{ borderColor: "#b8ae9b" }} />
            </div>
            <div className="rounded-md border p-2.5" style={{ borderColor: "#c7bfac", background: "#fffdf7" }}>
              <label className="block text-[7px] font-bold tracking-[0.1em]" style={{ color: "#756b58" }}>{S("ভল্ট তৈরির তারিখ", "Vault created")}</label>
              <div className="mt-5 h-4 border-b" style={{ borderColor: "#b8ae9b" }} />
            </div>
          </div>
          <div className="relative mt-2 rounded-md border p-2.5" style={{ borderColor: "#c7bfac", background: "#fffdf7" }}>
            <label className="block text-[7px] font-bold tracking-[0.1em]" style={{ color: "#756b58" }}>{S("রিকভারি কী · চারটি অংশ", "Recovery key · four groups")}</label>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((n) => <div key={n} className="h-5 rounded-[3px] border border-dashed" style={{ borderColor: "#b8ae9b" }} />)}
            </div>
          </div>
          <div className="relative mt-2 rounded-md border p-2.5" style={{ borderColor: "#c7bfac", background: "#fffdf7" }}>
            <label className="block text-[7px] font-bold tracking-[0.1em]" style={{ color: "#756b58" }}>{S("জরুরি যোগাযোগ · নাম ও ফোন", "Emergency contact · name and phone")}</label>
            <div className="mt-5 h-4 border-b" style={{ borderColor: "#b8ae9b" }} />
          </div>
          <div className="relative mt-2.5 border-l-2 pl-2.5" style={{ borderColor: "#6457ee" }}>
            <p className="text-[7px] leading-relaxed" style={{ color: "#5d564b" }}>{S("অনুমোদিত ব্যক্তিকে এমন ডিভাইসে VaultZero চালু করতে হবে যেখানে লোকাল ভল্ট ফাইল (local-vault.pmv) আছে; লক স্ক্রিনে \"Forgot master password? Recover vault\" বেছে নিয়ে অফলাইনে হাতে-লেখা ২৪-অক্ষরের রিকভারি কীটি দিতে হবে।", "The authorized person should open VaultZero on a device holding the local vault file (local-vault.pmv), choose \"Forgot master password? Recover vault\" on the lock screen, and enter the handwritten 24-character recovery key while offline.")}</p>
          </div>
          <div className="relative mt-3.5 flex items-center justify-between border-t pt-2 text-[7px] tracking-[0.05em]" style={{ borderColor: "#d8d0c0", color: "#8d8475" }}>
            <span>{S("ডকুমেন্ট আইডি", "DOCUMENT ID")} · {documentId}</span>
            <span className="font-bold" style={{ color: "#6457ee" }}>{S("ভল্টজিরো · শুধু লোকাল", "VAULTZERO · LOCAL ONLY")}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[7.5px] text-faint"><Clock size={10} weight="duotone" /> {S("এইমাত্র তৈরি · ১ পাতা", "Generated just now · 1 page")}</p>
        <button onClick={onClose} className="text-[8px] font-semibold text-muted underline decoration-[var(--border)] underline-offset-2 hover:text-main">{S("প্রিভিউ বন্ধ করুন", "Close preview")}</button>
      </div>
    </Modal>
  );
}
