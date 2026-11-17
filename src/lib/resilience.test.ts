import { describe, expect, it, vi } from "vitest";
import { backoffDelay, CircuitBreaker, isRetryable, ProviderError, retry, TimeoutError, withTimeout } from "./resilience";

describe("backoffDelay", () => {
  it("doubles each attempt and caps", () => {
    const mid = () => 0.5; // no jitter
    expect(backoffDelay(1, 400, 4000, mid)).toBe(400);
    expect(backoffDelay(2, 400, 4000, mid)).toBe(800);
    expect(backoffDelay(3, 400, 4000, mid)).toBe(1600);
    expect(backoffDelay(10, 400, 4000, mid)).toBe(4000);
  });
  it("adds at most ±25% jitter", () => {
    expect(backoffDelay(1, 400, 4000, () => 0)).toBe(300);
    expect(backoffDelay(1, 400, 4000, () => 1)).toBe(500);
  });
});

describe("isRetryable", () => {
  it("retries 429, 5xx, timeouts and network errors only", () => {
    expect(isRetryable(new ProviderError("x", true, 429))).toBe(true);
    expect(isRetryable(new ProviderError("x", false, 400))).toBe(false);
    expect(isRetryable(new TimeoutError("x", 1))).toBe(true);
    expect(isRetryable(Object.assign(new Error("x"), { status: 503 }))).toBe(true);
    expect(isRetryable(Object.assign(new Error("x"), { status: 401 }))).toBe(false);
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
  });
});

describe("retry", () => {
  it("retries retryable errors and then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new ProviderError("busy", true, 429)).mockResolvedValue("ok");
    await expect(retry(fn, { retries: 2, baseMs: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderError("bad", false, 400));
    await expect(retry(fn, { retries: 3, baseMs: 1 })).rejects.toThrow("bad");
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("gives up after the retry budget", async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderError("down", true, 500));
    await expect(retry(fn, { retries: 2, baseMs: 1 })).rejects.toThrow("down");
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("withTimeout", () => {
  it("rejects with TimeoutError and aborts the signal", async () => {
    let aborted = false;
    const p = withTimeout("slow", 20, (signal) => new Promise((r) => signal.addEventListener("abort", () => ((aborted = true), r("late")))));
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
    expect(aborted).toBe(true);
  });
  it("passes through fast results", async () => {
    await expect(withTimeout("fast", 1000, async () => 42)).resolves.toBe(42);
  });
});

describe("CircuitBreaker", () => {
  it("opens after the threshold, then half-opens after the cooldown", () => {
    let now = 0;
    const b = new CircuitBreaker("t", 3, 1000, () => now);
    b.failure();
    b.failure();
    expect(b.isOpen).toBe(false);
    b.failure();
    expect(b.isOpen).toBe(true);
    now = 999;
    expect(b.isOpen).toBe(true);
    now = 1000;
    expect(b.isOpen).toBe(false); // one trial request allowed
    b.failure();
    expect(b.isOpen).toBe(true); // failed trial re-opens immediately
    now = 2500;
    expect(b.isOpen).toBe(false);
    b.success();
    b.failure();
    expect(b.isOpen).toBe(false);
  });
});
