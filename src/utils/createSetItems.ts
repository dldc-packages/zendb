import type { SetItem } from '@dldc/sqlite';
import { builder as b } from '@dldc/sqlite';
import { Expr } from '../Expr';
import { ZendbError } from '../ZendbError';
import type { ColumnsBase } from './types';

export function createSetItems(columns: ColumnsBase, values: Record<string, any>): SetItem[] {
  return Object.entries(values).map(([col, value]): SetItem => {
    const column = columns[col];
    if (!column) {
      throw ZendbError.ColumnDoesNotExist.create(col);
    }
    return b.SetItems.ColumnName(col, Expr.external(value, col).ast);
  });
}
