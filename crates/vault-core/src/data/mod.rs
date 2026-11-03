//! Shared data tables used across the vault core.
//!
//! Keeping the passphrase wordlist here — rather than duplicating it in the
//! frontend — means the Rust and TypeScript generators can never drift
//! apart. The TypeScript copy is generated from `data::wordlist` by
//! `scripts/generate-wordlist.mjs`.

pub mod wordlist;
