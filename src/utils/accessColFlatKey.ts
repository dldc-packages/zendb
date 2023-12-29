import type { IExprUnknow } from '../Expr';
import { ZendbErreur } from '../ZendbErreur';
import type { ExprRecordNested } from './types';

/**
 * Access a column from a flatten key.
 * @param cols
 * @param flatKey A flatten key, e.g. 'a.b.c'
 */
export function accessColFlatKey(cols: ExprRecordNested, flatKey: string): IExprUnknow {
  const parts = flatKey.split('.');
  let current: ExprRecordNested | IExprUnknow = cols;
  for (const part of parts) {
    current = (current as any)[part];
    if (current === undefined) {
      throw ZendbErreur.ColumnNotFound(flatKey);
    }
  }
  return current as IExprUnknow;
}
