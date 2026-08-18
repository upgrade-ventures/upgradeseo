/// <reference types="vite/client" />
interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_SHOW_DEVTOOLS?: string;
  readonly BYPASS_EMAIL_VERIFICATION?: string;
  /** Sub-path this app is mounted at, e.g. "UpgradeSEO". See shared/base-path.ts. */
  readonly VITE_BASE_PATH?: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
