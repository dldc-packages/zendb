import { arrayToNonEmptyArray, builder as b, Expr as SqlExpr, Node } from 'zensqlite';
import { Expr } from '../Expr';
import { SchemaColumnAny } from '../schema';
import { expectNever } from '../Utils';
import { getValueParam } from './getValueParam';
import { ParamsMap } from './utils';

export function exprToSqlNode(paramsMap: ParamsMap, column: SchemaColumnAny, expr: Expr<any>, col: Node<'Column'>): SqlExpr {
  const colName = col.columnName.name;
  if (expr.kind === 'And') {
    return b.Expr.And(exprToSqlNode(paramsMap, column, expr.left, col), exprToSqlNode(paramsMap, column, expr.right, col));
  }
  if (expr.kind === 'Or') {
    return b.Expr.Or(exprToSqlNode(paramsMap, column, expr.left, col), exprToSqlNode(paramsMap, column, expr.right, col));
  }
  if (expr.kind === 'Equal') {
    return b.Expr.Equal(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'Different') {
    return b.Expr.Different(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'GreaterThan') {
    return b.Expr.GreaterThan(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'GreaterThanOrEqual') {
    return b.Expr.GreaterThanOrEqual(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'LowerThan') {
    return b.Expr.LowerThan(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'LowerThanOrEqual') {
    return b.Expr.LowerThanOrEqual(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'In') {
    return b.Expr.In.List(col, arrayToNonEmptyArray(expr.values.map((val, i) => getValueParam(paramsMap, column, `${colName}_${i}`, val))));
  }
  if (expr.kind === 'NotIn') {
    return b.Expr.NotIn.List(
      col,
      arrayToNonEmptyArray(expr.values.map((val, i) => getValueParam(paramsMap, column, `${colName}_${i}`, val)))
    );
  }
  if (expr.kind === 'IsNull') {
    return b.Expr.Is(col, b.LiteralValue.Null);
  }
  if (expr.kind === 'IsNotNull') {
    return b.Expr.IsNot(col, b.LiteralValue.Null);
  }
  return expectNever(expr.kind);
}
