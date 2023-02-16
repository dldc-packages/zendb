import { builder as b, SetItem } from 'zensqlite';
import { Expr } from '../Expr';
import { ColumnsDefsBase } from './types';

export function createSetItems(columns: ColumnsDefsBase, values: Record<string, any>): SetItem[] {
  return Object.entries(values).map(([col, value]): SetItem => {
    const column = columns[col];
    if (!column) {
      throw new Error(`Column ${col} does not exist`);
    }
    return b.SetItems.ColumnName(col, Expr.external(value, col).ast);
  });
}
