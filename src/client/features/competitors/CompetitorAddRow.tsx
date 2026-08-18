import { useState, type FormEvent } from "react";

import { PrimaryButton } from "@/client/components/prominence/Primitives";
import { Field, TextInput } from "@/client/components/prominence/Field";

/**
 * The add-a-competitor control row.
 *
 * The design's Competitors screen has no add control at all, so the row is
 * drawn out of the Forms & validation page instead: label always visible and
 * bound with `for`/`id`, a description saying why we are asking, a placeholder
 * that shows the shape of a value rather than naming the field, and a message
 * that appears when the field is left and names the fix.
 */

/** The server accepts 3 to 253 characters; the shape check is ours. */
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9-]+)+$/i;

/**
 * Accept what a person pastes — a full URL, a trailing slash, a `www.` — and
 * hand the server the bare host. Returning the cleaned value rather than
 * rejecting it means a paste from the address bar is never a dead end.
 */
function normalizeDomainInput(raw: string): string {
  return raw
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

/** Every message names the fix, per the design's validation rule. */
function validateDomain(raw: string, existingDomains: string[]): string | null {
  const value = normalizeDomainInput(raw);
  if (value.length === 0) return "Enter a domain to add.";
  if (value.length < 3 || !DOMAIN_PATTERN.test(value)) {
    return "Enter a bare domain with a dot in it, like ahrefs.com.";
  }
  if (value.length > 253) {
    return "That is longer than a domain can be. Check it for a stray path.";
  }
  if (existingDomains.includes(value)) {
    return `${value} is already on this list. Harvest it from its row instead.`;
  }
  return null;
}

export function CompetitorAddRow({
  existingDomains,
  isAdding,
  onAdd,
}: {
  /** Already-tracked domains, so a duplicate is caught before the round trip. */
  existingDomains: string[];
  isAdding: boolean;
  onAdd: (domain: string) => void;
}) {
  const [domain, setDomain] = useState("");
  // The message appears once the field has been left, not on every keystroke.
  const [blurred, setBlurred] = useState(false);

  const message = validateDomain(domain, existingDomains);
  // An untouched empty field is not an error, it is just empty.
  const showRequired = blurred && domain.trim().length > 0;
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    setBlurred(true);
    if (message) return;
    onAdd(normalizeDomainInput(domain));
    setDomain("");
    setBlurred(false);
    setSubmitAttempted(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "flex-start",
        padding: "14px var(--pad, 24px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <Field
        label="Competitor domain"
        required
        description="A site that publishes for the same buyers. We read it from Common Crawl, never from the site itself."
        error={showRequired || submitAttempted ? message : null}
        style={{ flex: 1, minWidth: 240, maxWidth: 360 }}
      >
        {(control) => (
          <TextInput
            {...control}
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            onBlur={() => setBlurred(true)}
            placeholder="ahrefs.com"
            maxLength={253}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </Field>

      {/* Aligns with the control line of the field, which sits under a label
          and a description. */}
      <div style={{ paddingTop: 37 }}>
        <PrimaryButton
          type="submit"
          icon="i-plus"
          disabled={isAdding}
          // The base class is repeated because the spread that carries
          // `className` into the button lands after its own default and
          // replaces it. The 44px floor is the mobile touch target.
          className="prominence-button-primary max-sm:min-h-11"
        >
          {isAdding ? "Adding…" : "Add competitor"}
        </PrimaryButton>
      </div>
    </form>
  );
}
