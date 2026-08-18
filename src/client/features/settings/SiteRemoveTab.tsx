import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Field, TextInput } from "@/client/components/prominence/Field";
import { SecondaryButton } from "@/client/components/prominence/Primitives";
import type { ProjectSummary } from "@/client/features/projects/types";
import {
  DangerButton,
  QuietNote,
} from "@/client/features/settings/settingsParts";
import {
  clearLastProjectId,
  getLastProjectId,
} from "@/client/lib/active-project";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { archiveProject } from "@/serverFunctions/projects";

export function RemoveTab({
  site,
  canRemove,
  onRemoved,
}: {
  site: ProjectSummary;
  canRemove: boolean;
  onRemoved: () => void;
}) {
  const queryClient = useQueryClient();
  const [arming, setArming] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const target = site.domain ?? site.name;
  const armed = confirmText.trim() === target;

  const archiveMutation = useMutation({
    mutationFn: () => archiveProject({ data: { projectId: site.id } }),
    onSuccess: async () => {
      if (getLastProjectId() === site.id) clearLastProjectId();
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(`${target} removed · you can restore it from Projects`);
      onRemoved();
    },
  });

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700 }}>Remove {target}</div>
      {/* The app archives rather than deletes: the site and everything on it
          leaves the app but stays restorable from Projects. Saying "deleted"
          here would promise an erasure that never happens. */}
      <p style={{ margin: "5px 0 0", fontSize: 12.5, color: "var(--text-2)" }}>
        This takes the site out of the app along with its keywords, crawl
        history, saved lists and connections. Your other sites are untouched.
        Nothing expires it, so it stays restorable from Projects for as long as
        the account exists.
      </p>

      {!canRemove ? (
        <QuietNote>
          This is your only site, and the app keeps at least one. Add another
          site first.
        </QuietNote>
      ) : arming ? (
        <div
          style={{
            marginTop: 11,
            padding: 11,
            border: "1px solid var(--danger-border)",
            background: "var(--danger-soft)",
            borderRadius: 6,
          }}
        >
          {/* No aria-label on the input: one would replace the visible label
              with different words, which is exactly the mismatch a typed
              confirmation cannot afford. */}
          <Field
            label="Type the domain to confirm"
            required
            description={
              <>
                Enter <strong style={{ fontWeight: 600 }}>{target}</strong>{" "}
                exactly.
              </>
            }
            hint="The button turns on once the domain matches."
            style={{ maxWidth: 280 }}
          >
            {(props) => (
              <TextInput
                {...props}
                value={confirmText}
                placeholder={target}
                onChange={(event) => setConfirmText(event.target.value)}
              />
            )}
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <DangerButton
              solid={armed}
              disabled={!armed || archiveMutation.isPending}
              onClick={() => archiveMutation.mutate()}
            >
              {archiveMutation.isPending ? "Removing…" : "Remove site"}
            </DangerButton>
            <SecondaryButton
              onClick={() => {
                setArming(false);
                setConfirmText("");
              }}
            >
              Cancel
            </SecondaryButton>
          </div>
          {archiveMutation.isError ? (
            <QuietNote tone="danger">
              {getStandardErrorMessage(
                archiveMutation.error,
                "We could not remove this site.",
              )}
            </QuietNote>
          ) : null}
        </div>
      ) : (
        <div style={{ marginTop: 11 }}>
          <DangerButton onClick={() => setArming(true)}>
            Remove this site…
          </DangerButton>
        </div>
      )}
    </div>
  );
}
