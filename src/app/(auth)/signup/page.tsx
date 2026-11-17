import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a free Speak Ready account with just a username and password. Learn words for your field, practice answers out loud and get feedback from an AI coach.",
  alternates: { canonical: "/signup" },
};

export default function SignupPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-8 mt-2 text-[15px] text-muted">
        Learn words that fit your field, practice answers out loud, and keep a journal of your best responses.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
