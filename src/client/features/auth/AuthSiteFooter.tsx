/**
 * The site footer, on the pages a signed-out visitor sees.
 *
 * The demo is linked from a public repository, so for most people arriving
 * here the sign-in screen is the first thing they see of Upgrade Ventures. It
 * carries the same legal line as upgrade.ventures — same corporation, same
 * address, same three legal links, same disclaimer — so the page reads as part
 * of the site rather than an unattributed login form on a stranger's domain.
 *
 * Written against the app's own tokens rather than copying the theme's CSS:
 * this footer follows the app into dark mode, which the marketing site's does
 * not have to.
 */
export function AuthSiteFooter() {
  return (
    <footer
      style={{
        marginTop: 40,
        paddingTop: 20,
        borderTop: "1px solid var(--line)",
        maxWidth: 560,
        textAlign: "center",
        fontSize: 11.5,
        lineHeight: 1.7,
        color: "var(--text-3)",
      }}
    >
      <p style={{ margin: 0 }}>
        Upgrade is a product of Friddy, Inc., a Delaware corporation ·{" "}
        <span style={{ whiteSpace: "nowrap" }}>
          8 The Green, Suite A, Dover, DE 19901, USA
        </span>{" "}
        · <a href="mailto:team@upgrade.ventures">team@upgrade.ventures</a>
      </p>
      <p style={{ margin: "4px 0 0" }}>
        <a href="https://upgrade.ventures/legal/privacy/">Privacy</a> ·{" "}
        <a href="https://upgrade.ventures/legal/terms/">Website terms</a> ·{" "}
        <a href="https://upgrade.ventures/legal/cookies/">Cookies</a> ·{" "}
        <a href="https://upgrade.ventures/">upgrade.ventures</a>
      </p>
      <p style={{ margin: "4px 0 0" }}>
        Nothing on this site is legal or tax advice. Get your own counsel before
        you sign. © 2026 Upgrade Ventures
      </p>
    </footer>
  );
}
