import { builder as b, SetItem } from 'zensqlite';
import { getValueParam } from './getValueParam';
import { ColumnsDefsBase } from './types';
import { ParamsMap } from './utils';

export function createSetItems(paramsMap: ParamsMap, columns: ColumnsDefsBase, values: Record<string, any>): Array<SetItem> {
  return Object.entries(values).map(([col, value]) => {
    const column = columns[col];
    if (!column) {
      throw new Error(`Column ${col} does not exist`);
    }
    return b.SetItems.ColumnName(col, getValueParam(paramsMap, column, col, value));
  });
}
