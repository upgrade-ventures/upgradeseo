import { useState } from "react";
import { toast } from "sonner";

import { Field, TextInput } from "@/client/components/prominence/Field";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import {
  DangerButton,
  EYEBROW,
  QuietNote,
  SkeletonBar,
  useFocusRing,
} from "@/client/features/settings/settingsParts";
import { authClient, signOutAndRedirect, useSession } from "@/lib/auth-client";

/**
 * Product analytics opt-in. Hosted only, because a self-hosted install has no
 * analytics pipeline to opt into.
 */
export function AnalyticsSection() {
  const { data: session, isPending } = useSession();
  const [isSaving, setIsSaving] = useState(false);
  const { focusRing, focusProps } = useFocusRing();

  const enabled = session?.user?.analyticsOptedOut !== true;
  const disabled = isPending || isSaving || !session?.user;

  async function update(next: boolean) {
    setIsSaving(true);
    try {
      const result = await authClient.updateUser({ analyticsOptedOut: !next });
      if (result.error) {
        toast.error("We couldn't update your analytics setting.");
      } else {
        toast.success(next ? "Analytics enabled" : "Analytics disabled");
      }
    } catch {
      toast.error("We couldn't update your analytics setting.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section>
      <h2 style={EYEBROW}>Analytics</h2>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            Help improve UpgradeSEO
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)" }}>
            Share anonymous usage data. Never your keywords, pages or crawl
            results.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Share anonymous usage data"
          disabled={disabled}
          onClick={() => void update(!enabled)}
          {...focusProps}
          style={{
            width: 30,
            height: 17,
            padding: 0,
            border: "none",
            borderRadius: 999,
            background: enabled ? "var(--accent)" : "var(--border-strong)",
            position: "relative",
            flexShrink: 0,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            outline: "none",
            boxShadow: focusRing,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: enabled ? 15 : 2,
              width: 13,
              height: 13,
              borderRadius: 999,
              background: "#fff",
              transition: "left 120ms ease",
            }}
          />
        </button>
      </div>
    </section>
  );
}

/**
 * `hosted` gates everything about the account itself. A self-hosted install
 * signs nobody in, so an identity row, a sign-out button and an erasure request
 * would all be about a session that does not exist.
 */
export function AboutSection({
  version,
  hosted,
}: {
  version: string;
  hosted: boolean;
}) {
  const { data: session, isPending } = useSession();
  const [showErasure, setShowErasure] = useState(false);

  return (
    <section
      style={{ paddingTop: 16, borderTop: "1px solid var(--border-muted)" }}
    >
      <h2 style={EYEBROW}>About</h2>
      <div style={ROW}>
        <span>Version</span>
        <span
          style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}
        >
          v{version}
        </span>
      </div>
      {hosted ? (
        <div style={{ ...ROW, marginTop: 7 }}>
          <span>Signed in as</span>
          {isPending ? (
            <SkeletonBar width={160} height={11} />
          ) : (
            <span style={{ color: "var(--text-2)" }} data-ph-mask>
              {session?.user?.email ?? "Not signed in"}
            </span>
          )}
        </div>
      ) : null}

      {hosted && showErasure ? (
        <DeleteAccountPanel
          email={session?.user?.email}
          onCancel={() => setShowErasure(false)}
        />
      ) : null}

      {hosted ? (
        <>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <SecondaryButton onClick={() => signOutAndRedirect()}>
              Sign out
            </SecondaryButton>
            {showErasure ? null : (
              <DangerButton onClick={() => setShowErasure(true)}>
                Delete account and data…
              </DangerButton>
            )}
          </div>
          <QuietNote>
            Signing out ends this session on this device only.
          </QuietNote>
        </>
      ) : null}
    </section>
  );
}

const ROW = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  fontSize: 13,
} as const;

/** The literal the design asks for before the confirm button will arm. */
const ERASURE_CONFIRMATION = "DELETE";

/**
 * Account erasure, gated behind a typed confirmation.
 *
 * The app has no self-serve delete: `pnpm gdpr:erase-user` is what actually
 * erases a user, across the database, Cloudflare state, Google grants and the
 * billing vendors. So confirming hands the user to the contact routes this
 * install publishes rather than pretending to run the erasure here.
 *
 * It previously built a `mailto:` from an address constant that is empty in
 * this distribution, so the armed button opened a blank draft addressed to
 * nobody and the copy read "a request to ." on screen.
 */
function DeleteAccountPanel({
  email,
  onCancel,
}: {
  email: string | undefined;
  onCancel: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");

  const armed = confirmText.trim() === ERASURE_CONFIRMATION;

  const requestErasure = () => {
    toast.success("Ask from the address you signed in with", {
      description: email
        ? `Send the request from ${email} so we can match it to your account. Nothing has been deleted yet.`
        : "Send the request from the address you signed in with. Nothing has been deleted yet.",
    });
    // A full navigation, not a router link: this panel renders on a route that
    // is not always mounted inside the app shell.
    window.location.href = "/support";
  };

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        border: "1px solid var(--danger-border)",
        background: "var(--danger-soft)",
        borderRadius: 8,
        maxWidth: 420,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        Delete your account and every site on it
      </div>
      <p
        style={{ margin: "5px 0 9px", fontSize: 12.5, color: "var(--text-2)" }}
      >
        This erases every site on the account and the keywords, crawl history,
        saved lists and connections underneath them, revokes the Google
        connections, and closes your sign-in. There is no recovery window: the
        erasure runs in one pass and nothing here can restore it afterwards.
        Removing a single site instead is on its Remove tab above.
      </p>
      <p style={{ margin: "0 0 9px", fontSize: 12.5, color: "var(--text-2)" }}>
        The app cannot run the erasure on its own. Confirming below takes you to
        Help &amp; Community, where the contact routes for this install are
        listed. Nothing is deleted until we run it.
      </p>

      <Field
        label={`Type ${ERASURE_CONFIRMATION} to confirm`}
        required
        description="In capitals, exactly as written."
        hint={`The button turns on once ${ERASURE_CONFIRMATION} matches.`}
        style={{ maxWidth: 200 }}
      >
        {(props) => (
          <TextInput
            {...props}
            value={confirmText}
            placeholder={ERASURE_CONFIRMATION}
            onChange={(event) => setConfirmText(event.target.value)}
          />
        )}
      </Field>

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <DangerButton solid={armed} disabled={!armed} onClick={requestErasure}>
          Request deletion
        </DangerButton>
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
      </div>
    </div>
  );
}
