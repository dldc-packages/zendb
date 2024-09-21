import type * as Expr from "../expr/Expr.ts";
import { PRIV } from "./constants.ts";
import { mapObject } from "./functions.ts";
import type { ExprRecord, ExprRecord_MakeNullable } from "./types.ts";

export function markColumnsNullable<Cols extends ExprRecord>(
  cols: Cols,
): ExprRecord_MakeNullable<Cols> {
  return mapObject(
    cols,
    // mark columns as nullable
    (_, col: Expr.TExprUnknow): any => {
      return ({
        ...col,
        [PRIV]: { ...col[PRIV], nullable: true },
      });
    },
  );
}
