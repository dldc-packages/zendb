import { Utils } from 'zensqlite';
import { IExpr, IExprInternal } from '../Expr';
import { PRIV } from './constants';

/**
 * Thraverse AST to find Params (and their values)
 */
export function extractExprParams(expr: IExpr<any>, paramsMap: Map<any, string>): IExpr<any> {
  Utils.traverse(expr, (node) => {
    if (node.kind === 'BindParameter' && node.variant === 'ColonNamed') {
      const internal = (node as any)[PRIV] as IExprInternal;
      if (internal && internal.param) {
        paramsMap.set(internal.param.name, internal.param.value);
      }
    }
    return null;
  });
  return expr;
}
