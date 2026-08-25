"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  LogIn,
  Menu,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import ProjectBriefModal from "./ProjectBriefModal";
import s from "./studioChrome.module.css";

export default function StudioHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <header className={`${s.header} ${scrolled ? s.scrolled : ""} ${menuOpen ? s.menuActive : ""}`}>
        <div className={s.ambient} aria-hidden="true" />
        <div className={s.headerInner}>
          <Link href="/" className={s.brand} onClick={closeMenu} aria-label="Dromocob ana sayfa">
            <span className={s.brandMark}>D<i /></span>
            <span className={s.brandWords}>
              <b>DROMOCOB</b>
              <small>DIGITAL EXPERIENCE STUDIO</small>
            </span>
          </Link>

          <nav className={`${s.nav} ${menuOpen ? s.navOpen : ""}`} aria-label="Ana menü">
            <div className={s.mobileNavTop}>
              <span>MENÜ / DROMOCOB</span>
              <button type="button" onClick={closeMenu} aria-label="Menüyü kapat"><X /></button>
            </div>
            <Link href="/#tasarimlar" onClick={closeMenu}>Tasarımlar <span>01</span></Link>
            <Link href="/sektorler" onClick={closeMenu}>Sektörler <ChevronDown /><span>02</span></Link>
            <Link href="/hakkimizda" onClick={closeMenu}>Stüdyo <span>03</span></Link>
            <Link href="/iletisim" onClick={closeMenu}>İletişim <span>04</span></Link>
            <div className={s.mobileAuth}>
              <Link href="/login" onClick={closeMenu}><LogIn /> Giriş yap</Link>
              <Link href="/register" onClick={closeMenu}><UserPlus /> Kayıt ol</Link>
              <button type="button" onClick={() => { closeMenu(); setBriefOpen(true); }}>
                <Sparkles /> Proje başlat <ArrowUpRight />
              </button>
            </div>
          </nav>

          <div className={s.actions}>
            <Link className={s.login} href="/login"><LogIn /> Giriş yap</Link>
            <Link className={s.register} href="/register"><UserPlus /> Kayıt ol</Link>
            <button className={s.project} type="button" onClick={() => setBriefOpen(true)}>
              <Sparkles /> <span>Proje başlat</span> <ArrowUpRight />
            </button>
            <button className={s.menuButton} type="button" onClick={() => setMenuOpen(true)} aria-label="Menüyü aç">
              <Menu />
            </button>
          </div>
        </div>
      </header>
      <ProjectBriefModal open={briefOpen} onClose={() => setBriefOpen(false)} />
    </>
  );
}
