import type { Ast } from "@dldc/sqlite";
import { Utils } from "@dldc/sqlite";
import type { TExprAstParam } from "../expr/Expr.ts";
import { PRIV } from "./constants.ts";

export type Params = Record<string, any> | null;
export type ParamsMap = Map<string, unknown>;

/**
 * Thaverse AST to find Params (and their values)
 */
export function extractParams(expr: Ast.Node): Record<string, any> | null {
  const paramsMap = new Map<any, string>();
  Utils.traverse(expr, (node) => {
    if (node.kind === "BindParameter" && node.variant === "ColonNamed") {
      const param = (node as any)[PRIV] as TExprAstParam | undefined;
      if (param) {
        paramsMap.set(param.name, param.value);
      }
    }
    return null;
  });
  return paramsFromMap(paramsMap);
}

function paramsFromMap(paramsMap: ParamsMap): Record<string, any> | null {
  const entries = Array.from(paramsMap.entries());
  if (entries.length === 0) {
    return null;
  }
  return Object.fromEntries(entries);
}
