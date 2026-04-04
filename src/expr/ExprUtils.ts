import type { TTableQueryDependency } from "../Query.types.ts";
import { PRIV } from "../utils/constants.ts";
import type { TExpr, TExprUnknow } from "./Expr.ts";

export function parseExpr<Val, Nullable extends boolean>(
  expr: TExpr<Val, Nullable>,
  raw: any,
): [Nullable] extends [true] ? (Val | null) : Val {
  const { nullable, datatype } = expr[PRIV];
  if (nullable && raw === null) {
    return null as any;
  }
  return datatype.parse(raw);
}

export function someNullable(...exprs: TExprUnknow[]): boolean {
  return exprs.some((expr) => expr[PRIV].nullable);
}

export function mergeExprDependencies(
  ...exprs: TExprUnknow[]
): TTableQueryDependency[] {
  return exprs.flatMap((expr) => expr[PRIV].dependencies ?? []);
}
