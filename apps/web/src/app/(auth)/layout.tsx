import type { ReactNode } from "react";
import AppHeader from "@/components/header/AppHeader";
import "@/components/admin/ui/toast.css";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      <main style={{ minHeight: "100vh" }}>{children}</main>
    </>
  );
}