import { Ast, builder as b } from 'zensqlite';
import { ColumnDef, IColumnDefAny } from '../ColumnDef';
import { ParamsMap } from './utils';

/**
 * Create a BindParameter node for the given value.
 * Making sure the name is unique in the paramsMap.
 */
export function getValueParam(paramsMap: ParamsMap, column: IColumnDefAny, name: string, value: any): Ast.Node<'BindParameter'> {
  let uniqueName = name;
  // Find unique name
  if (paramsMap.has(name)) {
    let i = 1;
    while (paramsMap.has(`${name}_${i}`)) {
      i++;
    }
    uniqueName = `${name}_${i}`;
  }
  paramsMap.set(uniqueName, ColumnDef.serialize(column, value));
  return b.Expr.BindParameter.colonNamed(uniqueName);
}
