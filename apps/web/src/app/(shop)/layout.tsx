import type { ReactNode } from "react";
import StudioHeader from "@/components/studio/StudioHeader";
import StudioFooter from "@/components/studio/StudioFooter";
import "@/components/admin/ui/toast.css";
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StudioHeader />
      <div style={{ minHeight: "calc(100vh - 120px)" }}>{children}</div>
      <StudioFooter />
    </>
  );
}
