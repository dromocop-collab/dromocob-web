"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";

type State =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "forbidden"; email?: string | null; reason?: string }
  | { status: "ok"; uid: string; email?: string | null };

function normEmail(v?: string | null) {
  const s = (v ?? "").trim().toLowerCase();
  return s.length ? s : null;
}

export default function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();

    let alive = true;

    const safeSet = (s: State) => {
      if (alive) setState(s);
    };

    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          safeSet({ status: "guest" });
          return;
        }

        const email = normEmail(u.email);

        // 1) legacy admins/{email}
        if (email) {
          try {
            const aRef = doc(db, "admins", email);
            const aSnap = await getDoc(aRef);
            const enabled = aSnap.exists() && aSnap.data()?.enabled === true;

            if (enabled) {
              safeSet({ status: "ok", uid: u.uid, email });
              return;
            }
          } catch (e) {
            console.warn("[AdminGate] admins/{email} read failed:", e);
          }
        }

        // 2) users/{uid}.role === admin | sub_admin
        try {
          const uRef = doc(db, "users", u.uid);
          const uSnap = await getDoc(uRef);

          if (uSnap.exists()) {
            const data = uSnap.data() as any;
            const role = String(data?.role || "").trim();
            const isActive = data?.isActive !== false;

            if (
              isActive &&
              (role === "admin" || role === "sub_admin")
            ) {
              safeSet({ status: "ok", uid: u.uid, email });
              return;
            }
          }
        } catch (e) {
          console.warn("[AdminGate] users/{uid} read failed:", e);
        }

        safeSet({
          status: "forbidden",
          email,
          reason: "No admin record found (admins/{email} or users/{uid}.role).",
        });
      } catch (e) {
        console.error("[AdminGate] unexpected error:", e);
        safeSet({
          status: "forbidden",
          email: normEmail(u?.email),
          reason: "Unexpected error",
        });
      }
    });

    return () => {
      alive = false;
      unsub();
    };
  }, []);

  if (state.status === "loading") return <div style={box}>Yükleniyor…</div>;

  if (state.status === "guest") {
    return (
      <div style={box}>
        Admin’e girmek için önce giriş yapman lazım. <br />
        <b>/login</b> sayfasından giriş yap.
      </div>
    );
  }

  if (state.status === "forbidden") {
    return (
      <div style={box}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Yetki yok</div>
        Bu kullanıcı admin değil: <b>{state.email ?? "-"}</b>
        {state.reason ? (
          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>{state.reason}</div>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}

const box: React.CSSProperties = {
  maxWidth: 520,
  margin: "48px auto",
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 16,
  padding: 16,
  fontWeight: 650,
};