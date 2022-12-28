import { builder as b, Expr as SqlExpr } from 'zensqlite';
import { isExpr } from '../Expr';
import { SchemaTableAny } from '../schema';
import { PRIV } from '../Utils';
import { exprToSqlNode } from './exprToSqlNode';
import { getValueParam } from './getValueParam';
import { ParamsMap } from './utils';

export function createWhere(
  paramsMap: ParamsMap,
  table: SchemaTableAny,
  where: Record<string, unknown> | null,
  tableAlias: string
): SqlExpr | undefined {
  if (!where) {
    return undefined;
  }
  const conditions = Object.entries(where).map(([key, value]) => {
    const col = b.Column({ column: key, table: tableAlias });
    if (value === null) {
      return b.Expr.Is(col, b.LiteralValue.Null);
    }
    const column = table[PRIV].columns[key];
    if (isExpr(value)) {
      return exprToSqlNode(paramsMap, column, value, col);
    }
    return b.Expr.Equal(col, getValueParam(paramsMap, column, col.columnName.name, value));
  });
  if (conditions.length === 0) {
    return undefined;
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  const [first, ...rest] = conditions;
  let current: SqlExpr = first;
  rest.forEach((item) => {
    current = b.Expr.And(current, item);
  });
  return current;
}
