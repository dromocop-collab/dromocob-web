"use client";

import { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import s from "./AdminGate.module.css";

type GateState =
  | { status: "loading" }
  | { status: "signedOut" }
  | {
      status: "signedIn";
      user: User;
      isAdmin: boolean;
      role: "admin" | "sub_admin" | "member" | null;
      emailLower?: string | null;
    }
  | { status: "error"; message: string };

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const auth = useMemo(() => getFirebaseAuth(), []);
  const db = useMemo(() => getFirebaseDb(), []);

  const [state, setState] = useState<GateState>({ status: "loading" });

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [authNote, setAuthNote] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setState({ status: "signedOut" });
          return;
        }

        const emailLower = (u.email ?? "").trim().toLowerCase() || null;

        let isAdmin = false;
        let role: "admin" | "sub_admin" | "member" | null = null;

        // 1) legacy admins/{email}.enabled
        if (emailLower) {
          const aRef = doc(db, "admins", emailLower);
          const aSnap = await getDoc(aRef);
          if (aSnap.exists() && aSnap.data()?.enabled === true) {
            isAdmin = true;
            role = "admin";
          }
        }

        // 2) users/{uid}.role
        const uRef = doc(db, "users", u.uid);
        const uSnap = await getDoc(uRef);

        if (uSnap.exists()) {
          const data = uSnap.data() as any;
          const rawRole = String(data?.role || "").trim();
          const isActive = data?.isActive !== false;

          if (rawRole === "admin" && isActive) {
            isAdmin = true;
            role = "admin";
          } else if (rawRole === "sub_admin" && isActive) {
            isAdmin = true;
            role = "sub_admin";
          } else {
            role = "member";
          }
        }

        setState({
          status: "signedIn",
          user: u,
          isAdmin,
          role,
          emailLower,
        });
      } catch (e: any) {
        setState({ status: "error", message: String(e?.message ?? e) });
      }
    });

    return () => unsub();
  }, [auth, db]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAuthNote("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      setAuthNote(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await signOut(auth);
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "loading") {
    return (
      <div className={s.page}>
        <div className={s.centerWrap}>
          <div className={s.loadingCard}>
            <div className={s.loader} />
            <div className={s.loadingText}>Admin kontrol ediliyor…</div>
            <div className={s.loadingSub}>Yetki, rol ve erişim doğrulanıyor.</div>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={s.page}>
        <div className={s.centerWrap}>
          <div className={s.errorCard}>
            <div className={s.errorKicker}>Sistem Hatası</div>
            <h2 className={s.errorTitle}>AdminGate hata verdi</h2>
            <div className={s.errorText}>{state.message}</div>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "signedOut") {
    return (
      <div className={s.page}>
        <div className={s.centerWrap}>
          <div className={s.loginShell}>
            <div className={s.loginHero}>
              <div className={s.heroBadge}>6</div>

              <div className={s.heroCopy}>
                <div className={s.heroKicker}>PREMIUM ADMIN ACCESS</div>
                <h1 className={s.heroTitle}>Admin Girişi</h1>
                <p className={s.heroText}>
                  Ürün, kategori, sipariş, kur ve içerik yönetimi için yetkili hesapla giriş yap.
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className={s.loginCard}>
              <div className={s.cardHead}>
                <div>
                  <div className={s.cardKicker}>Kimlik Doğrulama</div>
                  <h2 className={s.cardTitle}>Panele giriş yap</h2>
                </div>
              </div>

              {authNote ? <div className={s.inlineError}>{authNote}</div> : null}

              <label className={s.field}>
                <span className={s.label}>E-posta</span>
                <input
                  className={s.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@firma.com"
                  autoComplete="email"
                />
              </label>

              <label className={s.field}>
                <span className={s.label}>Şifre</span>
                <input
                  className={s.input}
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </label>

              <button disabled={busy} className={s.primaryBtn} type="submit">
                {busy ? "Giriş yapılıyor…" : "Giriş yap"}
              </button>

              <div className={s.loginInfo}>
                Admin kontrolü:
                <code> admins/&lt;email&gt;.enabled </code>
                veya
                <code> users/&lt;uid&gt;.role = admin | sub_admin </code>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (!state.isAdmin) {
    return (
      <div className={s.page}>
        <div className={s.centerWrap}>
          <div className={s.deniedCard}>
            <div className={s.deniedIcon}>⛔</div>
            <div className={s.deniedKicker}>Erişim Reddedildi</div>
            <h2 className={s.deniedTitle}>Bu kullanıcı admin paneline giremez</h2>

            <div className={s.deniedMeta}>
              <div className={s.metaRow}>
                <span>Kullanıcı</span>
                <b>{state.user.email ?? state.user.uid}</b>
              </div>
              <div className={s.metaRow}>
                <span>Rol</span>
                <b>{state.role ?? "yok"}</b>
              </div>
            </div>

            <button className={s.primaryBtn} disabled={busy} onClick={handleLogout} type="button">
              Çıkış yap
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel =
    state.role === "admin"
      ? "Admin"
      : state.role === "sub_admin"
      ? "Sub Admin"
      : "Member";

  return (
    <div className={s.wrap}>
      <div className={s.topCard}>
        <div className={s.topLeft}>
          <div className={s.topMark}>6</div>

          <div className={s.topCopy}>
            <div className={s.topKicker}>CONTROL PANEL</div>
            <h1 className={s.topTitle}>Admin Panel</h1>

            <div className={s.topMeta}>
              <span>{state.user.email ?? state.user.uid}</span>
              <span className={s.dot} />
              <span>{roleLabel}</span>
            </div>
          </div>
        </div>

        <div className={s.topRight}>
          <span
            className={`${s.roleBadge} ${
              state.role === "admin" ? s.roleAdmin : s.roleSubAdmin
            }`}
          >
            {roleLabel}
          </span>

          <button className={s.logoutBtn} disabled={busy} onClick={handleLogout} type="button">
            {busy ? "Çıkılıyor…" : "Çıkış"}
          </button>
        </div>
      </div>

      <div className={s.content}>{children}</div>
    </div>
  );
}