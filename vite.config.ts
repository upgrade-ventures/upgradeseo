import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { devtools } from "@tanstack/devtools-vite";
import { leanWorkerBundle } from "./vite-plugin-lean-worker-bundle";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = process.env.PORT
    ? Number(process.env.PORT)
    : env.PORT
      ? Number(env.PORT)
      : 3001;
  const showDevtools = env.VITE_SHOW_DEVTOOLS !== "false";
  const allowedHosts = [
    env.ALLOWED_HOST,
    env.BETTER_AUTH_URL ? new URL(env.BETTER_AUTH_URL).hostname : undefined,
  ].filter((host): host is string => Boolean(host));
  const emitSourcemaps = env.POSTHOG_SOURCEMAPS === "true";

  return {
    envPrefix: [
      "VITE_",
      "AUTH_MODE",
      "BYPASS_EMAIL_VERIFICATION",
      "POSTHOG_PUBLIC_KEY",
      "POSTHOG_HOST",
      "TURNSTILE_SITE_KEY",
    ],
    server: {
      allowedHosts,
      port,
    },
    preview: {
      allowedHosts,
      port,
    },
    // `base` is set for completeness, but TanStack Start does NOT use it for
    // asset URLs — it emits those from its own manifest using the plugin's
    // router.basepath (see the tanstackStart() call below). What `base` alone
    // could never fix is the other half: Start prefixes the URLs but still
    // writes the files to dist/client/assets/. Workers Assets then looks up
    // /UpgradeSEO/assets/x.js, finds nothing, falls through to the worker, and
    // returns the SPA shell as text/html — a 200-looking blank page with no
    // console error, because the "asset" parsed as a document. `assetsDir`
    // moves the emitted files under the same prefix so lookup and URL agree.
    base: env.VITE_BASE_PATH
      ? `/${env.VITE_BASE_PATH.replace(/^\/+|\/+$/g, "")}/`
      : "/",
    build: {
      sourcemap: emitSourcemaps,
      outDir: emitSourcemaps ? "dist-sourcemaps" : "dist",
      // NOT prefixed here. Start's plugin already prefixes every emitted URL
      // with router.basepath, so putting the prefix in assetsDir too produces
      // /UpgradeSEO/UpgradeSEO/assets/. The files are relocated after the
      // build instead — see the `base-path:relocate-assets` plugin below.
    },
    plugins: [
      // Start prefixes every asset URL with router.basepath but still writes
      // the files to the client root, so Workers Assets looks up
      // /UpgradeSEO/assets/x.js, finds nothing, and falls through to the
      // worker — which answers with the SPA shell as text/html. The result is
      // a 200-looking blank page and NO console error, because the browser
      // parsed a document where it expected a script. Moving the built client
      // output under the same prefix makes lookup and URL agree.
      env.VITE_BASE_PATH
        ? {
            name: "base-path:relocate-assets",
            apply: "build" as const,
            enforce: "post" as const,
            closeBundle() {
              const prefix = env.VITE_BASE_PATH.replace(/^\/+|\/+$/g, "");
              const root = path.resolve(
                emitSourcemaps ? "dist-sourcemaps" : "dist",
                "client",
              );
              const target = path.join(root, prefix);
              if (!fs.existsSync(root) || fs.existsSync(target)) return;
              const entries = fs.readdirSync(root);
              fs.mkdirSync(target, { recursive: true });
              for (const entry of entries) {
                fs.renameSync(path.join(root, entry), path.join(target, entry));
              }
            },
          }
        : null,
      leanWorkerBundle(),
      showDevtools
        ? devtools({
            consolePiping: {
              enabled: true,
              levels: ["log", "warn", "error", "info", "debug"],
            },
          })
        : null,
      cloudflare({ inspectorPort: false, viteEnvironment: { name: "ssr" } }),
      tsConfigPaths(),
      // The router basepath has to reach the PLUGIN, not just createRouter:
      // Start builds its own asset manifest and ignores Vite's `base`, so
      // without this every script and stylesheet is emitted at /assets/... and
      // 404s against Ghost once the app is mounted below root.
      tanstackStart(
        env.VITE_BASE_PATH
          ? {
              router: {
                basepath: `/${env.VITE_BASE_PATH.replace(/^\/+|\/+$/g, "")}`,
              },
            }
          : undefined,
      ),
      viteReact(),
      tailwindcss(),
    ],
  };
});
