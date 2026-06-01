// Backoff schedule for a transiently-failed inbound message (ADR-0001's retry-with-backoff before
// the DLQ). Pure and deterministic so the decision is unit-tested away from the broker; the
// decorated consumer only applies it. `attempt` is how many times the message has already been
// retried (0 on the first failure, read from the `x-retry-count` header). The delay grows
// exponentially; once `attempt` reaches `maxAttempts` the message is poison and is dead-lettered.

export interface RetryDecision {
  shouldRetry: boolean;
  delayMs: number;
  nextAttempt: number;
}

export function nextRetry({
  attempt,
  baseMs,
  maxAttempts,
}: {
  attempt: number;
  baseMs: number;
  maxAttempts: number;
}): RetryDecision {
  return {
    shouldRetry: attempt < maxAttempts,
    delayMs: baseMs * 2 ** attempt,
    nextAttempt: attempt + 1,
  };
}
