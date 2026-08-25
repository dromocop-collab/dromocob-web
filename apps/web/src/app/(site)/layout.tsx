import AppHeader from "@/components/header/AppHeader";
import CategoryBarMega from "@/components/partials/CategoryBarMega";
import AppFooter from "@/components/partials/AppFooter";
import ChatWidget from "@/components/ChatWidget/ChatWidget";
import MaintenanceGate from "@/components/system/MaintenanceGate";
import FloatingButtons from "@/components/FloatingButtons";
import CartAbandonGuard from "@/components/CartAbandonGuard";
import PresenceTracker from "@/components/PresenceTracker";
import MobileAppCampaign from "@/components/mobile-app/MobileAppCampaign";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* GA4 / GTM root layout'ta zaten yükleniyor, burada tekrar yükleme */}

      <MaintenanceGate>

        <AppHeader />

        <CategoryBarMega />

        {children}

        <ChatWidget loc="tr" />

        <FloatingButtons />

        <CartAbandonGuard />

        <PresenceTracker />

        <AppFooter />

        <MobileAppCampaign />

      </MaintenanceGate>
    </>
  );
}
