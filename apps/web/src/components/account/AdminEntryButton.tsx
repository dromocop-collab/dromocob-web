"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase.client";
import styles from "@/styles/admin-entry-button.module.css";

export default function AdminEntryButton() {
  const [canEnterAdmin, setCanEnterAdmin] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();

    const unsub = onAuthStateChanged(auth, async (user) => {
      setReady(false);
      setCanEnterAdmin(false);

      try {
        if (!user || user.isAnonymous) {
          setCanEnterAdmin(false);
          return;
        }

        let allowed = false;

        const uid = String(user.uid || "").trim();
        const emailLower = String(user.email || "").trim().toLowerCase();

        // 1) users/{uid}
        if (uid) {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            const data = userSnap.data() as any;
            const role = String(data?.role || "").trim().toLowerCase();
            const isActive = data?.isActive !== false;

            if (isActive && (role === "admin" || role === "sub_admin")) {
              allowed = true;
            }
          }
        }

        // 2) legacy admins/{email}
        if (!allowed && emailLower) {
          const adminSnap = await getDoc(doc(db, "admins", emailLower));
          if (adminSnap.exists()) {
            const data = adminSnap.data() as any;
            if (data?.enabled === true) {
              allowed = true;
            }
          }
        }

        setCanEnterAdmin(allowed);
      } catch (err) {
        console.error("AdminEntryButton admin check error:", err);
        setCanEnterAdmin(false);
      } finally {
        setReady(true);
      }
    });

    return () => unsub();
  }, []);

  if (!ready || !canEnterAdmin) return null;

  return (
    <Link
      href="/admin"
      className={styles.adminBtn}
      aria-label="Admin Panel"
      title="Admin Panel"
    >
      <span className={styles.icon} aria-hidden="true">
        🛡️
      </span>
      <span className={styles.text}>Admin Panel</span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </Link>
  );
}