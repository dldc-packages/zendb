import { Ast, builder } from 'zensqlite';
import { Random } from './Random';
import { PRIV, TYPES } from './utils/constants';

export type IExprInternal_Param = { readonly name?: string; readonly value: any };

export interface IExprInternal {
  readonly param?: IExprInternal_Param;
  readonly populated?: any;
}

type InnerExpr = Ast.Expr;

export type IExpr<Val> = InnerExpr & { readonly [TYPES]: Val; readonly [PRIV]?: IExprInternal };

export type IColumnRef<Val> = Ast.Node<'Column'> & { readonly [TYPES]: Val; readonly [PRIV]?: IExprInternal };

export interface IJson<Value> {
  readonly [TYPES]: Value;
}

// type ExprBuilder = {
//   functionInvocation: (name: string, ...params: IExpr<any>[]) => IExpr<any>;
//   literal: <Val extends string | number | boolean | null>(val: Val) => IExpr<Val>;
//   add: <Val extends number>(left: IExpr<Val>, right: IExpr<Val>) => IExpr<Val>;
//   equal: (left: IExpr<any>, right: IExpr<any>) => IExpr<boolean>;
//   different: (left: IExpr<any>, right: IExpr<any>) => IExpr<boolean>;
//   like: (left: IExpr<any>, right: IExpr<any>) => IExpr<boolean>;
//   or: (left: IExpr<any>, right: IExpr<any>) => IExpr<boolean>;
//   and: (left: IExpr<any>, right: IExpr<any>) => IExpr<boolean>;
//   notNull: (expr: IExpr<any>) => IExpr<boolean>;
//   concatenate: (left: IExpr<string>, right: IExpr<string>) => IExpr<string>;
//   AggregateFunctions: {
//     json_group_array: <Val>(expr: IExpr<Val>) => IExpr<IJson<Array<Val>>>;
//     count: (expr: IExpr<any>) => IExpr<number>;
//   };
//   ScalarFunctions: {
//     json_array_length: (expr: IExpr<IJson<Array<any>>>) => IExpr<number>;
//     json_object: <Items extends Record<string, IExpr<any>>>(items: Items) => IExpr<IJson<{ [K in keyof Items]: Items[K][TYPES] }>>;
//   };
// };

export const Expr = (() => {
  return {
    functionInvocation: (name: string, ...params: IExpr<any>[]): IExpr<any> => create(builder.Expr.functionInvocation(name, ...params)),
    literal: <Val extends string | number | boolean | null>(val: Val): IExpr<Val> => create(builder.Expr.literal(val)),
    add: <Val extends number>(left: IExpr<Val>, right: IExpr<Val>): IExpr<Val> => create(builder.Expr.add(left, right)),
    equal: (left: IExpr<any>, right: IExpr<any>): IExpr<boolean> => create(builder.Expr.equal(left, right)),
    different: (left: IExpr<any>, right: IExpr<any>): IExpr<boolean> => create(builder.Expr.different(left, right)),
    like: (left: IExpr<any>, right: IExpr<any>): IExpr<boolean> => create(builder.Expr.like(left, right)),
    or: (left: IExpr<any>, right: IExpr<any>): IExpr<boolean> => create(builder.Expr.or(left, right)),
    and: (left: IExpr<any>, right: IExpr<any>): IExpr<boolean> => create(builder.Expr.and(left, right)),
    notNull: (expr: IExpr<any>): IExpr<boolean> => create(builder.Expr.notNull(expr)),
    concatenate: (left: IExpr<string>, right: IExpr<string>): IExpr<string> => create(builder.Expr.concatenate(left, right)),

    external: <Val extends string | number | boolean | null>(val: Val, name?: string): IExpr<Val> => {
      const paramName = (name ?? '') + '_' + Random.createId();
      return create(builder.Expr.BindParameter.colonNamed(paramName), { name: paramName, value: val });
    },

    column: <Val>(table: Ast.Identifier, column: string): IColumnRef<Val> => {
      return create<Val>(builder.Expr.column({ column, table: { table } })) as IColumnRef<Val>;
    },

    AggregateFunctions: {
      json_group_array: <Val>(expr: IExpr<Val>): IExpr<IJson<Array<Val>>> =>
        create(builder.Expr.AggregateFunctions.json_group_array({ params: expr })),
      count: (expr: IExpr<any>): IExpr<number> => create(builder.Expr.AggregateFunctions.count({ params: expr })),
      avg: (expr: IExpr<any>): IExpr<number> => create(builder.Expr.AggregateFunctions.avg({ params: expr })),
    },

    ScalarFunctions: {
      json_object: <Items extends Record<string, IExpr<any>>>(items: Items): IExpr<IJson<{ [K in keyof Items]: Items[K][TYPES] }>> =>
        create(
          builder.Expr.ScalarFunctions.json_object(
            ...Object.entries(items)
              .map(([name, value]) => [builder.Expr.literal(name), value])
              .flat()
          )
        ),
      // json_array_length: (expr: IExpr<IJson<Array<any>>>): IExpr<number> => create(builder.Expr.ScalarFunctions.json_array_length({ params: expr })),
    },
  };

  function create<Val>(expr: InnerExpr, param?: IExprInternal_Param): IExpr<Val> {
    if (!param) {
      return expr as IExpr<Val>;
    }

    const internal: IExprInternal = { param };
    return Object.assign(expr, { [PRIV]: internal }) as IExpr<Val>;
  }
})();
