/// <reference types="vite/client" />
import {
  ClientOnly,
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { DefaultCatchBoundary } from "@/client/components/DefaultCatchBoundary";
import { IconSprite } from "@/client/components/icons/IconSprite";
import { themePreferenceInitScript } from "@/client/lib/theme";
import {
  identifyAnalyticsUser,
  resetAnalyticsUser,
  startAnalyticsCapture,
  stopAnalyticsCapture,
} from "@/client/lib/posthog";
import { NotFound } from "@/client/components/NotFound";
import appCss from "@/client/styles/app.css?url";
import { useSession } from "@/lib/auth-client";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { Toaster } from "sonner";
import { queryClient } from "@/client/tanstack-db";
import { getActiveOrganizationId } from "@/lib/auth-session";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        title: "UpgradeSEO",
      },
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      // This is a private operator console, not a public page. It sits on a
      // marketing hostname whose root IS meant to be indexed, so the exclusion
      // has to travel with the app rather than rely on that site's robots.txt.
      // `noai`/`noimageai` are honoured by a subset of crawlers and cost
      // nothing to state.
      // One tag per name. Two `<meta name="robots">` entries collide and the
      // later one wins, which silently dropped the noindex and left only the
      // AI directives behind — verified in the rendered head.
      {
        name: "robots",
        content:
          "noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai",
      },
      {
        name: "googlebot",
        content: "noindex, nofollow, noarchive, nosnippet, noimageindex",
      },
      // Disable browser auto-translate (Google Translate) app-wide. It rewrites
      // text nodes into <font> wrappers, which React then can't remove/insert,
      // crashing render with NotFoundError ("removeChild"/"insertBefore"). The
      // product UI is data-dense (keywords, domains, metrics) and not meaningful
      // to machine-translate; the marketing site is a separate app and unaffected.
      {
        name: "google",
        content: "notranslate",
      },
      {
        name: "apple-mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/apple-touch-icon.png",
      },
      // The SVG is the Upgrade plus mark from the brand package, copied
      // byte-for-byte rather than redrawn. Browsers that support it prefer it
      // and it stays sharp at any size; the PNGs and the .ico below are the
      // fallback chain for those that do not.
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      {
        rel: "icon",
        type: "image/png",
        sizes: "32x32",
        href: "/favicon-32x32.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "16x16",
        href: "/favicon-16x16.png",
      },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
    scripts: [],
  }),
  component: AppLayout,
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
});

function AppLayout() {
  return <Outlet />;
}

function PostHogBootstrap() {
  const isHostedMode = isHostedClientAuthMode();
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user?.id ?? null;
  const optedOut = session?.user?.analyticsOptedOut === true;
  const organizationId = getActiveOrganizationId(session);
  const previousUserIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!isHostedMode || isSessionPending) {
      return;
    }

    if (userId && !optedOut) {
      startAnalyticsCapture();
      identifyAnalyticsUser({ userId, organizationId });
      previousUserIdRef.current = userId;
    } else if (userId && optedOut) {
      stopAnalyticsCapture();
    } else if (previousUserIdRef.current) {
      previousUserIdRef.current = null;
      resetAnalyticsUser();
    }
  }, [isHostedMode, isSessionPending, optedOut, organizationId, userId]);

  return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const showDevtools =
    import.meta.env.DEV && import.meta.env.VITE_SHOW_DEVTOOLS !== "false";

  return (
    <html suppressHydrationWarning translate="no">
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themePreferenceInitScript }}
        />
        <HeadContent />
      </head>
      <body>
        {/* Outside ClientOnly: the sprite is inert markup, and mounting it with
            the document means icons are painted on the first frame rather than
            popping in after hydration. */}
        <IconSprite />
        <ClientOnly>
          <QueryClientProvider client={queryClient}>
            <>
              <PostHogBootstrap />
              {children}
              {/* The design centres toasts 22px off the bottom, on every width. The
                    mobile offset clears the bottom tab bar. */}
              <Toaster
                position="bottom-center"
                offset={22}
                mobileOffset={{ bottom: 100 }}
              />
              {showDevtools ? (
                <TanStackDevtools
                  config={{ position: "bottom-right" }}
                  eventBusConfig={{ connectToServerBus: true }}
                  plugins={[
                    {
                      name: "TanStack Router",
                      render: <TanStackRouterDevtoolsPanel />,
                      defaultOpen: true,
                    },
                  ]}
                />
              ) : null}
            </>
          </QueryClientProvider>
        </ClientOnly>
        <Scripts />
      </body>
    </html>
  );
}
