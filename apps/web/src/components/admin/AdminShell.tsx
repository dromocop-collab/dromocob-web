"use client";

import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { getFirebaseAuth, getFirebaseApp } from "@/lib/firebase.client";
import s from "./AdminShell.module.css";

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  envLabel?: string;
};

export default function AdminShell({
  children,
  title = "Admin Panel",
  subtitle = "Yönetim merkezi",
  envLabel = "Prod",
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const onResize = () => {
      if (window.innerWidth >= 1180) setOpen(false);
    };

    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("sb-open", open);
    document.body.classList.toggle("sb-open", open);

    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.documentElement.classList.remove("sb-open");
      document.body.classList.remove("sb-open");
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-expect-error debug globals
    window.__auth = getFirebaseAuth();
    // @ts-expect-error debug globals
    window.__app = getFirebaseApp();
  }, []);

  const todayText = useMemo(() => {
    try {
      return new Date().toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  }, []);

  return (
    <div className={s.adminRoot}>
      <button
        type="button"
        className={`${s.backdrop} ${open ? s.backdropOpen : ""}`}
        onClick={() => setOpen(false)}
        aria-label="Menüyü kapat"
      />

      <aside className={`${s.sidebarWrap} ${open ? s.sidebarWrapOpen : ""}`}>
        <AdminSidebar onNavigate={() => setOpen(false)} />
      </aside>

      <div className={s.adminMain}>
        <header className={s.topbar}>
          <div className={s.topbarLeft}>
            <button
              type="button"
              className={s.menuBtn}
              onClick={() => setOpen((v) => !v)}
              aria-label="Menü"
            >
              <span className={s.menuIcon}>☰</span>
            </button>

            <div className={s.titleGroup}>
              <div className={s.eyebrow}>DROMOCOB • ADMIN</div>
              <h1 className={s.topbarTitle}>{title}</h1>
              <p className={s.topbarSub}>{subtitle}</p>
            </div>
          </div>

          <div className={s.topbarRight}>
            <div className={s.infoPill}>
              <span className={s.infoLabel}>Tarih</span>
              <span className={s.infoValue}>{todayText || "—"}</span>
            </div>

            <div className={`${s.envPill} ${envLabel.toLowerCase() === "prod" ? s.envProd : s.envOther}`}>
              {envLabel}
            </div>
          </div>
        </header>

        <main className={s.adminContent}>{children}</main>
      </div>
    </div>
  );
}