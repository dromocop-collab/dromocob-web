import StudioFooter from "@/components/studio/StudioFooter";
import StudioHeader from "@/components/studio/StudioHeader";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StudioHeader />
      <main>{children}</main>
      <StudioFooter />
    </>
  );
}
