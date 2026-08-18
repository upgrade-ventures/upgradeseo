import { useState } from "react";

import { PageHeaderBand } from "@/client/components/prominence/Primitives";
import {
  AboutSection,
  AnalyticsSection,
} from "@/client/features/settings/AccountSections";
import { ApiKeySettings } from "@/client/features/settings/ApiKeySettings";
import { AppearanceSection } from "@/client/features/settings/AppearanceSection";
import { ProviderKeySettings } from "@/client/features/settings/ProviderKeySettings";
import { providerRowId } from "@/client/features/settings/providerKeyModel";
import { SitesSection } from "@/client/features/settings/SitesSection";
import { isHostedClientAuthMode } from "@/lib/auth-mode";

/**
 * Account-wide settings.
 *
 * Anything scoped to one site lives inside that site's manager card here or on
 * the site's own settings page; this screen holds what belongs to the account:
 * theme, the site list, provider keys, analytics and the About block.
 */
export function SettingsScreen({ version }: { version: string }) {
  const isHosted = isHostedClientAuthMode();
  const [openProvider, setOpenProvider] = useState<string | null>(null);

  // The site Connections tab points at Bing, which is an account-wide key
  // rather than a per-site connection: open its row and move the page to it.
  const revealProviderKey = (provider: string) => {
    setOpenProvider(provider);
    requestAnimationFrame(() => {
      const row = document.getElementById(providerRowId(provider));
      row?.scrollIntoView({ block: "center", behavior: "smooth" });
      row?.focus();
    });
  };

  return (
    <div style={{ paddingBottom: 56 }}>
      <PageHeaderBand
        title="Settings"
        subtitle="Account-wide preferences. Anything site-specific lives on the site itself."
        // The band's padding stops at the tab strip; this screen has no tabs,
        // so the design's 14px of breathing room is added here.
        tabs={<div aria-hidden style={{ height: 14 }} />}
      />

      <div
        style={{
          maxWidth: 760,
          padding: "20px var(--pad, 24px)",
          display: "flex",
          flexDirection: "column",
          gap: 26,
        }}
      >
        <AppearanceSection />

        <SitesSection onOpenProviderKey={revealProviderKey} />

        {/* Outside the hosted gate on purpose: a self-hosted install is
            exactly where someone needs to supply their own provider keys. */}
        <ProviderKeySettings
          openProvider={openProvider}
          onOpenProvider={setOpenProvider}
        />

        {isHosted ? <ApiKeySettings /> : null}
        {isHosted ? <AnalyticsSection /> : null}

        <AboutSection version={version} hosted={isHosted} />
      </div>
    </div>
  );
}
