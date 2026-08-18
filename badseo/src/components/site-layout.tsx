import type { ReactNode } from "react";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="nav" aria-label="BadSEO navigation">
        <a className="brand" href="/">
          BADSEO
        </a>
        <span className="nav-links">
          <a href="">UpgradeSEO</a>
          <a href="">GitHub</a>
        </span>
      </nav>
      {children}
      <footer className="foot">
        <div className="foot-inner">
          <a className="foot-brand" href="/">
            BADSEO
          </a>
          <span className="foot-links">
            <a href="/#issues">All issues</a>
            <a href="">GitHub</a>
            <a href="">UpgradeSEO</a>
            <a href="/privacy">Privacy</a>
            <button
              className="footer-button"
              type="button"
              data-cookie-settings
            >
              Cookie settings
            </button>
          </span>
        </div>
      </footer>
    </>
  );
}
