export function mapObject<
  In extends Record<string, any>,
  Out extends Record<keyof In, any>,
>(
  obj: In,
  mapper: (key: string, value: In[keyof In]) => Out[keyof In],
): Out {
  return Object.fromEntries(
    Object.entries(obj).map(([key, val]) => [key, mapper(key, val)]),
  ) as any;
}

export function expectNever(val: never): never {
  throw new Error(`Unexpected never ${val as any}`);
}

export function isNotNull<T>(val: T | null): val is T {
  return val !== null;
}

export function dedupe<T>(arr: Array<T>): Array<T> {
  return Array.from(new Set<T>(arr));
}

export function arrayEqual<T>(a: Array<T>, b: Array<T>): boolean {
  return a.length === b.length && a.every((val, i) => val === b[i]);
}

export function dotCol(table: string, col: string): string {
  return `${table}__${col}`;
}

const urlAlphabet =
  "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

export function nanoid(size = 21) {
  let id = "";
  // A compact alternative for `for (var i = 0; i < step; i++)`.
  let i = size;
  while (i--) {
    // `| 0` is more compact and faster than `Math.floor()`.
    id += urlAlphabet[(Math.random() * 64) | 0];
  }
  return id;
}

export function createNanoid(alphabet: string, defaultSize = 21): () => string {
  return (size = defaultSize) => {
    let id = "";
    // A compact alternative for `for (var i = 0; i < step; i++)`.
    let i = size;
    while (i--) {
      // `| 0` is more compact and faster than `Math.floor()`.
      id += alphabet[(Math.random() * alphabet.length) | 0];
    }
    return id;
  };
}

/**
 * Some SQLite client do the JSON parsing automatically, in such cases we don't
 * want to parse the JSON twice as it will throw an error.
 */
export function maybeParseJson(value: unknown): unknown {
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
}
