import { OfflineBanner } from "@/components/error-state";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <OfflineBanner />
      <div className="w-full max-w-sm">
        <Logo className="mb-8 text-xl" />
        {children}
      </div>
    </main>
  );
}
