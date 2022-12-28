import { builder as b, Node } from 'zensqlite';
import { SchemaColumnAny, serializeColumn } from '../schema';
import { ParamsMap } from './utils';

export function getValueParam(paramsMap: ParamsMap, column: SchemaColumnAny, name: string, value: any): Node<'BindParameter'> {
  let uniqueName = name;
  // Find unique name
  if (paramsMap.has(name)) {
    let i = 1;
    while (paramsMap.has(`${name}_${i}`)) {
      i++;
    }
    uniqueName = `${name}_${i}`;
  }
  paramsMap.set(uniqueName, serializeColumn(column, value));
  return b.Expr.BindParameter.ColonNamed(uniqueName);
}
