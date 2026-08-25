"use client";

import type { ReactNode } from "react";
import "@/components/admin/admin.css";

import AdminGate from "@/components/admin/AdminGate";
import AdminShell from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGate>
      <AdminShell
        title="Admin Panel"
        subtitle="Ürün • kategori • sipariş • ayarlar"
        
      >
        {children}
      </AdminShell>
    </AdminGate>
  );
}