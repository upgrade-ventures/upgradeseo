import { SafeExternalLink } from "@/client/components/SafeExternalLink";
import { extractUrlPath, truncateMiddle } from "./backlinksPageUtils";

/**
 * A link to a source or target URL, shown as its path so the table stays
 * readable. Colour is inherited from the cell, which is how the design draws
 * table text; only the hover underline marks it as a link.
 */
export function BacklinksSourceLink({
  url,
  maxLength,
  muted = false,
}: {
  url: string;
  maxLength: number;
  muted?: boolean;
}) {
  return (
    <span
      style={
        muted ? { fontSize: 11.5, color: "var(--text-2)" } : { fontSize: 12.5 }
      }
    >
      <SafeExternalLink
        url={url}
        label={truncateMiddle(extractUrlPath(url), maxLength)}
        className="link link-hover break-all inline-flex items-center gap-1"
      />
    </span>
  );
}
