import type { ReactNode } from "react";
import StudioFooter from "@/components/studio/StudioFooter";
import StudioHeader from "@/components/studio/StudioHeader";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <StudioHeader />
      <main style={{ minHeight: "80vh" }}>{children}</main>
      <StudioFooter />
    </>
  );
}
