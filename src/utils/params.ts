import { Ast, Utils } from 'zensqlite';
import { IExprInternal } from '../Expr';
import { PRIV } from './constants';

export type Params = Record<string, any> | null;
export type ParamsMap = Map<string, unknown>;

/**
 * Thaverse AST to find Params (and their values)
 */
export function extractParams(expr: Ast.Node): Record<string, any> | null {
  const paramsMap = new Map<any, string>();
  Utils.traverse(expr, (node) => {
    if (node.kind === 'BindParameter' && node.variant === 'ColonNamed') {
      const internal = (node as any)[PRIV] as IExprInternal | undefined;
      if (internal && internal.param) {
        paramsMap.set(internal.param.name, internal.param.value);
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
