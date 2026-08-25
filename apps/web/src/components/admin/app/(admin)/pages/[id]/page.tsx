"use client";

import AdminGate from "@/components/AdminGate";
import PermissionGate from "@/components/admin/PermissionGate";
import BuilderScreen from "../builder/BuilderScreen";

export default function AdminPageBuilderRoute({
  params,
}: {
  params: { id: string };
}) {
  return (
    <AdminGate>
      <PermissionGate permission="pages_admin">
        <BuilderScreen params={params} />
      </PermissionGate>
    </AdminGate>
  );
}