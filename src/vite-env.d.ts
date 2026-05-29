/// <reference types="vite/client" />
/// <reference types="chrome" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_MERCURE_HUB_URL: string;
  readonly VITE_EXT_SECRET: string;
  readonly VITE_EXT_ID: string;
  /** "true" / "false" — see docs/MOCK-API.md. Defaults to ON when missing. */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
