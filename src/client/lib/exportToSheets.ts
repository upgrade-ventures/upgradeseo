import { toast } from "sonner";
import {
  copyTableToClipboard,
  GOOGLE_SHEETS_NEW_URL,
} from "@/client/lib/clipboard";
import type { CsvValue } from "@/client/lib/csv";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { captureClientEvent } from "@/client/lib/posthog";

function openGoogleSheetsTab() {
  window.open(GOOGLE_SHEETS_NEW_URL, "_blank", "noopener,noreferrer");
}

/**
 * Copy a table to the clipboard and offer to open a new Google Sheet.
 *
 * Reported as a toast with an action rather than a dialog: the design has no
 * dialogs, and this is a result plus one optional next step. Sheets is opened
 * on an explicit click, never automatically, because a redirect would leave the
 * user in a new tab with no idea the data is on their clipboard.
 */
export async function exportTableToSheets(args: {
  headers: string[];
  rows: CsvValue[][];
  feature: string;
}) {
  const { headers, rows, feature } = args;
  if (rows.length === 0) {
    toast.error("No data to export");
    return;
  }
  try {
    await copyTableToClipboard(headers, rows);
    captureClientEvent("data:export_sheets", {
      source_feature: feature,
      result_count: rows.length,
    });
    toast.success(
      `Copied ${rows.length} row${rows.length === 1 ? "" : "s"} to your clipboard`,
      {
        description: "Open a new sheet and paste to finish.",
        action: { label: "Open Sheets", onClick: openGoogleSheetsTab },
        duration: 10000,
      },
    );
  } catch (error) {
    toast.error(getStandardErrorMessage(error, "Could not copy to clipboard"));
  }
}
