import { builder } from "@dldc/sqlite";
import * as Datatype from "../Datatype.ts";
import { PRIV } from "../utils/constants.ts";
import type { ExprsNullables } from "../utils/types.ts";
import { create, type TExpr, type TExprUnknow } from "./Expr.ts";

export function simpleFunctionInvocation<Exprs extends TExprUnknow[], Res>(
  name: string,
  datatype: Datatype.TDatatypeAny,
  ...params: Exprs
): TExpr<Res, ExprsNullables<Exprs>> {
  const nullable = params.some((p) => p[PRIV].nullable);
  return create(builder.Functions.simpleFunctionInvocation(name, ...params.map((e) => e.ast)), {
    datatype,
    nullable,
  });
}

export function random(): TExpr<number, false> {
  return simpleFunctionInvocation<[], number>("random", Datatype.number);
}
