import { PrimaryButton } from "@/client/components/prominence/Primitives";
import type { RankTrackingConfig } from "@/types/schemas/rank-tracking";
import {
  devicesCount,
  KEYWORDS_PER_BATCH,
  SECONDS_PER_BATCH,
} from "@/shared/rank-tracking";
import { SmallButton } from "./RankScreenParts";
import { PanelBand } from "./RankPanelParts";

/**
 * The scope confirm for "Check ranks now".
 *
 * A job states what it is about to do before it starts, and the design does
 * this in place rather than in a dialog: the band drops in under the header,
 * above the table it is about, and the primary button in it is the one that
 * actually starts the run.
 *
 * Every number is measured rather than quoted: the keyword count is the set's
 * own rows, the device count is the config, and the duration comes from the
 * batch constants the checker actually runs on. There is no price here, because
 * nothing is metered.
 */
export function CheckConfirmBand({
  keywordCount,
  devices,
  isPending,
  onRunNow,
  onCancel,
}: {
  keywordCount: number;
  devices: RankTrackingConfig["devices"];
  isPending: boolean;
  onRunNow: () => void;
  onCancel: () => void;
}) {
  const perKeyword = devicesCount(devices);
  const totalChecks = keywordCount * perKeyword;
  const seconds =
    Math.ceil(totalChecks / KEYWORDS_PER_BATCH) * SECONDS_PER_BATCH;
  const keywords = `${keywordCount.toLocaleString()} keyword${keywordCount === 1 ? "" : "s"}`;

  return (
    <PanelBand
      tone="accent"
      role="status"
      style={{ padding: "10px var(--pad,24px)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          fontSize: 12.5,
        }}
      >
        <span>
          <strong style={{ fontWeight: 600 }}>
            Check ranks for {keywords}?
          </strong>{" "}
          <span style={{ color: "var(--text-2)" }}>
            This runs a real Google check on {deviceSentence(devices)} —{" "}
            {totalChecks.toLocaleString()} position
            {totalChecks === 1 ? "" : "s"} in total ·{" "}
            {durationSentence(seconds)}. You can close the page.
          </span>
        </span>
        <span
          style={{
            display: "flex",
            gap: 8,
            marginLeft: "auto",
            alignItems: "center",
          }}
        >
          <SmallButton onClick={onCancel} disabled={isPending}>
            Cancel
          </SmallButton>
          <PrimaryButton
            onClick={onRunNow}
            disabled={isPending}
            style={isPending ? { cursor: "progress" } : undefined}
          >
            {isPending ? "Starting…" : "Check now"}
          </PrimaryButton>
        </span>
      </div>
    </PanelBand>
  );
}

function deviceSentence(devices: RankTrackingConfig["devices"]): string {
  if (devices === "both") return "desktop and mobile";
  return devices === "desktop" ? "desktop" : "mobile";
}

/** Rounded, and always hedged: this is an estimate from batch size, not a clock. */
function durationSentence(seconds: number): string {
  if (seconds < 60) return "less than a minute";
  const minutes = Math.round(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}
