"use client";

import { usePathname } from "next/navigation";
import ProfessionalSidebar from "@/src/components/dashboard/ProfessionalSidebar";

export default function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/profesional/login";

  if (isLogin) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-cream">
      <ProfessionalSidebar />
      <main className="md:ml-56 flex-1 pt-14 pb-14 md:pt-0 md:pb-0">{children}</main>
    </div>
  );
}
