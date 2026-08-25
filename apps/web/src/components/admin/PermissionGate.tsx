"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import type { AdminPermissions } from "@/lib/adminTypes";

type PermissionKey = keyof AdminPermissions;

type State =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "forbidden"; email?: string | null; reason?: string }
  | { status: "ok" };

function normEmail(v?: string | null) {
  const s = (v ?? "").trim().toLowerCase();
  return s.length ? s : null;
}

export default function PermissionGate({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: ReactNode;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    let alive = true;

    const safeSet = (next: State) => {
      if (alive) setState(next);
    };

    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          safeSet({ status: "guest" });
          return;
        }

        const email = normEmail(user.email);

        // legacy tam admin
       if (email) {

  try {

   

    const adminSnap = await getDoc(doc(db, "admins", email));

  

   

    if (adminSnap.exists() && adminSnap.data()?.enabled === true) {

      safeSet({ status: "ok" });

      return;

    }

  } catch (e) {

    console.warn("[PermissionGate] admins read failed:", e);

  }

}

        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) {
          safeSet({
            status: "forbidden",
            email,
            reason: "Kullanıcı kaydı bulunamadı.",
          });
          return;
        }

        const data = userSnap.data() as any;
        const role = String(data?.role || "").trim();
        const isActive = data?.isActive !== false;
        const permissions = (data?.permissions || {}) as Partial<AdminPermissions>;

        if (!isActive) {
          safeSet({
            status: "forbidden",
            email,
            reason: "Kullanıcı pasif durumda.",
          });
          return;
        }

        // tam admin her yere girsin
        if (role === "admin") {
          safeSet({ status: "ok" });
          return;
        }

        // sub admin için tek tek izin kontrolü
        if (role === "sub_admin" && permissions?.[permission] === true) {
          safeSet({ status: "ok" });
          return;
        }

        safeSet({
          status: "forbidden",
          email,
          reason: `Bu alan için yetkin yok: ${permission}`,
        });
      } catch (e) {
        console.error("[PermissionGate] unexpected error:", e);
        safeSet({
          status: "forbidden",
          reason: "Yetki kontrolünde beklenmeyen hata.",
        });
      }
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [permission]);

  if (state.status === "loading") return <div style={box}>Yetki kontrol ediliyor…</div>;

  if (state.status === "guest") {
    return <div style={box}>Bu alanı görmek için giriş yapman gerekiyor.</div>;
  }

  if (state.status === "forbidden") {
    return (
      <div style={box}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Bu alana erişim yok</div>
        <div>{state.email ? <b>{state.email}</b> : "Kullanıcı"} için izin bulunamadı.</div>
        {state.reason ? (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.72 }}>{state.reason}</div>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}

const box: React.CSSProperties = {
  maxWidth: 620,
  margin: "48px auto",
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 16,
  padding: 18,
  fontWeight: 650,
};