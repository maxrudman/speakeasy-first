"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

/* ----------------------------------- Button ----------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** Deck-style buttons: primary is a yellow "sticker" with an indigo outline and hard shadow. */
const buttonStyles: Record<ButtonVariant, string> = {
  primary: "btn-pop bg-sun text-[#221a4d] font-semibold",
  secondary: "btn-pop bg-surface text-ink font-semibold",
  ghost: "text-muted hover:text-ink hover:bg-lilac-soft",
  danger: "btn-pop bg-coral text-white font-semibold dark:text-paper",
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
  const sizing = size === "sm" ? "h-9 px-3.5 text-sm" : "h-11 px-5 text-[15px]";
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${buttonStyles[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}

/* --------------------------------- Form fields -------------------------------- */

const inputBase =
  "w-full rounded-xl border-2 border-line bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-muted/70 focus:border-edge focus:outline-none focus:ring-4 focus:ring-sun/50";

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
    <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border-2 border-coral/40 bg-coral-soft px-3 py-2.5 text-sm text-coral">
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
  return <p className="rounded-xl border-2 border-pine/30 bg-pine-soft px-3 py-2 text-sm text-pine-strong">{children}</p>;
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
      className={`card-pop m-auto w-[min(92vw,28rem)] rounded-2xl bg-surface p-0 text-ink backdrop:bg-indigo/50 backdrop:backdrop-blur-sm ${className}`}
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="font-display text-xl font-bold">
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

export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Small yellow pill above the title, like the deck's section labels. */
  eyebrow?: string;
}) {
  return (
    <header className="mb-8 flex items-start justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-3 inline-block rounded-full bg-sun px-3 py-1 text-xs font-bold tracking-[0.12em] text-[#221a4d] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-[2.1rem] leading-[1.05] font-extrabold tracking-tight sm:text-[2.75rem]">{title}</h1>
        {description && <p className="mt-2.5 max-w-prose text-[15px] text-muted sm:text-base">{description}</p>}
      </div>
      {action}
    </header>
  );
}
