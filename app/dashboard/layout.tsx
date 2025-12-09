import type React from "react";
import DashboardSidebar from "@/components/dashboard-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
