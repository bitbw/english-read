import { headers } from "next/headers";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
// import { BottomNav } from "@/components/layout/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const userAgent = hdrs.get("user-agent") ?? "";
  const isApp = userAgent.includes("EnglishRead-App");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar isApp={isApp} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      {/* <BottomNav /> */}
    </div>
  );
}
