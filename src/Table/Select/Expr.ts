import { builder, Expr as InnerExpr, Node, NonEmptyArray } from 'zensqlite';
import { PRIV } from '../../Utils';

export type IExpr<Val> = InnerExpr & { readonly [PRIV]: Val };

export type IColumnRef<Val> = Node<'Column'> & { readonly [PRIV]: Val };

export const Expr = (() => {
  return {
    literal: <Val extends string | number | boolean | null>(val: Val): IExpr<Val> => create(builder.Expr.literal(val)),
    Equal: (left: IExpr<any>, right: IExpr<any>): IExpr<boolean> => create(builder.Expr.Equal(left, right)),
    Different: (left: IExpr<any>, right: IExpr<any>): IExpr<boolean> => create(builder.Expr.Different(left, right)),
    Like: (left: IExpr<any>, right: IExpr<any>): IExpr<boolean> => create(builder.Expr.Like(left, right)),
    Or: (left: IExpr<any>, right: IExpr<any>): IExpr<boolean> => create(builder.Expr.Or(left, right)),
    And: (left: IExpr<any>, right: IExpr<any>): IExpr<boolean> => create(builder.Expr.And(left, right)),
    In: {
      List: (expr: IExpr<any>, items?: NonEmptyArray<IExpr<any>>): IExpr<boolean> => create(builder.Expr.In.List(expr, items)),
    },
  };

  function create<Val>(expr: InnerExpr): IExpr<Val> {
    return expr as IExpr<Val>;
  }
})();
