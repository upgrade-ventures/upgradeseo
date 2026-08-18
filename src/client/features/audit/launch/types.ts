import {
  DEFAULT_AUDIT_PAGES,
  MIN_AUDIT_PAGES,
  PAID_MAX_AUDIT_PAGES,
} from "@/shared/audit-limits";

export const MIN_PAGES = MIN_AUDIT_PAGES;

// One limit for everyone. The crawl budget in audit-capacity.ts is the only
// bound left now that audits are not tiered by plan.
export const MAX_PAGES = PAID_MAX_AUDIT_PAGES;

export type LaunchFormValues = {
  url: string;
  maxPagesInput: string;
  runLighthouse: boolean;
};

export const DEFAULT_LAUNCH_FORM_VALUES: LaunchFormValues = {
  url: "",
  maxPagesInput: String(DEFAULT_AUDIT_PAGES),
  runLighthouse: false,
};
