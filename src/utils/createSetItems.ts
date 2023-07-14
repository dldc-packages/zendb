import type { SetItem } from '@dldc/sqlite';
import { builder as b } from '@dldc/sqlite';
import { Expr } from '../Expr';
import type { ColumnsBase } from './types';

export function createSetItems(columns: ColumnsBase, values: Record<string, any>): SetItem[] {
  return Object.entries(values).map(([col, value]): SetItem => {
    const column = columns[col];
    if (!column) {
      throw new Error(`Column ${col} does not exist`);
    }
    return b.SetItems.ColumnName(col, Expr.external(value, col).ast);
  });
}
