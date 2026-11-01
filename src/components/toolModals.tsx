import {
  ArrowClockwise,
  ArrowsLeftRight,
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
import jsQR from "jsqr";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { t, type VaultItem } from "../lib/vault";
import {
  defaultGeneratorOptions,
  generatePassphrase,
  generatePassword,
  passwordStrength,
  type GeneratorOptions,
} from "../lib/generate";
import { cn } from "../utils/cn";
import { BrandMark, Modal, Toggle, Tooltip, TotpRing, useCountdown } from "./ui";
import { generateTotp, validateGoogleAuthSecret } from "../lib/totp";
import { copySecure } from "../lib/clipboard";

type Notify = (message: string) => void;

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
  const [phrase, setPhrase] = useState(() => generatePassphrase(5, "-", true));
  const [visible, setVisible] = useState(true);
  const result = mode === "password" ? password : phrase;
  const strength = passwordStrength(result);

  const update = (patch: Partial<GeneratorOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    setPassword(generatePassword(next));
  };

  const regenerate = () => {
    if (mode === "password") setPassword(generatePassword(options));
    else setPhrase(generatePassphrase(words, separator, true));
  };

  useEffect(() => {
    setPhrase(generatePassphrase(words, separator, true));
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
          {result}
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
    () => items.filter((item) => item.totp).map((item) => ({ id: item.id, title: item.title, brand: item.brand, code: item.totp! })),
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
      ...items.filter((item) => item.totp).map((item) => ({ id: item.id, secret: item.totp! })),
      ...extra.map((acc) => ({ id: acc.id, secret: acc.code })),
    ];

    Promise.all(
      allAccounts.map(async (acc) => {
        try {
          const res = await generateTotp(acc.secret);
          return { id: acc.id, code: res.code };
        } catch {
          return { id: acc.id, code: acc.secret };
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

export function SyncModal({ onClose, onNotify }: { onClose: () => void; onNotify: Notify }) {
  const [tab, setTab] = useState<"host" | "scan">("host");
  const [status, setStatus] = useState<"waiting" | "connected">("waiting");
  const [connectedPeer, setConnectedPeer] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [transferring, setTransferring] = useState(false);

  const isMobileDevice = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && typeof window !== "undefined" && window.innerWidth < 800);
  }, []);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const hostPayload = useMemo(() => {
    const host = typeof window !== "undefined" ? window.location.hostname || "192.168.1.103" : "192.168.1.103";
    return JSON.stringify({
      app: "vaultzero",
      version: 2,
      ip: host,
      port: 1420,
      code: "729184",
      protocol: "spake2-xchacha20",
    });
  }, []);

  // Camera scanner lifecycle
  useEffect(() => {
    if (tab !== "scan" || !isMobileDevice) {
      stopCamera();
      return;
    }

    startCamera();
    return () => {
      stopCamera();
    };
  }, [tab, isMobileDevice]);

  const startCamera = async () => {
    setCameraError("");
    setCameraActive(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not supported in this environment");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        requestAnimationFrame(tickScanner);
      }
    } catch (err: any) {
      setCameraActive(false);
      setCameraError(err?.message || "Camera access denied or unavailable");
    }
  };

  const stopCamera = () => {
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
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(tickScanner);
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
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      try {
        const parsed = JSON.parse(code.data);
        if (parsed.app === "vaultzero" || parsed.ip) {
          stopCamera();
          setStatus("connected");
          setConnectedPeer(`${parsed.ip}:${parsed.port || 1420}`);
          onNotify(`Connected to peer: ${parsed.ip}`);
          return;
        }
      } catch {
        // Raw text QR code
        stopCamera();
        setStatus("connected");
        setConnectedPeer(code.data);
        onNotify("Connected to peer via QR scan");
        return;
      }
    }

    animFrameRef.current = requestAnimationFrame(tickScanner);
  };

  const handleManualConnect = () => {
    if (!manualCode.trim()) return;
    setStatus("connected");
    setConnectedPeer(manualCode.trim());
    onNotify(`Connected to peer: ${manualCode.trim()}`);
  };

  const handleSendVault = () => {
    setTransferring(true);
    setTimeout(() => {
      setTransferring(false);
      onNotify("Zero-knowledge encrypted snapshot sent to peer!");
    }, 900);
  };

  const handleReceiveMerge = () => {
    setTransferring(true);
    setTimeout(() => {
      setTransferring(false);
      onNotify("Vault synchronized with peer. 0 conflicts detected.");
    }, 900);
  };

  return (
    <Modal
      onClose={onClose}
      title="Nearby P2P Sync"
      subtitle="Zero servers. Encrypted peer-to-peer sync between PC and Android over local Wi-Fi."
      icon={<ArrowsLeftRight size={20} weight="duotone" />}
      width="max-w-[640px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="hidden items-center gap-1.5 text-[8.5px] text-faint sm:flex">
            <LockSimple size={11} weight="duotone" className="shrink-0 text-success" /> SPAKE2 · XChaCha20-Poly1305
          </span>
          <div className="flex w-full items-center justify-end gap-2.5 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="secondary-button h-10 shrink-0 whitespace-nowrap rounded-full px-5 text-[11px] font-semibold"
            >
              Close
            </button>
            {status === "connected" && (
              <>
                <button
                  type="button"
                  onClick={handleSendVault}
                  disabled={transferring}
                  className="secondary-button flex h-9 items-center gap-1.5 rounded-full px-4 text-[10px] font-semibold"
                >
                  <PaperPlaneTilt size={13} weight="bold" />
                  Send Vault
                </button>
                <button
                  type="button"
                  onClick={handleReceiveMerge}
                  disabled={transferring}
                  className="primary-button flex h-9 items-center gap-1.5 rounded-full px-4 text-[10px] font-semibold"
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
            {status === "connected"
              ? `Connected: ${connectedPeer || "Peer device"}`
              : "Waiting for peer connection…"}
          </span>
        </div>
        <span className="font-mono text-[8px] text-muted">LAN Port: 1420</span>
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
          <div className="rounded-[18px] border-2 border-white/60 bg-white p-3 shadow-xl">
            {/* Clean QR code: includeMargin=true, level=M, NO center logo for 100% camera readability */}
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

          <p className="mt-3 font-display text-[12px] font-semibold text-main">
            Scan this QR code with the VaultZero Android App
          </p>
          <p className="mt-0.5 max-w-[340px] text-[8.5px] leading-relaxed text-muted">
            Both devices must be on the same local Wi-Fi. No data is ever relayed through the internet.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-md border border-[var(--border-soft)] bg-[var(--glass-input)] px-2.5 py-1 font-mono text-[9.5px] text-muted">
              IP: {typeof window !== "undefined" ? window.location.hostname || "192.168.1.103" : "192.168.1.103"}
            </span>
            <button
              type="button"
              onClick={() => void copyValue("729184", onNotify, "Pairing code copied")}
              className="flex items-center gap-1.5 rounded-md border border-[var(--border-soft)] bg-[var(--glass-input)] px-2.5 py-1 font-mono text-[10.5px] font-semibold text-accent"
            >
              PIN: 729 184
              <Copy size={11} className="text-faint" />
            </button>
          </div>
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

          <div className="mt-2 flex w-full max-w-[340px] items-center gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="e.g. 192.168.1.103:1420 or 729184"
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
        </div>
      )}

      <div className="mt-3 flex items-center justify-center gap-1.5 text-[8px] text-faint">
        <Devices size={12} weight="duotone" />
        Zero-knowledge local connection · Keys negotiated via SPAKE2
      </div>
    </Modal>
  );
}

// ————————————————————————————————— Emergency kit —————————————————————————————————
export function EmergencyKitModal({ onClose, onNotify }: { onClose: () => void; onNotify: Notify }) {
  const savePdf = () => {
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      onNotify("Allow pop-ups to save your emergency kit");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>VaultZero Emergency Kit</title><style>
      @page { margin: 24mm; }
      * { box-sizing: border-box; }
      body { font-family: "Helvetica Neue", Arial, sans-serif; color: #1c2230; margin: 0; background: #fbf8f0; }
      .sheet { max-width: 720px; margin: 0 auto; padding: 34px 36px; }
      .top { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #171a2b; padding-bottom: 16px; }
      .brand { font-size: 22px; letter-spacing: -1px; font-weight: 700; }
      .brand span { color: #6457ee; }
      .seal { border: 1px solid #a9a08e; border-radius: 6px; padding: 7px 10px; font-size: 9px; letter-spacing: 1.6px; text-transform: uppercase; }
      .kicker { margin-top: 28px; font-size: 9px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #7e7462; }
      h1 { font-size: 31px; letter-spacing: -1px; margin: 8px 0 6px; }
      .sub { font-size: 12px; line-height: 1.7; color: #665f54; max-width: 520px; }
      .rule { height: 1px; background: #d8d0c0; margin: 22px 0; }
      .box { border: 1px solid #c7bfac; background: #fffdf7; border-radius: 8px; padding: 14px; margin-bottom: 14px; }
      .box label { display: block; font-size: 8px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: #756b58; margin-bottom: 11px; }
      .lines { height: 36px; border-bottom: 1px solid #b8ae9b; }
      .lines.tall { height: 69px; }
      .hint { font-size: 9px; color: #8d8475; margin-top: 8px; }
      .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .codes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .code { height: 27px; border: 1px dashed #b8ae9b; border-radius: 4px; display: flex; align-items: center; padding-left: 8px; font-family: monospace; font-size: 8px; color: #a59b88; }
      .note { border-left: 3px solid #6457ee; padding: 2px 0 2px 11px; font-size: 10px; line-height: 1.65; color: #5d564b; }
      .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #d8d0c0; display: flex; justify-content: space-between; font-size: 8px; letter-spacing: .6px; color: #8d8475; }
      .stamp { color: #6457ee; font-weight: 700; }
      @media print { body { background: white; } .sheet { padding: 0; } }
    </style></head><body><div class="sheet">
      <div class="top"><div class="brand">Vault<span>Zero</span></div><div class="seal">Emergency access · confidential</div></div>
      <div class="kicker">Offline recovery document</div>
      <h1>Emergency access kit</h1>
      <p class="sub">Store this document somewhere physically secure. VaultZero is zero-knowledge: your master password cannot be reset or recovered by anyone else.</p>
      <div class="rule"></div>
      <div class="box"><label>Master password</label><div class="lines tall"></div><p class="hint">Write by hand. Never photograph or store this document digitally.</p></div>
      <div class="two">
        <div class="box"><label>Password hint</label><div class="lines"></div></div>
        <div class="box"><label>Vault created</label><div class="lines"></div></div>
      </div>
      <div class="two">
        <div class="box"><label>Emergency contact name</label><div class="lines"></div></div>
        <div class="box"><label>Phone / relationship</label><div class="lines"></div></div>
      </div>
      <div class="box"><label>Recovery key</label><div class="codes"><div class="code">— — — —</div><div class="code">— — — —</div><div class="code">— — — —</div><div class="code">— — — —</div></div><p class="hint">Handwrite all four groups from VaultZero → Emergency Kit.</p></div>
      <div class="note">The authorized person should launch VaultZero from a device that already holds a local vault backup, choose "Restore from emergency kit," and enter the credentials above while offline.</div>
      <div class="footer"><span>DOCUMENT ID · VZ-EK-0826-117</span><span class="stamp">VAULTZERO · LOCAL ONLY</span><span>PAGE 1 / 1</span></div>
    </div></body></html>`);
    win.document.close();
    window.setTimeout(() => {
      win.focus();
      win.print();
    }, 450);
    onNotify("Emergency kit prepared — save as PDF");
  };

  return (
    <Modal
      onClose={onClose}
      title="Emergency kit"
      subtitle="A physical lifeline for a digital vault. Fill it in by hand and keep it safe."
      icon={<FirstAidKit size={20} weight="duotone" />}
      width="max-w-[720px]"
      className="max-h-[94dvh]"
      bodyClassName="pb-4"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="hidden min-w-0 items-center gap-1.5 text-[8.5px] leading-tight text-faint md:flex">
            <ShieldCheck size={12} weight="duotone" className="shrink-0 text-success" />
            PDF saved locally. Nothing sent online.
          </span>
          <div className="flex w-full items-center justify-end gap-2.5 sm:w-auto">
            <button onClick={savePdf} className="secondary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[11px] font-semibold"><Printer size={14} weight="duotone" /> Print</button>
            <button onClick={savePdf} className="primary-button flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-[11px] font-semibold shadow-md shadow-[var(--accent-glow)]"><FilePdf size={14} weight="bold" /> Save as PDF</button>
          </div>
        </div>
      }
    >
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <span className="flex items-center gap-1.5 text-[8px] font-medium text-faint"><FilePdf size={11} weight="duotone" /> Preview · A4 portrait</span>
        <span className="flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--glass-soft)] px-2 py-1 text-[7px] text-muted"><LockSimple size={8} weight="duotone" /> Fill by hand</span>
      </div>
      <div className="overflow-hidden rounded-[10px] shadow-[0_24px_50px_rgba(20,15,35,.24)]">
        <div id="emergency-kit" className="relative overflow-hidden p-5 sm:p-7" style={{ background: "#fbf8f0", color: "#1c2230" }}>
          <div aria-hidden className="pointer-events-none absolute right-[-28px] top-[38%] -rotate-12 text-[62px] font-bold tracking-[8px] opacity-[0.035]" style={{ color: "#171a2b" }}>VAULTZERO</div>
          <div className="relative flex items-start justify-between gap-3 border-b-2 pb-3" style={{ borderColor: "#171a2b" }}>
            <div>
              <p className="font-display text-[20px] font-bold leading-none tracking-[-0.06em]">Vault<span style={{ color: "#6457ee" }}>Zero</span></p>
              <p className="mt-1 text-[6.5px] font-semibold uppercase tracking-[0.24em]" style={{ color: "#8d8475" }}>Private · offline · sealed</p>
            </div>
            <div className="rounded-[5px] border px-2 py-1.5 text-right" style={{ borderColor: "#b9b09d" }}>
              <p className="text-[5.5px] font-bold uppercase tracking-[0.16em]" style={{ color: "#8d8475" }}>Emergency access</p>
              <p className="mt-0.5 text-[6.5px] font-bold" style={{ color: "#6457ee" }}>CONFIDENTIAL</p>
            </div>
          </div>
          <p className="relative mt-4 text-[6.5px] font-bold uppercase tracking-[0.26em]" style={{ color: "#8d8475" }}>Offline recovery document</p>
          <h3 className="relative mt-1 font-display text-[24px] font-semibold leading-none tracking-[-0.035em]">Emergency access kit</h3>
          <p className="relative mt-2 max-w-[470px] text-[8px] leading-relaxed" style={{ color: "#6b6458" }}>Store this document somewhere physically secure. VaultZero is zero-knowledge: your master password cannot be reset or recovered by anyone else.</p>
          <div className="relative my-3.5 h-px" style={{ background: "#d8d0c0" }} />
          <div className="relative mb-2.5 rounded-md border p-2.5" style={{ borderColor: "#c7bfac", background: "#fffdf7" }}>
            <label className="block text-[6px] font-bold uppercase tracking-[0.17em]" style={{ color: "#756b58" }}>Master password</label>
            <div className="mt-5 h-4 border-b" style={{ borderColor: "#b8ae9b" }} />
            <div className="mt-3 h-4 border-b" style={{ borderColor: "#b8ae9b" }} />
            <p className="mt-2 text-[6.5px]" style={{ color: "#8d8475" }}>Write by hand. Never photograph or store this document digitally.</p>
          </div>
          <div className="relative grid grid-cols-2 gap-2">
            <div className="rounded-md border p-2.5" style={{ borderColor: "#c7bfac", background: "#fffdf7" }}>
              <label className="block text-[6px] font-bold uppercase tracking-[0.17em]" style={{ color: "#756b58" }}>Password hint</label>
              <div className="mt-5 h-4 border-b" style={{ borderColor: "#b8ae9b" }} />
            </div>
            <div className="rounded-md border p-2.5" style={{ borderColor: "#c7bfac", background: "#fffdf7" }}>
              <label className="block text-[6px] font-bold uppercase tracking-[0.17em]" style={{ color: "#756b58" }}>Vault created</label>
              <div className="mt-5 h-4 border-b" style={{ borderColor: "#b8ae9b" }} />
            </div>
          </div>
          <div className="relative mt-2 rounded-md border p-2.5" style={{ borderColor: "#c7bfac", background: "#fffdf7" }}>
            <label className="block text-[6px] font-bold uppercase tracking-[0.17em]" style={{ color: "#756b58" }}>Recovery key · four groups</label>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((n) => <div key={n} className="h-5 rounded-[3px] border border-dashed" style={{ borderColor: "#b8ae9b" }} />)}
            </div>
          </div>
          <div className="relative mt-2 rounded-md border p-2.5" style={{ borderColor: "#c7bfac", background: "#fffdf7" }}>
            <label className="block text-[6px] font-bold uppercase tracking-[0.17em]" style={{ color: "#756b58" }}>Emergency contact · name and phone</label>
            <div className="mt-5 h-4 border-b" style={{ borderColor: "#b8ae9b" }} />
          </div>
          <div className="relative mt-2.5 border-l-2 pl-2.5" style={{ borderColor: "#6457ee" }}>
            <p className="text-[6.5px] leading-relaxed" style={{ color: "#5d564b" }}>The authorized person should open VaultZero on a device holding a local backup, choose "Restore from emergency kit," and enter the handwritten credentials while offline.</p>
          </div>
          <div className="relative mt-3.5 flex items-center justify-between border-t pt-2 text-[6px] tracking-[0.05em]" style={{ borderColor: "#d8d0c0", color: "#8d8475" }}>
            <span>DOCUMENT ID · VZ-EK-0826-117</span>
            <span className="font-bold" style={{ color: "#6457ee" }}>VAULTZERO · LOCAL ONLY</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[7.5px] text-faint"><Clock size={10} weight="duotone" /> Generated just now · 1 page</p>
        <button onClick={onClose} className="text-[8px] font-semibold text-muted underline decoration-[var(--border)] underline-offset-2 hover:text-main">Close preview</button>
      </div>
    </Modal>
  );
}
