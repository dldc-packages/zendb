import type { ITableQueryDependency } from "../Query.types.ts";
import { PRIV } from "../utils/constants.ts";
import type { TExpr, TExprUnknow } from "./Expr.ts";

export function parseExpr<Val, Nullable extends boolean>(
  expr: TExpr<Val, Nullable>,
  raw: any,
  json: boolean,
): [Nullable] extends [true] ? (Val | null) : Val {
  const { nullable, parse } = expr[PRIV];
  if (nullable && raw === null) {
    return null as any;
  }
  return parse(raw, json, nullable);
}

export function someNullable(...exprs: TExprUnknow[]): boolean {
  return exprs.some((expr) => expr[PRIV].nullable);
}

export function mergeExprDependencies(
  ...exprs: TExprUnknow[]
): ITableQueryDependency[] {
  return exprs.flatMap((expr) => expr[PRIV].dependencies ?? []);
}
