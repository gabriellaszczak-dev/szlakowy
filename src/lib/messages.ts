// Miłe wiadomości na koniec trasy – dobierane do tego, jak poszło.

type FinishStats = {
  distanceM: number;
  elevationGainM: number;
  steps: number;
  durationS: number;
  weekDoneM: number;
  weekGoalM: number;
};

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export function finishMessage(name: string, s: FinishStats): { title: string; body: string } {
  const km = s.distanceM / 1000;
  const reachedGoalNow = s.weekDoneM < s.weekGoalM && s.weekDoneM + s.distanceM >= s.weekGoalM;
  const h = new Date().getHours();

  if (reachedGoalNow) {
    return {
      title: `Cel tygodnia zdobyty, ${name}! 🏆`,
      body: 'Ta trasa przypieczętowała cały tydzień. Należy Ci się dobra kolacja.',
    };
  }
  if (s.elevationGainM >= 600) {
    return {
      title: pick(['Prawdziwy góral! 🏔️', 'Ale podejścia! 💪', 'Nogi to zapamiętają! 🦵']),
      body: `${Math.round(s.elevationGainM)} m w górę to kawał roboty. Widoki chyba były tego warte?`,
    };
  }
  if (km >= 15) {
    return {
      title: pick(['Co za wyprawa! 🎒', 'Dystans robi wrażenie! 🚀']),
      body: `${km.toFixed(1).replace('.', ',')} km – dzisiaj był naprawdę super dzień, ${name}.`,
    };
  }
  if (s.steps >= 10_000) {
    return {
      title: 'Ponad 10 000 kroków! 👣',
      body: 'Dzienny cel zaliczony z nawiązką. Dobra trasa!',
    };
  }
  if (h >= 18 || h < 5) {
    return {
      title: pick(['Piękne zakończenie dnia 🌙', 'Wieczorny spacer zaliczony ✨']),
      body: `Dobra robota, ${name}. Teraz czas odpocząć.`,
    };
  }
  if (km < 2) {
    return {
      title: pick(['Każdy krok się liczy 🌱', 'Dobry początek! 🙂']),
      body: 'Krótko, ale w ruchu – a to najważniejsze. Następnym razem trochę dalej?',
    };
  }
  return {
    title: pick([
      `Dzisiaj był super dzień, ${name}! ☀️`,
      'Dobra trasa! 🥾',
      'Brawo, trasa zaliczona! 🎉',
      'Świetnie Ci poszło! ⛰️',
    ]),
    body: pick([
      'Góry dziękują za odwiedziny. Do zobaczenia na szlaku!',
      'Świeże powietrze, zmęczone nogi, czysta głowa – idealnie.',
      'Zapisz trasę i wracaj tu, kiedy zatęsknisz za szlakiem.',
    ]),
  };
}
