import { createFileRoute } from "@tanstack/react-router";

import { SettingsScreen } from "@/client/features/settings/SettingsScreen";
import { version } from "../../../package.json";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return <SettingsScreen version={version} />;
}
