"use client";

import type { ReactNode } from "react";
import styles from "@/styles/auth.module.css";

export default function AccountShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.accountPage}>
      <div className={styles.accountContainer}>{children}</div>
    </main>
  );
}