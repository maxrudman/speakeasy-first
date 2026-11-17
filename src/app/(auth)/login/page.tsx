import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mb-8 mt-2 text-[15px] text-muted">Pick up your vocabulary and practice where you left off.</p>
      {expired && (
        <div className="mb-6">
          <Notice>Your session ended. Log in again to continue.</Notice>
        </div>
      )}
      <AuthForm mode="login" />
    </>
  );
}
