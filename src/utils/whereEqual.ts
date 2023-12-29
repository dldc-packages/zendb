import { Expr, type IExprUnknow } from '../Expr';
import { accessColFlatKey } from './accessColFlatKey';
import type { ExprRecordNested, FilterEqualCols } from './types';

export function whereEqual<Cols extends ExprRecordNested>(
  cols: Cols,
  filters: Partial<FilterEqualCols<Cols>>,
): IExprUnknow {
  const filterExprs = Object.entries(filters).map(([key, value]) => {
    const col = accessColFlatKey(cols, key);
    if (value === null) {
      return Expr.isNull(col);
    }
    return Expr.equal(col, Expr.external(value as any));
  });
  if (filterExprs.length === 0) {
    return Expr.literal(true);
  }
  if (filterExprs.length === 1) {
    return filterExprs[0];
  }
  const [first, second, ...rest] = filterExprs;
  return rest.reduce((acc, expr) => Expr.and(acc, expr), Expr.and(first, second));
}
