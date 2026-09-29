import * as React from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  BarChart3,
  BookOpen,
  ExternalLink,
  FolderKanban,
  Images,
  Inbox,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  PenLine,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

import { logoutFn } from "@/lib/admin.functions";

import { ToastProvider } from "./toast";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/personalize", label: "Personalize", icon: Sparkles },
  { to: "/admin/blogs", label: "Blog posts", icon: PenLine },
  { to: "/admin/writings", label: "Writings", icon: BookOpen },
  { to: "/admin/structure", label: "Content structure", icon: Layers },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/media", label: "Media library", icon: Images },
  { to: "/admin/contacts", label: "Messages", icon: Inbox },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="adm-nav" aria-label="Admin sections">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} activeProps={{ className: "is-active" }} onClick={onNavigate}>
          <Icon size={16} strokeWidth={1.6} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="adm-brand">
      <b>AKSH</b>
      <i aria-hidden="true" />
      <span>ADMIN / CMS</span>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logoutFn();
    } finally {
      await router.navigate({ to: "/admin/login" });
      setSigningOut(false);
    }
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const footer = (
    <div className="adm-side-foot">
      <a href="/" target="_blank" rel="noopener noreferrer">
        <ExternalLink size={15} strokeWidth={1.6} /> View site
      </a>
      <button type="button" onClick={signOut} disabled={signingOut}>
        <LogOut size={15} strokeWidth={1.6} /> {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );

  return (
    <ToastProvider>
      <div className="adm">
        <div className="adm-top">
          <Brand />
          <button
            type="button"
            className="adm-top-btn"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu size={20} strokeWidth={1.6} />
          </button>
        </div>

        {open ? (
          <div className="adm-sheet" role="dialog" aria-modal="true" aria-label="Admin menu">
            <div className="adm-sheet-head">
              <Brand />
              <button
                type="button"
                className="adm-top-btn"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X size={20} strokeWidth={1.6} />
              </button>
            </div>
            <Nav onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        ) : null}

        <div className="adm-shell">
          <aside className="adm-side">
            <Brand />
            <Nav />
            {footer}
          </aside>
          <main className="adm-main" id="admin-main">
            <div className="adm-wrap">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
