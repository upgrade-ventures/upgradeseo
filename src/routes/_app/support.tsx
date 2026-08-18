import { createFileRoute } from "@tanstack/react-router";

const DISCORD_URL = "https://discord.gg/c9uGs3cFXr";
const GITHUB_URL = "";

export const Route = createFileRoute("/_app/support")({
  component: SupportPage,
});

function SupportPage() {
  return (
    <div className="h-full overflow-auto bg-base-100 px-4 py-8 pb-24 md:px-6 md:py-12 md:pb-8">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-medium text-base-content/40">
          Help & Community
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          We want to hear from you
        </h1>
        <p className="mt-2 text-sm text-base-content/60">
          We want to talk to you! We're super open to feedback and want to learn
          how you work so we can make UpgradeSEO better.
        </p>

        <div className="mt-8 space-y-3">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-base-300 px-5 py-4 transition-colors hover:border-base-content/20"
          >
            <p className="text-sm font-semibold">Discord</p>
            <p className="mt-1 text-sm text-base-content/60">
              Ask for help, share ideas and learn from the community.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-base-content">
              Join the Discord
              <span aria-hidden="true">&rarr;</span>
            </span>
          </a>

          <a
            href={`${GITHUB_URL}/issues`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-base-300 px-5 py-4 transition-colors hover:border-base-content/20"
          >
            <p className="text-sm font-semibold">GitHub Issues</p>
            <p className="mt-1 text-sm text-base-content/60">
              Report bugs or request features on GitHub.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-base-content">
              Open an issue
              <span aria-hidden="true">&rarr;</span>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
