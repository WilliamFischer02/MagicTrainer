import { openUrl } from "@tauri-apps/plugin-opener";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import s from "./components.module.css";

/** Opens `href` in the system browser (never inside the WebView). Renders as a real link for a11y. */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        openUrl(href).catch((err: unknown) => console.error("openUrl failed", href, err));
      }}
    >
      {children}
    </a>
  );
}

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.page} aria-labelledby="page-title">
      <header className={s.pageHead}>
        <div>
          <h1 id="page-title" className={s.pageTitle}>
            {title}
          </h1>
          {subtitle && <p className={s.pageSub}>{subtitle}</p>}
        </div>
        {actions && <div>{actions}</div>}
      </header>
      <div className={s.pageBody}>{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "default" | "ghost"; size?: "sm" | "md" };

export function Button({ variant = "default", size = "md", className, ...rest }: ButtonProps) {
  const cls = [s.btn, variant === "primary" && s.btnPrimary, variant === "ghost" && s.btnGhost, size === "sm" && s.btnSm, className]
    .filter(Boolean)
    .join(" ");
  return <button type="button" className={cls} {...rest} />;
}

export function EmptyState({ icon, title, body, actions }: { icon: ReactNode; title: string; body: ReactNode; actions?: ReactNode }) {
  return (
    <div className={s.empty}>
      <div className={s.emptyGlyph}>{icon}</div>
      <h2 className={s.emptyTitle}>{title}</h2>
      <p className={s.emptyBody}>{body}</p>
      {actions && <div className={s.emptyActions}>{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={[s.card, className].filter(Boolean).join(" ")}>
      {title && <h2 className={s.cardTitle}>{title}</h2>}
      {children}
    </div>
  );
}

export function Callout({ tone = "info", icon, children }: { tone?: "info" | "danger" | "ok" | "warn"; icon?: ReactNode; children: ReactNode }) {
  const cls = [s.callout, tone === "danger" && s.calloutDanger, tone === "ok" && s.calloutOk, tone === "warn" && s.calloutWarn].filter(Boolean).join(" ");
  return (
    <div className={cls} role={tone === "danger" ? "alert" : "status"}>
      {icon}
      <div>{children}</div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

export function Spinner() {
  return <span className={s.spinner} aria-hidden="true" />;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
