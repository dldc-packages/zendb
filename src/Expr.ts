import { Ast, builder } from 'zensqlite';
import { Datatype } from './Datatype';
import { Random } from './Random';
import { PRIV, TYPES } from './utils/constants';
import { mapObject } from './utils/utils';

export type IExprInternal_Param = { readonly name?: string; readonly value: any };

// json option is set to true when the expression was already JSON parsed
export type ExprParser<Val> = (raw: any, json: boolean) => Val;

export interface IExprInternal<Val> {
  readonly parse: ExprParser<Val>;
  // used by Expr.external
  readonly param?: IExprInternal_Param;
  readonly populated?: any;
}

type InnerExpr = Ast.Expr;

export type IExpr<Val> = InnerExpr & { readonly [TYPES]: Val; readonly [PRIV]: IExprInternal<Val> };

export const Expr = (() => {
  return {
    functionInvocation: <Val>(name: string, parse: ExprParser<Val>, ...params: IExpr<any>[]) =>
      create<Val>(builder.Expr.functionInvocation(name, ...params), parse),
    literal: <Val extends string | number | boolean | null>(val: Val) => createLiteral<Val>(val),
    add: (left: IExpr<number>, right: IExpr<number>) => create<number>(builder.Expr.add(left, right), Datatype.number.parse),
    equal: (left: IExpr<any>, right: IExpr<any>) => create(builder.Expr.equal(left, right), Datatype.boolean.parse),
    different: (left: IExpr<any>, right: IExpr<any>) => create(builder.Expr.different(left, right), Datatype.boolean.parse),
    like: (left: IExpr<any>, right: IExpr<any>) => create(builder.Expr.like(left, right), Datatype.boolean.parse),
    or: (left: IExpr<any>, right: IExpr<any>) => create(builder.Expr.or(left, right), Datatype.boolean.parse),
    and: (left: IExpr<any>, right: IExpr<any>) => create(builder.Expr.and(left, right), Datatype.boolean.parse),
    notNull: (expr: IExpr<any>) => create(builder.Expr.notNull(expr), Datatype.boolean.parse),
    concatenate: (left: IExpr<string>, right: IExpr<string>): IExpr<string> =>
      create(builder.Expr.concatenate(left, right), Datatype.text.parse),

    external: <Val extends string | number | boolean | null>(val: Val, name?: string): IExpr<Val> => {
      const paramName = (name ?? '') + '_' + Random.createId();
      return create(builder.Expr.BindParameter.colonNamed(paramName), Datatype.fromLiteral(val).parse, { name: paramName, value: val });
    },

    column: <Val>(table: Ast.Identifier, column: string, parse: ExprParser<Val>) => {
      return create<Val>(builder.Expr.column({ column, table: { table } }), parse);
    },

    AggregateFunctions: {
      json_group_array: <Val>(expr: IExpr<Val>): IExpr<Array<Val>> =>
        create(builder.Expr.AggregateFunctions.json_group_array({ params: expr }), (raw, json) => {
          const arr = json ? raw : JSON.parse(raw);
          return arr.map((item: any) => parseExprVal(expr, item, true));
        }),
      count: (expr: IExpr<any>): IExpr<number> => create(builder.Expr.AggregateFunctions.count({ params: expr }), Datatype.number.parse),
      avg: (expr: IExpr<number>): IExpr<number> => create(builder.Expr.AggregateFunctions.avg({ params: expr }), Datatype.number.parse),
    },

    ScalarFunctions: {
      json_object: <Items extends Record<string, IExpr<any>>>(items: Items): IExpr<{ [K in keyof Items]: Items[K][TYPES] }> =>
        create(
          builder.Expr.ScalarFunctions.json_object(
            ...Object.entries(items)
              .map(([name, value]) => [builder.Expr.literal(name), value])
              .flat()
          ),
          (raw, json) => {
            const obj = json ? raw : JSON.parse(raw);
            return mapObject(items, (name, expr) => parseExprVal(expr, obj[name], true));
          }
        ),
      // json_array_length: (expr: IExpr<IJson<Array<any>>>): IExpr<number> => create(builder.Expr.ScalarFunctions.json_array_length({ params: expr })),
    },
  };

  function createLiteral<Val extends string | number | boolean | null>(val: Val): IExpr<Val> {
    return create<Val>(builder.Expr.literal(val), Datatype.fromLiteral(val).parse);
  }

  function create<Val>(expr: InnerExpr, parse: ExprParser<Val>, param?: IExprInternal_Param): IExpr<Val> {
    const internal: IExprInternal<Val> = { parse, param };
    return Object.assign(expr, { [PRIV]: internal }) as IExpr<Val>;
  }

  function parseExprVal<Val>(expr: IExpr<Val>, raw: any, json: boolean): Val {
    return expr[PRIV].parse(raw, json);
  }
})();
