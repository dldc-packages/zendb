import type { TExprUnknow } from "../expr/Expr.ts";
import { createColumnNotFound } from "../ZendbErreur.ts";
import type { ExprRecordNested } from "./types.ts";

/**
 * Access a column from a flatten key.
 * @param cols
 * @param flatKey A flatten key, e.g. 'a.b.c'
 */
export function accessColFlatKey(
  cols: ExprRecordNested,
  flatKey: string,
): TExprUnknow {
  const parts = flatKey.split(".");
  let current: ExprRecordNested | TExprUnknow = cols;
  for (const part of parts) {
    current = (current as any)[part];
    if (current === undefined) {
      throw createColumnNotFound(flatKey);
    }
  }
  return current as TExprUnknow;
}
