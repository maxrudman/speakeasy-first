"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PreferencesForm, type Preferences } from "@/components/vocabulary/preferences-form";
import { Button, ErrorNote, Notice, PageHeader, TextField } from "@/components/ui";
import { api } from "@/lib/client-api";

export function AccountView({ username, preferences }: { username: string; preferences: Preferences | null }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <PageHeader eyebrow="Settings" title="Account" description={`Signed in as ${username}.`} />

      <div className="space-y-6">
        <Link
          href="/secretary"
          className="btn-pop flex items-center justify-between gap-4 rounded-2xl bg-sun-soft px-5 py-4 md:hidden"
        >
          <span>
            <span className="block font-display text-lg font-extrabold">Personal Secretary</span>
            <span className="mt-0.5 block text-sm text-muted">Send your SpeakEasy XP to your secretary app.</span>
          </span>
          <span aria-hidden="true" className="text-xl">
            ›
          </span>
        </Link>
        <Section title="Vocabulary preferences" description="These shape which new terms you get.">
          {preferences ? (
            <PreferencesForm initial={preferences} submitLabel="Save preferences" onSaved={() => router.refresh()} />
          ) : (
            <p className="text-[15px] text-muted">Open Vocabulary to answer three quick setup questions first.</p>
          )}
        </Section>

        <Section title="Change password">
          <ChangePasswordForm />
        </Section>

        <Section title="Log out" description="You'll need your username and password to log back in.">
          <Button variant="secondary" onClick={logout} loading={loggingOut}>
            Log out
          </Button>
        </Section>
      </div>
    </>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card-pop rounded-2xl bg-surface p-6">
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) return setError("New passwords don't match.");
    setLoading(true);
    try {
      await api("/api/account/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm space-y-4">
      <TextField label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <TextField label="New password" type="password" autoComplete="new-password" hint="At least 8 characters." value={next} onChange={(e) => setNext(e.target.value)} />
      <TextField label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      {error && <ErrorNote message={error} />}
      {done && <Notice>Password changed.</Notice>}
      <Button type="submit" loading={loading}>
        Change password
      </Button>
    </form>
  );
}
