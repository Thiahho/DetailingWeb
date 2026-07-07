"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "@/src/components/dashboard/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";

  if (isLogin) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-cream">
      <AdminSidebar />
      <main className="md:ml-56 flex-1 pt-14 pb-14 md:pt-0 md:pb-0">{children}</main>
    </div>
  );
}
