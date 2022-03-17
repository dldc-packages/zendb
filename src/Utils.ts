import crypto from 'crypto';
import { Expr, builder as b, Node } from 'zensqlite';
import { customAlphabet } from 'nanoid';

const createParamName = customAlphabet('abcdefghijklmnopqrstuvwxyz', 15);

export const PRIV = Symbol.for('ZENDB_PRIVATE');
export type PRIV = typeof PRIV;

export function sqlQuote(str: string | number | symbol): string {
  if (typeof str !== 'string') {
    throw new Error(`Expected string, got ${typeof str}`);
  }
  return '`' + str + '`';
}

export function mapObject<In extends Record<string, any>, Out extends Record<keyof In, any>>(
  obj: In,
  mapper: (key: string, value: In[keyof In]) => Out[keyof In]
): Out {
  return Object.fromEntries(
    Object.entries(obj).map(([key, val]) => [key, mapper(key, val)])
  ) as any;
}

export function expectNever(val: never): never {
  throw new Error(`Unexpected never ${val}`);
}

type Parts = Array<string | null | undefined>;

export function joiner(glue: string, ...parts: Parts): string {
  return parts.filter(Boolean).join(glue);
}

export const join = {
  space: (...parts: Parts): string => joiner(' ', ...parts),
  comma: (...parts: Parts): string => joiner(', ', ...parts),
  all: (...parts: Parts): string => joiner('', ...parts),
};

export function parent(content: string): string {
  return `(${content})`;
}

export function notNil<T>(val: T | null | undefined): T {
  if (val === null || val === undefined) {
    throw new Error(`Expected non-nil value, got ${val}`);
  }
  return val;
}

export type TraverserResult<K, T> = { key: K; data: T } | null;

export type Traverser<K, T> = () => TraverserResult<K, T>;

export function traverserFromRowIterator<Key, DataIn, DataOut>(
  iter: IterableIterator<{ key: Key; data: DataIn }>,
  transform: (data: DataIn) => DataOut
): Traverser<Key, DataOut> {
  let done = false;
  return (): TraverserResult<Key, DataOut> => {
    if (done) {
      return null;
    }
    const row = iter.next();
    if (!row.done) {
      return { key: row.value.key, data: transform(row.value.data) };
    }
    done = true;
    if (row.value) {
      return { key: row.value.key, data: transform(row.value.data) };
    }
    return null;
  };
}

export function traverserToIterable<K, T, O>(
  traverser: Traverser<K, T>,
  transform: (key: K, value: T) => O
): Iterable<O> {
  return {
    [Symbol.iterator]: () => {
      let nextRes = traverser();
      return {
        next: (): IteratorResult<O> => {
          if (nextRes === null) {
            return { done: true, value: undefined };
          }
          const nextNextRes = traverser();
          const result: IteratorResult<O> = {
            done: nextNextRes === null ? undefined : false,
            value: transform(nextRes.key, nextRes.data),
          };
          nextRes = nextNextRes;
          return result;
        },
      };
    },
  };
}

export function fingerprintString(str: string, max: number): number {
  const hash = crypto.createHash('md5').update(str).digest('hex');
  let result = 0;
  hash
    .split('')
    .map((c) => parseInt(c, 16))
    .forEach((num) => {
      result = (result + num) % max;
    });
  // never return 0
  if (result === 0) {
    return max;
  }
  return result;
}

export function mapMaybe<T, O>(val: T | null | undefined, mapper: (val: T) => O): O | null {
  if (val === null || val === undefined) {
    return null;
  }
  return mapper(val);
}

export function transformSet<I, O>(input: Set<I>, transform: (val: I) => O): Set<O> {
  const res = new Set<O>();
  input.forEach((item) => {
    res.add(transform(item));
  });
  return res;
}

export type NonEmptyList<T> = { head: T; tail: Array<T> };

export function nonEmptyList<T>(head: T, ...tail: Array<T>): NonEmptyList<T> {
  return { head, tail };
}

export type Variants<T extends Record<string, any>> = {
  [K in keyof T]: T[K] & { variant: K };
}[keyof T];

export function mapVariants<T extends { variant: string }, Res>(
  variant: T,
  mapper: { [K in T['variant']]: (val: Extract<T, { variant: K }>) => Res }
): Res {
  return (mapper as any)[(variant as any).variant](variant);
}

export function mapUnionString<T extends string, Res>(val: T, mapper: { [K in T]: Res }): Res {
  return mapper[val];
}

export function mergeSets<T>(...sets: Array<Set<T> | null>): Set<T> {
  const merged = new Set<T>();
  sets.forEach((set) => {
    if (set) {
      set.forEach((item) => {
        merged.add(item);
      });
    }
  });
  return merged;
}

export function isNotNull<T>(val: T | null): val is T {
  return val !== null;
}

export function dotCol(table: string, col: string): string {
  return `${table}__${col}`;
}

export function dedupe<T>(arr: Array<T>): Array<T> {
  return Array.from(new Set<T>(arr));
}

export function arrayEqual<T>(a: Array<T>, b: Array<T>): boolean {
  return a.length === b.length && a.every((val, i) => val === b[i]);
}

export function createWhere(
  map: Map<any, string>,
  where: Record<string, unknown> | null,
  tableAlias: string
): Expr | undefined {
  if (!where) {
    return undefined;
  }
  const conditions = Object.entries(where).map(([key, value]) => {
    return b.Expr.Equal(b.Column({ column: key, table: tableAlias }), getValueParam(map, value));
  });
  if (conditions.length === 0) {
    return undefined;
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  const [first, ...rest] = conditions;
  let current: Expr = first;
  rest.forEach((item) => {
    current = b.Expr.And(current, item);
  });
  return current;
}

function getValueParam(map: Map<any, string>, value: any): Node<'BindParameter'> {
  const current = map.get(value);
  if (current !== undefined) {
    return b.Expr.BindParameter.ColonNamed(current);
  }
  const name = createParamName();
  map.set(value, name);
  return b.Expr.BindParameter.ColonNamed(name);
}

export function paramsFromMap(map: Map<any, string>): Record<string, any> | null {
  const entries = Array.from(map.entries()).map(([value, name]) => [name, value]);
  if (entries.length === 0) {
    return null;
  }
  return Object.fromEntries(entries);
}
