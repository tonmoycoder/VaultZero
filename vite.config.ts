import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        /*
         * PERFORMANCE: the chunk boundaries are explicit, because Rollup
         * otherwise groups modules by the entry that reaches them first.
         *
         * `captureModals.tsx` imports both `lib/ocr.ts` and `lib/totp.ts`.
         * Rollup put them in one chunk, and the chunk carried the OCR
         * language table with it — 83 KB of Shift-JIS data. Opening the TOTP
         * dialog, which only needs a base32 decoder, downloaded the whole
         * OCR table first. The TOTP chunk was 135 KB for a 7 KB source
         * file.
         *
         * Splitting the modules by name keeps every heavy payload in the
         * chunk that actually uses it.
         */
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-icons": ["@phosphor-icons/react"],
          "vendor-motion": ["framer-motion"],
          "vendor-ocr": ["tesseract.js"],
          // V-66: `lib/totp.ts` is no longer a lazy-only module. The live
          // RFC 6238 code is rendered by the inspector and the home card on
          // first paint, so keeping it in a separate chunk forced an extra
          // `modulepreload` round-trip on every cold start. It is small
          // (about 3.5 kB) and is folded into the main chunk instead. The
          // OCR payload still stays in its own chunk, so the original
          // reason for this split is preserved.
          "lib-wordlist": ["src/lib/wordlist.ts"],
        },
      },
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "0.0.0.0",
    // The Arena preview is served from a per-session host; without an
    // explicit allowlist Vite rejects it with HTTP 403 and the preview
    // never loads.
    allowedHosts: true,
    watch: {
      ignored: ["**/src-tauri/**", "**/public/tessdata/**"],
    },
  },
});
