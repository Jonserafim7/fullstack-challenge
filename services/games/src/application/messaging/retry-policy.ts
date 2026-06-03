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
