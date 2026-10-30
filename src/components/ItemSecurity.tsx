import { ArrowRight, Check, Fingerprint, Password, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import type { VaultItem } from "../lib/vault";

export default function ItemSecurity({ item, onGenerate, onAuthenticator }: {
  item: VaultItem;
  onGenerate: () => void;
  onAuthenticator: () => void;
}) {
  const checks = [
    { label: "At least 12 characters", pass: item.password.length >= 12, detail: `${item.password.length} characters in this password` },
    { label: "Uppercase and lowercase", pass: /[a-z]/.test(item.password) && /[A-Z]/.test(item.password), detail: "A mix of letter cases" },
    { label: "Includes a number", pass: /\d/.test(item.password), detail: "Adds another character type" },
    { label: "Includes a special character", pass: /[^A-Za-z0-9]/.test(item.password), detail: "Symbols make patterns less predictable" },
  ];
  const passed = checks.filter((check) => check.pass).length;
  return (
    <div className="inspector-security thin-scrollbar">
      <div className="security-item-heading">
        <span className="security-emblem"><ShieldCheck size={25} weight="duotone" /></span>
        <h3>Password checkup</h3>
        <p>A closer look at {item.title}.</p>
      </div>
      <div className="security-check-summary">
        <span>{passed} of {checks.length} checks passed</span>
        <div>{checks.map((check) => <i key={check.label} style={{ background: check.pass ? "var(--success)" : "var(--warning)" }} />)}</div>
      </div>
      <div className="security-check-list">
        {checks.map((check) => (
          <div className="security-check" key={check.label}>
            <span className={check.pass ? "text-success" : "text-warning"}>
              {check.pass ? <Check size={16} weight="bold" /> : <WarningCircle size={16} weight="duotone" />}
            </span>
            <div><strong>{check.label}</strong><p>{check.detail}</p></div>
          </div>
        ))}
      </div>
      <button className="secondary-button inspector-action" onClick={onGenerate}>
        <Password size={16} weight="duotone" /> Generate a stronger password <ArrowRight size={13} />
      </button>
      <button className="two-factor-check" onClick={onAuthenticator}>
        <Fingerprint size={23} weight="duotone" />
        <span><strong>{item.totp ? "Two-factor authentication" : "Add another layer of protection"}</strong>
          <small>{item.totp ? "An authenticator is attached to this item." : "Set up an authenticator for this account."}</small>
        </span>
        <ArrowRight size={14} />
      </button>
      <p className="security-explainer">These are local character checks, not a guarantee of password security or an online breach check. Always use a unique password.</p>
    </div>
  );
}