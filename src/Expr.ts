import { Ast, builder } from 'zensqlite';
import { Random } from './Random';
import { PRIV, TYPES } from './utils/constants';

export type IExprInternal_Param = { readonly name?: string; readonly value: any };

export interface IExprInternal {
  readonly param?: IExprInternal_Param;
}

type InnerExpr = Ast.Expr;

export type IExpr<Val> = InnerExpr & { readonly [TYPES]: Val; readonly [PRIV]?: IExprInternal };

export type IColumnRef<Val> = Ast.Node<'Column'> & { readonly [TYPES]: Val };

export interface IJson<Value> {
  readonly [TYPES]: Value;
}

type ExprBuilder = {
  functionInvocation: (name: string, ...params: IExpr<any>[]) => IExpr<any>;
  literal: <Val extends string | number | boolean | null>(val: Val) => IExpr<Val>;
  add: <Val extends number>(left: IExpr<Val>, right: IExpr<Val>) => IExpr<Val>;
  equal: (left: IExpr<any>, right: IExpr<any>) => IExpr<boolean>;
  different: (left: IExpr<any>, right: IExpr<any>) => IExpr<boolean>;
  like: (left: IExpr<any>, right: IExpr<any>) => IExpr<boolean>;
  or: (left: IExpr<any>, right: IExpr<any>) => IExpr<boolean>;
  and: (left: IExpr<any>, right: IExpr<any>) => IExpr<boolean>;
  notNull: (expr: IExpr<any>) => IExpr<boolean>;
  concatenate: (left: IExpr<string>, right: IExpr<string>) => IExpr<string>;
  AggregateFunctions: {
    json_group_array: <Val>(expr: IExpr<Val>) => IExpr<IJson<Array<Val>>>;
  };
  ScalarFunctions: {
    json_array_length: (expr: IExpr<IJson<Array<any>>>) => IExpr<number>;
    json_object: <Items extends Record<string, IExpr<any>>>(items: Items) => IExpr<IJson<{ [K in keyof Items]: Items[K][TYPES] }>>;
  };
};

export const Expr = (() => {
  return {
    ...(builder.Expr as any as ExprBuilder),

    external: <Val extends string | number | boolean | null>(val: Val, name?: string): IExpr<Val> => {
      const paramName = (name ?? '') + '_' + Random.createId();
      return create(builder.Expr.BindParameter.colonNamed(paramName), { name: paramName, value: val });
    },

    column: <Val>(table: Ast.Identifier, column: string): IColumnRef<Val> => {
      return create<Val>(builder.Expr.column({ column, table: { table } })) as IColumnRef<Val>;
    },
  };

  function create<Val>(expr: InnerExpr, param?: IExprInternal_Param): IExpr<Val> {
    const internal: IExprInternal = { param };
    return Object.assign(expr, { [PRIV]: internal }) as IExpr<Val>;
  }
})();
