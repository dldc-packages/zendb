import { Ast, builder } from 'zensqlite';
import { Datatype } from './Datatype';
import { Random } from './Random';
import { PRIV, TYPES } from './utils/constants';
import { mapObject } from './utils/utils';

export type IExprInternal_Param = { readonly name?: string; readonly value: any };

// json option is set to true when the expression was already JSON parsed
export type ExprParser<Val> = (raw: any, json: boolean) => Val;

export type JsonMode = 'JsonExpr' | 'JsonRef' | undefined;

export interface IExprInternal<Val> {
  readonly parse: ExprParser<Val>;
  // used by Expr.external
  readonly param?: IExprInternal_Param;
  // JsonExpr is transformed to JsonRef when converted to a ref
  // JsonRef is wrapped in a json() function when unsed in other json functions
  readonly jsonMode?: JsonMode;
}

type InnerExpr = Ast.Expr;

export type IExpr<Val = any> = InnerExpr & { readonly [TYPES]: Val; readonly [PRIV]: IExprInternal<Val> };

export const Expr = (() => {
  return {
    functionInvocation: <Val>(name: string, parse: ExprParser<Val>, ...params: IExpr<any>[]) =>
      create<Val>(builder.Expr.functionInvocation(name, ...params), { parse }),
    literal: <Val extends string | number | boolean | null>(val: Val) => createLiteral<Val>(val),
    add: (left: IExpr<number>, right: IExpr<number>) => create<number>(builder.Expr.add(left, right), { parse: Datatype.number.parse }),
    equal: (left: IExpr<any>, right: IExpr<any>) => create(builder.Expr.equal(left, right), { parse: Datatype.boolean.parse }),
    different: (left: IExpr<any>, right: IExpr<any>) => create(builder.Expr.different(left, right), { parse: Datatype.boolean.parse }),
    like: (left: IExpr<any>, right: IExpr<any>) => create(builder.Expr.like(left, right), { parse: Datatype.boolean.parse }),
    or: (left: IExpr<any>, right: IExpr<any>) => create(builder.Expr.or(left, right), { parse: Datatype.boolean.parse }),
    and: (left: IExpr<any>, right: IExpr<any>) => create(builder.Expr.and(left, right), { parse: Datatype.boolean.parse }),
    notNull: (expr: IExpr<any>) => create(builder.Expr.notNull(expr), { parse: Datatype.boolean.parse }),
    concatenate: (left: IExpr<string>, right: IExpr<string>): IExpr<string> =>
      create(builder.Expr.concatenate(left, right), { parse: Datatype.text.parse }),
    isNull: (expr: IExpr<any>) => create(builder.Expr.isnull(expr), { parse: Datatype.boolean.parse }),

    external: <Val extends string | number | boolean | null>(val: Val, name?: string): IExpr<Val> => {
      const paramName = (name ?? '') + '_' + Random.createId();
      return create(builder.Expr.BindParameter.colonNamed(paramName), {
        parse: Datatype.fromLiteral(val).parse,
        param: { name: paramName, value: val },
      });
    },

    column: <Val>(table: Ast.Identifier, column: string, internal: Partial<IExprInternal<Val>>) => {
      return create<Val>(builder.Expr.column({ column, table: table ? { table } : undefined }), internal);
    },

    jsonAgg: json_group_array,
    jsonObj: json_object,
    json,

    AggregateFunctions: {
      json_group_array,
      count: (expr: IExpr<any>): IExpr<number> =>
        create(builder.Expr.AggregateFunctions.count({ params: expr }), { parse: Datatype.number.parse }),
      avg: (expr: IExpr<number>): IExpr<number> =>
        create(builder.Expr.AggregateFunctions.avg({ params: expr }), { parse: Datatype.number.parse }),
    },

    ScalarFunctions: {
      json_object,
      // json_array_length: (expr: IExpr<IJson<Array<any>>>): IExpr<number> => create(builder.Expr.ScalarFunctions.json_array_length({ params: expr })),
    },
  };

  function json_group_array<Val>(expr: IExpr<Val>): IExpr<Array<Val>> {
    return create(builder.Expr.AggregateFunctions.json_group_array({ params: wrapInJson(expr) }), {
      parse: (raw, json) => {
        const arr = json ? raw : JSON.parse(raw);
        return arr.map((item: any) => parseExprVal(expr, item, true));
      },
      jsonMode: 'JsonExpr',
    });
  }

  function json_object<Items extends Record<string, IExpr<any>>>(items: Items): IExpr<{ [K in keyof Items]: Items[K][TYPES] }> {
    return create(
      builder.Expr.ScalarFunctions.json_object(
        ...Object.entries(items)
          .map(([name, value]) => [builder.Expr.literal(name), wrapInJson(value)])
          .flat()
      ),
      {
        parse: (raw, json) => {
          const obj = json ? raw : JSON.parse(raw);
          return mapObject(items, (name, expr) => parseExprVal(expr, obj[name], true));
        },
        jsonMode: 'JsonExpr',
      }
    );
  }

  /**
   * Wrap json refs in a json()
   */
  function wrapInJson<Val>(expr: IExpr<Val>): IExpr<Val> {
    const { jsonMode } = expr[PRIV];
    if (jsonMode === 'JsonRef') {
      return json(expr);
    }
    return expr;
  }

  function json<Val>(expr: IExpr<Val>): IExpr<Val> {
    return create(builder.Expr.ScalarFunctions.json(expr), { parse: expr[PRIV].parse, jsonMode: 'JsonExpr' });
  }

  function createLiteral<Val extends string | number | boolean | null>(val: Val): IExpr<Val> {
    return create<Val>(builder.Expr.literal(val), { parse: Datatype.fromLiteral(val).parse });
  }

  function create<Val>(expr: InnerExpr, internal: Partial<IExprInternal<Val>>): IExpr<Val> {
    return Object.assign(expr, { [PRIV]: internal }) as IExpr<Val>;
  }

  function parseExprVal<Val>(expr: IExpr<Val>, raw: any, json: boolean): Val {
    return expr[PRIV].parse(raw, json);
  }
})();
