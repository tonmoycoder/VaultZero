import {
  ArrowClockwise,
  ArrowsLeftRight,
  Check,
  CheckCircle,
  CircleNotch,
  Clock,
  Copy,
  DeviceMobile,
  Devices,
  FilePdf,
  Fingerprint,
  FirstAidKit,
  HardDrive,
  Key,
  Laptop,
  LockSimple,
  Password,
  Printer,
  QrCode,
  ShieldCheck,
  Sparkle,
  WifiHigh,
} from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
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

type Notify = (message: string) => void;

async function copyValue(value: string, onNotify: Notify, message: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const el = document.createElement("textarea");
    el.value = value;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
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
            <LockSimple size={10} weight="duotone" />
            Never sent to a server
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="secondary-button h-9 rounded-full px-4 text-[10.5px] font-semibold">Done</button>
            <button
              onClick={() => void copyValue(result, onNotify, "Generated password copied")}
              className="primary-button flex h-9 items-center gap-1.5 rounded-full px-4 text-[10.5px] font-semibold"
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

  const addAccount = () => {
    if (!name.trim()) return;
    const code = `${Math.floor(100 + Math.random() * 899)} ${Math.floor(100 + Math.random() * 899)}`;
    setExtra((current) => [...current, { id: `new-${Date.now()}`, title: name.trim(), code, added: true }]);
    setName("");
    setSecret("");
    setAdding(false);
    onNotify("Authenticator account added locally");
  };

  return (
    <Modal
      onClose={onClose}
      title="Authenticator"
      subtitle="Time-based one-time passwords, updated every 30 seconds."
      icon={<Fingerprint size={20} weight="duotone" />}
      width="max-w-[520px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[8.5px] text-faint"><WifiHigh size={11} weight="duotone" /> {t("en", "synced")}</span>
          <button onClick={onOpenSync} className="secondary-button flex h-9 items-center gap-1.5 rounded-full px-4 text-[10px] font-semibold">
            <ArrowsLeftRight size={13} weight="duotone" /> Sync to phone
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
              <p className="mt-0.5 text-[7.5px] text-faint">ayaan@vaultzero.me</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[13px] font-semibold tracking-[0.08em] text-main">{account.code}</p>
              <p className="mt-0.5 text-[7px]" style={{ color: remaining <= 5 ? "var(--danger)" : "var(--success)" }}>{remaining}s remaining</p>
            </div>
            <TotpRing size={26} remaining={remaining} progress={progress} stroke={2.2} />
            <Tooltip label="Copy code">
              <button onClick={() => void copyValue(account.code.replace(/\s/g, ""), onNotify, "Authenticator code copied")} className="flex h-6 w-6 items-center justify-center rounded-full text-faint hover:bg-[var(--hover)] hover:text-main" aria-label="Copy authenticator code">
                <Copy size={12} />
              </button>
            </Tooltip>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="glass-soft mt-3 rounded-[15px] border border-[var(--border-soft)] p-3">
          <p className="mb-2 text-[9px] font-semibold text-soft">Add authenticator account</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" className="field" autoFocus />
            <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Setup key (optional)" className="field font-mono" />
          </div>
          <div className="mt-2 flex justify-end gap-1.5">
            <button onClick={() => setAdding(false)} className="secondary-button h-7 rounded-full px-3 text-[9px]">Cancel</button>
            <button onClick={addAccount} disabled={!name.trim()} className="primary-button h-7 rounded-full px-3 text-[9px] disabled:opacity-40">Add account</button>
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
  const [pairing, setPairing] = useState(false);
  const [paired, setPaired] = useState(false);
  const [code] = useState("729 184");
  const startPairing = () => {
    setPairing(true);
    setPaired(false);
    window.setTimeout(() => {
      setPairing(false);
      setPaired(true);
      onNotify("Secure local channel established");
    }, 1600);
  };

  return (
    <Modal
      onClose={onClose}
      title="Nearby sync"
      subtitle="Zero servers. End-to-end encrypted over your local network."
      icon={<ArrowsLeftRight size={20} weight="duotone" />}
      width="max-w-[680px]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="hidden items-center gap-1.5 text-[8px] text-faint sm:flex"><LockSimple size={9} weight="duotone" /> SPAKE2 · XChaCha20</span>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <button onClick={onClose} className="secondary-button h-9 rounded-full px-4 text-[10px] font-semibold">Cancel</button>
            <button onClick={startPairing} disabled={pairing} className="primary-button flex h-9 items-center gap-1.5 rounded-full px-4 text-[10px] font-semibold disabled:opacity-80">
              {pairing ? <CircleNotch size={13} className="animate-spin" /> : paired ? <Check size={13} weight="bold" /> : <QrCode size={13} weight="bold" />}
              {pairing ? "Pairing securely…" : paired ? "Device paired" : "Pair device"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex items-center justify-between gap-2 rounded-full border px-2.5 py-1.5" style={{ borderColor: "color-mix(in srgb, var(--success) 20%, transparent)", background: "var(--success-soft)" }}>
        <span className="flex items-center gap-1.5 text-[8.5px] font-semibold text-[var(--success)]"><span className="relative flex h-1.5 w-1.5"><span className="absolute h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-40" /><span className="relative h-1.5 w-1.5 rounded-full bg-[var(--success)]" /></span> Local LAN only</span>
        <span className="font-mono text-[7.5px] text-muted">192.168.1.42 · Wi-Fi</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_188px]">
        <div className="glass-soft flex flex-col items-center justify-center rounded-[18px] border border-[var(--border-soft)] p-4">
          <div className="relative rounded-[17px] border border-white/50 bg-white p-2.5 shadow-[0_12px_28px_rgba(20,15,50,.13)]">
            <QRCodeSVG
              value={`vaultzero://sync?code=${code.replace(" ", "")}&key=local-lan-spake2`}
              size={154}
              bgColor="#ffffff"
              fgColor="#17152b"
              level="H"
              imageSettings={{ src: "/vaultzero-logo.png", height: 25, width: 25, excavate: true }}
              title="Scan to pair with VaultZero"
            />
            <span className="absolute -left-1 -top-1 h-3 w-3 rounded-tl-sm border-l-2 border-t-2 border-[var(--accent)]" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-tr-sm border-r-2 border-t-2 border-[var(--accent)]" />
            <span className="absolute -bottom-1 -left-1 h-3 w-3 rounded-bl-sm border-b-2 border-l-2 border-[var(--accent)]" />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-br-sm border-b-2 border-r-2 border-[var(--accent)]" />
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[8.5px] font-semibold text-main"><DeviceMobile size={12} weight="duotone" /> Scan with the VaultZero app</p>
          <p className="mt-1 text-center text-[7.5px] leading-relaxed text-faint">Open VaultZero on your phone → Sync → Scan code.</p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[7px] font-bold uppercase tracking-[0.1em] text-faint">Pairing code</span>
            <button onClick={() => void copyValue(code.replace(" ", ""), onNotify, "Pairing code copied")} className="flex items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--glass-input)] px-2 py-1 font-mono text-[11px] font-semibold tracking-[0.11em] text-main">
              {code}<Copy size={9} className="text-faint" />
            </button>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[8px] font-bold uppercase tracking-[0.11em] text-faint">Nearby LAN devices</span>
            <span className="flex items-center gap-1 text-[7px] text-[var(--success)]"><WifiHigh size={9} weight="bold" /> 2</span>
          </div>
          <div className="space-y-1.5">
            <div className="glass-soft flex items-center gap-2 rounded-[13px] border border-[var(--border-soft)] p-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--glass-strong)] text-muted"><Laptop size={16} weight="duotone" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-[9px] font-semibold text-main">Ayaan's MacBook Pro</p><p className="mt-0.5 text-[7px] text-faint">This device</p></div>
              <span className="flex h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            </div>
            <div className="glass-soft flex items-center gap-2 rounded-[13px] border p-2" style={{ borderColor: paired ? "color-mix(in srgb, var(--success) 35%, transparent)" : "var(--border-soft)" }}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--glass-strong)] text-accent"><DeviceMobile size={16} weight="duotone" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-[9px] font-semibold text-main">iPhone 15 Pro</p><p className="mt-0.5 text-[7px]" style={{ color: paired ? "var(--success)" : "var(--text-faint)" }}>{paired ? "Encrypted channel ready" : pairing ? "Handshaking…" : "Available nearby"}</p></div>
              {paired ? <CheckCircle size={14} weight="fill" className="text-[var(--success)]" /> : <span className={`h-1.5 w-1.5 rounded-full ${pairing ? "animate-pulse" : ""}`} style={{ background: pairing ? "var(--accent)" : "var(--warning)" }} />}
            </div>
            <div className="flex items-center gap-2 rounded-[13px] border border-dashed border-[var(--border-soft)] p-2 opacity-50">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--glass-soft)] text-faint"><HardDrive size={15} weight="duotone" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-[9px] font-semibold text-main">Studio iPad</p><p className="mt-0.5 text-[7px] text-faint">Last seen 2 days ago</p></div>
            </div>
          </div>
          <div className="mt-auto pt-2">
            <div className="rounded-[12px] border border-[var(--border-soft)] bg-[var(--glass-soft)] p-2">
              <div className="flex items-start gap-1.5">
                <ShieldCheck size={12} weight="duotone" className="mt-0.5 shrink-0 text-[var(--success)]" />
                <p className="text-[7.5px] leading-relaxed text-faint">Devices meet on your LAN only. Keys never touch a server or the internet.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1.5 text-[7.5px] text-faint"><Devices size={11} weight="duotone" /> Both devices must be on the same Wi-Fi network.</div>
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
          <span className="hidden min-w-0 items-center gap-1.5 text-[7.5px] leading-tight text-faint md:flex">
            <ShieldCheck size={11} weight="duotone" className="shrink-0" />
            PDF saved locally. Nothing sent online.
          </span>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <button onClick={savePdf} className="secondary-button flex h-9 items-center gap-1.5 rounded-full px-4 text-[10px] font-semibold"><Printer size={13} weight="duotone" /> Print</button>
            <button onClick={savePdf} className="primary-button flex h-9 items-center gap-1.5 rounded-full px-4 text-[10px] font-semibold"><FilePdf size={13} weight="bold" /> Save as PDF</button>
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
