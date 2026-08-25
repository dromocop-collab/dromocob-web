"use client";

import type { ReactNode } from "react";
import StudioHeader from "@/components/studio/StudioHeader";
import StudioFooter from "@/components/studio/StudioFooter";
import "@/components/admin/ui/toast.css";
import MaintenanceGate from "@/components/system/MaintenanceGate";
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
    <MaintenanceGate>
      <StudioHeader />
      
      <main style={{ minHeight: "calc(100vh - 120px)" }}>{children}</main>

      <StudioFooter />
      </MaintenanceGate>
    </>
  );
}
