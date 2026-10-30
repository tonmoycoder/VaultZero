# Contributing to VaultZero

Thank you for your interest in contributing to **VaultZero**! We welcome bug fixes, performance optimizations, accessibility enhancements, and security improvements from the community.

---

## Code of Conduct & Core Philosophy

VaultZero is built on three unshakeable principles:
1. **100% Offline & Sovereign**: No cloud phone-homes, no telemetry, no tracking scripts. Every contribution must respect total local execution.
2. **Cryptographic Rigor**: Memory must be zeroized (`ZeroizeOnDrop`) for sensitive data. Do not invent custom crypto primitives; adhere to standardized audited libraries (`argon2`, `chacha20poly1305`, `spake2`).
3. **Cozy & High-Performance UI**: Fast startup (<20ms backend), fluid 60fps UI, and tasteful retro/lofi aesthetics.

---

## Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **Rust Toolchain**: `stable` (1.78+) with `rustfmt` and `clippy`
- **C/C++ Build Tools**:
  - **Windows**: Visual Studio 2022 C++ Build Tools (with Windows SDK)
  - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
  - **macOS**: Xcode Command Line Tools
- **Tauri CLI v2**: Included in `devDependencies` (`npm run tauri`)

### Step-by-Step Setup

1. **Fork & Clone**:
   ```bash
   git clone https://github.com/tonmoycoder/vaultzero.git
   cd vaultzero
   ```

2. **Install Node Dependencies**:
   ```bash
   npm install
   ```

3. **Run in Development Mode**:
   ```bash
   npm run tauri dev
   ```

4. **Run Full Test Suite**:
   ```bash
   # Run all workspace crate tests
   cargo test --workspace

   # Run TypeScript compilation and Vite production build
   npm run build
   ```

---

## Coding Standards

### Rust Core (`crates/*` & `src-tauri`)
- Keep IPC handlers lightweight and strictly typed.
- Any structure handling master passwords, keys, or decrypted plaintext must implement `zeroize::Zeroize` or `zeroize::ZeroizeOnDrop`.
- Run `cargo fmt` and `cargo clippy --workspace -- -D warnings` before committing.

### Frontend (`src/*`)
- React 18 with TypeScript strict mode (`tsconfig.json`).
- Tailwind CSS for responsive and cozy styling.
- Lucide React for consistent vector iconography.
- Avoid external CDNs or dynamic script evaluation.

---

## Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Follow **Conventional Commits**:
   - `feat: add biometric quick-unlock on Windows Hello`
   - `fix: resolve race condition during P2P sync handoff`
   - `perf: optimize argon2 memory allocation during bulk unlock`
   - `docs: update keyboard shortcut table in README`
3. Ensure all tests pass:
   ```bash
   cargo test --workspace
   npm run build
   ```
4. Open a Pull Request on GitHub against `main` using the provided PR template.

Thank you for making local security accessible and delightful!

