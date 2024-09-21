import type { Ast } from "@dldc/sqlite";
import * as Expr from "../expr/Expr.ts";
import { PRIV } from "./constants.ts";
import { mapObject } from "./functions.ts";
import type { ExprRecord } from "./types.ts";

/**
 * Change the table of the columns to the new alias
 * Expect all expressions to be columns !
 */
export function remapColumnsTables<Cols extends ExprRecord>(
  cols: Cols,
  tableAlias: Ast.Identifier,
): Cols {
  return mapObject(
    cols,
    // remap columns to the new alias
    (_, col: Expr.TExprUnknow): any => {
      if (col.ast.kind !== "Column") {
        throw new Error("Expected column");
      }
      const internal = col[PRIV];
      return Expr.create(
        { ...col.ast, table: { name: tableAlias } },
        internal,
      );
    },
  );
}
