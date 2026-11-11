"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/* ----------------------------------- Button ----------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-pine text-white hover:bg-pine-strong dark:text-paper",
  secondary: "bg-surface text-ink border border-line hover:border-muted",
  ghost: "text-muted hover:text-ink hover:bg-line/40",
  danger: "bg-coral text-white hover:opacity-90 dark:text-paper",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}) {
  const sizing = size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-[15px]";
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

/* --------------------------------- Form fields -------------------------------- */

const inputBase =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-muted/70 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

export function TextField({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input id={id} className={`${inputBase} h-10`} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea id={id} className={`${inputBase} min-h-24 leading-relaxed`} {...props} />
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function SelectField({
  label,
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: readonly string[] }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select id={id} className={`${inputBase} h-10`} {...props}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ---------------------------------- Feedback ---------------------------------- */

export function Spinner({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start justify-between gap-3 rounded-lg bg-coral-soft px-3 py-2.5 text-sm text-coral">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="shrink-0 font-medium underline underline-offset-2">
          Try again
        </button>
      )}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-pine-soft px-3 py-2 text-sm text-pine-strong">{children}</p>;
}

/* ----------------------------------- Dialog ----------------------------------- */

/** Accessible modal built on the native <dialog> element (focus trap + Esc for free). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto w-[min(92vw,28rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/30 ${className}`}
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {title}
          </h2>
          <div className="mt-3">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} title={title}>
      <p className="text-[15px] text-muted">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/* ------------------------------------ Page ------------------------------------ */

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.25rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-prose text-[15px] text-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}
