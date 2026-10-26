// Время и новые id для операций. Браузер выполняет действие сразу (интерфейс не ждёт сервер)
// и записывает, какие id и какое время использовал; сервер повторяет то же действие с теми же
// значениями и проверяет права. Так у обоих получается один и тот же результат.

let fixedNow: number | null = null;
let idQueue: string[] | null = null;
let recorded: string[] | null = null;
let counter = 0;

export const now = () => fixedNow ?? Date.now();

export const ID_RE = /^[a-z]{0,3}[a-z0-9]{6,32}$/;

function freshId(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function uid(prefix = ''): string {
  if (idQueue) {
    const id = idQueue.shift();
    if (id && id.startsWith(prefix) && ID_RE.test(id)) return id;
    idQueue = []; // расхождение — дальше свежие id, результат всё равно придёт с сервера
  }
  const id = freshId(prefix);
  recorded?.push(id);
  return id;
}

/** Выполнить действие и запомнить использованные id и время. */
export function record<T>(fn: () => T): { value: T; ids: string[]; time: number } {
  const time = Date.now();
  fixedNow = time;
  recorded = [];
  try {
    const value = fn();
    return { value, ids: recorded, time };
  } finally {
    fixedNow = null;
    recorded = null;
  }
}

/** Повторить действие с теми же id и временем (на сервере). */
export function replay<T>(r: { ids: string[]; time: number }, fn: () => T): T {
  fixedNow = r.time;
  idQueue = [...r.ids];
  try {
    return fn();
  } finally {
    fixedNow = null;
    idQueue = null;
  }
}
