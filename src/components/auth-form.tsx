"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button, ErrorNote, TextField } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isSignup && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", body: { username, password } });
      router.replace("/vocabulary");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        hint={isSignup ? "3–32 characters: letters, numbers, dots, dashes or underscores." : undefined}
        required
      />
      <TextField
        label="Password"
        type="password"
        autoComplete={isSignup ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        hint={isSignup ? "At least 8 characters." : undefined}
        required
      />
      {isSignup && (
        <TextField
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      )}
      {error && <ErrorNote message={error} />}
      <Button type="submit" loading={loading} className="w-full">
        {isSignup ? "Create account" : "Log in"}
      </Button>
      <p className="text-center text-sm text-muted">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-pine underline-offset-2 hover:underline">
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
