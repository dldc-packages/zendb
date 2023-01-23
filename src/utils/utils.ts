export function mapObject<In extends Record<string, any>, Out extends Record<keyof In, any>>(
  obj: In,
  mapper: (key: string, value: In[keyof In]) => Out[keyof In]
): Out {
  return Object.fromEntries(Object.entries(obj).map(([key, val]) => [key, mapper(key, val)])) as any;
}

export function expectNever(val: never): never {
  throw new Error(`Unexpected never ${val}`);
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

export type ParamsMap = Map<string, unknown>;

export function dotCol(table: string, col: string): string {
  return `${table}__${col}`;
}

export function paramsFromMap(paramsMap: ParamsMap): Record<string, any> | null {
  const entries = Array.from(paramsMap.entries());
  if (entries.length === 0) {
    return null;
  }
  return Object.fromEntries(entries);
}

const urlAlphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

export function nanoid(size = 21) {
  let id = '';
  // A compact alternative for `for (var i = 0; i < step; i++)`.
  let i = size;
  while (i--) {
    // `| 0` is more compact and faster than `Math.floor()`.
    id += urlAlphabet[(Math.random() * 64) | 0];
  }
  return id;
}
