import { Pedometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';

/**
 * Licznik kroków na czas nagrywania trasy.
 * - Kroki liczą się tylko, gdy `active` = true (pauza je zatrzymuje).
 * - `steps` = null, gdy telefon/aplikacja nie ma krokomierza
 *   (np. Android w Expo Go) – wtedy szacujemy kroki z dystansu.
 */
export function useStepCounter(active: boolean) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [base, setBase] = useState(0);
  const [current, setCurrent] = useState(0);
  const currentRef = useRef(0);

  // Pytamy o uprawnienie dopiero przy pierwszym nagrywaniu.
  useEffect(() => {
    if (!active || available !== null) return;
    let alive = true;
    (async () => {
      try {
        const ok = await Pedometer.isAvailableAsync();
        if (!ok) return alive && setAvailable(false);
        const perm = await Pedometer.requestPermissionsAsync();
        if (alive) setAvailable(perm.granted);
      } catch {
        if (alive) setAvailable(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [active, available]);

  useEffect(() => {
    if (!active || !available) return;
    currentRef.current = 0;
    setCurrent(0);
    const sub = Pedometer.watchStepCount((r) => {
      currentRef.current = r.steps;
      setCurrent(r.steps);
    });
    return () => {
      sub.remove();
      const done = currentRef.current;
      currentRef.current = 0;
      setBase((b) => b + done);
      setCurrent(0);
    };
  }, [active, available]);

  return {
    steps: available ? base + current : null,
    available,
    reset: () => {
      setBase(0);
      setCurrent(0);
      currentRef.current = 0;
    },
    /** Przywrócenie kroków z niedokończonego nagrania. */
    restore: (n: number) => setBase(n),
  };
}
