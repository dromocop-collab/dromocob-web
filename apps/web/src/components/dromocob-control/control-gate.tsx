/**
 * Dromocob ControlGate — Server Component
 *
 * Merkezi kontrol durumuna göre siteyi açar, bakım ekranı
 * veya devre dışı ekranı gösterir.
 *
 * Bu component root layout'ta mevcut MaintenanceGate'in
 * ÜSTÜNE sarılır. Böylece:
 * - Dromocob "disabled/maintenance" → site hiç render olmaz
 * - Dromocob "active" → mevcut MaintenanceGate (client-side) devreye girer
 */
import type { ReactNode } from "react";
import { getControlStatus } from "@/lib/dromocob-control";
import DisabledScreen from "@/components/dromocob-control/disabled-screen";
import MaintenanceScreen from "@/components/dromocob-control/maintenance-screen";

export default async function ControlGate({
  children,
}: {
  children: ReactNode;
}) {
  const status = await getControlStatus();

  if (status === "maintenance") {
    return <MaintenanceScreen />;
  }

  if (status === "disabled") {
    return <DisabledScreen />;
  }

  return <>{children}</>;
}
