# VaultZero — Checklist Progress (update after EVERY step)

Legend: `[x]` done & verified · `[ ]` open · `[!]` blocked (reason)
Companion state: `checkpoint.md`. Read both before resuming.

## PHASE A — CI / correctness

```
[x] V-67 Node 20 `navigator` parity (b3a6125) — node20 harness 25/25
[x] V-68 scale-spring flake -> expect.poll (ab2a8ca) — targeted 6/6, full 124/124 local
[x] V-66 lib-totp folded into main chunk; prod-bundle heavy-payload invariant
[x] V-63 snapshot BEFORE download in UpdateModal + UpdateBanner
[x] V-50/59/60/62/64/65 fixes documented in docs/AUDIT-2026-11.md
[x] Identify failing test of 41558464980 via authenticated signed plain-text
    job log + fetch_page (artifact blob host is not allowlisted) — 123/1 at
    tests/vault-architecture.spec.ts:106, Delete selected not found
[x] V-70 fix: remove `force: true`, hover + normal click + aria-checked guard;
    targeted `--repeat-each=20 --workers=2` → 20/20 PASS
[x] V-69 air-seal harness written, 19 Rust files + 7 positive controls PASS
[x] V-71 Bengali emergency-kit harness written, Node 20 parity PASS
[x] Re-run all gates: tsc 0 · verify 27/27 · node@20 27/27 · full 124/124
    (exact CI config, 6.4m) · audit 0 · clippy belongs to the Windows CI job
[ ] Commit + push; `gh pr checks 2` BOTH green on the NEW run
```

## PHASE B — persistent resumable files

```
[x] checkpoint.md               (written 2026-11-03, workspace restored)
[x] checklistprogress.md        (this file)
[x] docs/EXTERNAL-REPO-SURVEY.md (written 2026-11-03, 23/23 repos)
[x] review survey doc + reference it in the final Bengali report (23/23 read)
[ ] update BOTH files again after every later step
```

## PHASE C — existing invariants (verified; do not regress)

```
[x] fail-closed local-vault.pmv
[x] real RFC 6238 TOTP (vectors 94287082 / 07081804)
[x] WebAuthn quick unlock (P-256/ES256, memory-only wrap, zeroisation)
[x] stable 5 release asset names + ONE combined SHA256SUMS.txt
[x] fail-closed release.yml (no `|| true`), signed + apksigner-verified APK
[x] Bengali-only prose: README front matter + typo fixed; emergency-kit now
    language-aware (V-71, English mode preserved)
[ ] native .pmv backup
[ ] Android install UX
[ ] tokio features=["full"] review
[ ] SecurityCenter.tsx / VaultHome.tsx physics rollout
[ ] published GitHub release asset existence
[ ] absolute <2s .exe cold-start (NOT measured; 284ms is a WebView proxy only)
```

## PHASE D — live preview (RESTORED 2026-11-03)

```
[x] inspected existing processes: old pid 7301/7322 served 0.0.0.0:1420
[x] verified health: HTTP 200, React shell rendered, 0 runtime errors
[x] verified vite.config.ts host/strictPort/allowedHosts:true (no 403 on *.e2b.app)
[x] verified no X-Frame-Options / CSP frame-ancestors (iframe OK)
[x] stopped `vaultzero-dev-server-5f76b3d2` cleanly
[x] started `website-3326e381` — 0.0.0.0:1420, no preview warnings
[x] re-verified after restart: HTTP 200 (both hosts), /src/main.tsx 200,
    /@vite/client 200, Chromium render OK, 0 errors
```

## PHASE E — 23-repo external survey (ALL INSPECTED, read-only GitHub)

```
[x]  1 Mrlopez62/stash                       REJECT macOS+extension+MCP
[x]  2 Max-Zit/passzit                       REJECT README-only, "Planned"
[x]  3 sapientorius/nodePass                 REJECT server can decrypt secrets
[x]  4 Iamsujithd/VeyraKey                   REJECT Drive BYOS + MV3
[x]  5 toshost/passvault                     REJECT Go server + Postgres
[x]  6 clane-ai/clane-vault                  REJECT container + pre-audit
[x]  7 girishlade111/ls-pass                REJECT native AutofillService
[x]  8 hmalvee/EnigmaKeep                   REJECT browser; rollback needs Rust
[x]  9 antoniopelusi/KeyHolder              REJECT AES/ECB
[x] 10 CyberNilsen/CyberVault               REJECT multiple vaults breaks .pmv
[x] 11 Chiranth…/vaultx-offline…            REJECT PBKDF2 + deterministic passwords
[x] 12 TheTallProgrammer/Password-Manager   REJECT custom XOR cipher
[x] 13 deepakvamsi/kosh                     REJECT audit-log subsystem; ADOPT
                                             air-seal guard idea as V-69 candidate
[x] 14 DevsFromHiddenFlame/Qlerky           SKIP no source; next-TOTP unverifiable
[x] 15 ngankt2/kiwi-password-manager        REJECT KDBX / Minisign infra
[x] 16 sapthesh/offline-vault               REJECT offline claim vs favicon fetch
[x] 17 calinux-py/ShieldPass                REJECT readme.md only
[x] 18 dawei2077/…vapor-vault               REJECT self-declared educational
[x] 19 aviondb/aviondb-p2p-sync             REJECT 6-year-old Todo demo
[x] 20 Fundaments-Work/Theorem              REJECT features; ADOPT context files
[x] 21 mHamzaIqbal1998/VaultPeer-Desktop    REJECT signaling server + KDBX
[x] 22 karefined-eng/the-mainframe          REJECT now (pre-merge backup candidate)
[x] 23 lively-community/lively              REJECT WinUI3 wallpaper, out of domain
```

Result: **0 external features added**, **1 idea approved AND implemented
(V-69 air-seal guard)**, 1 convention adopted (resumable context files). Rejection classes: (a) server/cloud/extension/OS-native
dependency breaks the standalone air-gapped invariant, (b) weaker or broken
crypto, (c) no code / self-declared demo, (d) already implemented in VaultZero,
(e) not empirically verifiable at the time of review.

```
[x] V-69: tests/harness/air-seal.test.mjs written; node + node@20 PASS
[x] V-69 + V-71: `npm run verify` → 27/27 harness files, exit 0
```

## PHASE F — final deliverables

```
[ ] Full green CI (`gh pr checks 2` BOTH green)
[ ] Final Bengali report: verification numbers + Big-O + memory trade-offs +
    honest caveats (unmeasured .exe cold-start, no local cargo, unverified assets)
[ ] Gemini 3.8 Flash / Entry Gravity master prompt — DELIVER LAST, in English
    technical spec, MUST reference BOTH checkpoint.md AND checklistprogress.md
```
