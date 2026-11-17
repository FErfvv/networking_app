import { BottomNav, Sidebar } from "@/components/layout/app-nav";

/**
 * Authenticated app shell. Static (no session read) so it prerenders into
 * the instant shell; the proxy redirects signed-out users, and each page's
 * data loader re-verifies the session.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-5xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 md:pt-8 md:pb-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
