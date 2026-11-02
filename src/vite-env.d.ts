/// <reference types="vite/client" />

/**
 * The mode the bundle was built with.
 *
 * `import.meta.env.MODE` is `"development"` for the dev server,
 * `"production"` for a normal build and `"test"` for a build started with
 * `vite build --mode test`.
 */
interface ImportMetaEnv {
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
