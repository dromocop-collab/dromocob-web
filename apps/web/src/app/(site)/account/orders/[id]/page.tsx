// apps/web/src/app/(site)/account/orders/[id]/page.tsx
import OrderDetailClient from "@/components/account/OrderDetailClient";

export default function Page({ params }: { params: { id: string } }) {
  return <OrderDetailClient id={decodeURIComponent(params.id || "")} />;
}