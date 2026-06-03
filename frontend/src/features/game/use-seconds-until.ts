import { useEffect, useState } from "react";

export function useSecondsUntil(target: string | null): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!target) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const remainingMs = new Date(target).getTime() - Date.now();
      setSecondsLeft(Math.max(0, remainingMs / 1000));
    };
    tick();
    const intervalId = setInterval(tick, 200);
    return () => clearInterval(intervalId);
  }, [target]);

  return secondsLeft;
}
