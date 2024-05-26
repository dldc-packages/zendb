import { builder } from "@dldc/sqlite";
import { PRIV } from "../utils/constants.ts";
import type { ExprsNullables } from "../utils/types.ts";
import {
  create,
  type TExpr,
  type TExprParser,
  type TExprUnknow,
} from "./Expr.ts";

export function simpleFunctionInvocation<Exprs extends TExprUnknow[], Res>(
  name: string,
  parse: TExprParser,
  ...params: Exprs
): TExpr<Res, ExprsNullables<Exprs>> {
  const nullable = params.some((p) => p[PRIV].nullable);
  return create(
    builder.Functions.simpleFunctionInvocation(
      name,
      ...params.map((e) => e.ast),
    ),
    { parse, nullable },
  );
}
