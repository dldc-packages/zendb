import crypto from 'crypto';

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

function joiner(glue: string, ...parts: Parts): string {
  return parts.filter(Boolean).join(glue);
}

export const join = {
  space: (...parts: Parts): string => joiner(' ', ...parts),
  comma: (...parts: Parts): string => joiner(', ', ...parts),
  all: (...parts: Parts): string => joiner('', ...parts),
};

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
