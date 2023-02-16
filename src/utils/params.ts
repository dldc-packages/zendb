import { Ast, Utils } from 'zensqlite';
import { IExprAstParam } from '../Expr';
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
      const param = (node as any)[PRIV] as IExprAstParam | undefined;
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
