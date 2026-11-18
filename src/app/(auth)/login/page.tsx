import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mb-8 mt-2 text-[15px] text-muted">Pick up your vocabulary and practice where you left off.</p>
      <AuthForm mode="login" />
    </>
  );
}
