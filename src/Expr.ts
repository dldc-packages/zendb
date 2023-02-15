import { Ast, builder } from 'zensqlite';
import { Datatype } from './Datatype';
import { Random } from './Random';
import { PRIV, TYPES } from './utils/constants';
import { ExprResultFrom, ExprsNullables } from './utils/types';
import { mapObject } from './utils/utils';

// Any value maybe nullable
export type IExprUnknow = IExpr<any, boolean>;

// Any value but not nullable
export type IExprAny = IExpr<any, false>;

export type IExpr<Val, Nullable extends boolean> = Ast.Expr & {
  readonly [TYPES]: { val: Val; nullable: Nullable };
  readonly [PRIV]: IExprInternal;
};

// json option is set to true when the expression was already JSON parsed
export type ExprParser = (raw: any, json: boolean) => any;

export type JsonMode = 'JsonExpr' | 'JsonRef' | undefined;

export type IExprInternal_Param = { readonly name?: string; readonly value: any };

export interface IExprInternal {
  readonly parse: ExprParser;
  readonly nullable: boolean;
  // used by Expr.external
  readonly param?: IExprInternal_Param;
  // JsonExpr is transformed to JsonRef when converted to a ref
  // JsonRef is wrapped in a json() function when unsed in other json functions
  readonly jsonMode?: JsonMode;
}

export const Expr = (() => {
  function create<Val, Nullable extends boolean>(expr: Ast.Expr, internal: IExprInternal): IExpr<Val, Nullable> {
    return Object.assign(expr, { [PRIV]: internal, [TYPES]: {} as any });
  }

  return {
    simpleFunctionInvocation: <Exprs extends IExprUnknow[], Res>(
      name: string,
      parse: ExprParser,
      ...params: Exprs
    ): IExpr<Res, ExprsNullables<Exprs>> => {
      const nullable = params.some((p) => p[PRIV].nullable);
      return create(builder.Expr.simpleFunctionInvocation(name, ...params), { parse, nullable });
    },
    literal: <Val extends string | number | boolean | null>(val: Val) => createLiteral<Val>(val),
    add: <L extends IExpr<number, boolean>, R extends IExpr<number, boolean>>(left: L, right: L): IExpr<number, ExprsNullables<[L, R]>> => {
      return create(builder.Expr.add(left, right), { parse: Datatype.number.parse, nullable: someNullable(left, right) });
    },
    equal: <L extends IExprUnknow, R extends IExprUnknow>(left: L, right: R): IExpr<boolean, ExprsNullables<[L, R]>> =>
      create(builder.Expr.equal(left, right), { parse: Datatype.boolean.parse, nullable: someNullable(left, right) }),
    different: <L extends IExprUnknow, R extends IExprUnknow>(left: L, right: R): IExpr<boolean, ExprsNullables<[L, R]>> =>
      create(builder.Expr.different(left, right), { parse: Datatype.boolean.parse, nullable: someNullable(left, right) }),
    like: <L extends IExprUnknow, R extends IExprUnknow>(left: L, right: R): IExpr<boolean, ExprsNullables<[L, R]>> =>
      create(builder.Expr.like(left, right), { parse: Datatype.boolean.parse, nullable: someNullable(left, right) }),
    or: <L extends IExprUnknow, R extends IExprUnknow>(left: L, right: R): IExpr<boolean, ExprsNullables<[L, R]>> =>
      create(builder.Expr.or(left, right), { parse: Datatype.boolean.parse, nullable: someNullable(left, right) }),
    and: <L extends IExprUnknow, R extends IExprUnknow>(left: L, right: R): IExpr<boolean, ExprsNullables<[L, R]>> =>
      create(builder.Expr.and(left, right), { parse: Datatype.boolean.parse, nullable: someNullable(left, right) }),
    notNull: (expr: IExprUnknow): IExpr<boolean, false> =>
      create(builder.Expr.notNull(expr), { parse: Datatype.boolean.parse, nullable: false }),
    lowerThan: <L extends IExprUnknow, R extends IExprUnknow>(left: L, right: R): IExpr<boolean, ExprsNullables<[L, R]>> =>
      create(builder.Expr.lowerThan(left, right), { parse: Datatype.boolean.parse, nullable: someNullable(left, right) }),
    lowerThanOrEqual: <L extends IExprUnknow, R extends IExprUnknow>(left: L, right: R): IExpr<boolean, ExprsNullables<[L, R]>> =>
      create(builder.Expr.lowerThanOrEqual(left, right), { parse: Datatype.boolean.parse, nullable: someNullable(left, right) }),
    greaterThan: <L extends IExprUnknow, R extends IExprUnknow>(left: L, right: R): IExpr<boolean, ExprsNullables<[L, R]>> =>
      create(builder.Expr.greaterThan(left, right), { parse: Datatype.boolean.parse, nullable: someNullable(left, right) }),
    greaterThanOrEqual: <L extends IExprUnknow, R extends IExprUnknow>(left: L, right: R): IExpr<boolean, ExprsNullables<[L, R]>> =>
      create(builder.Expr.greaterThanOrEqual(left, right), { parse: Datatype.boolean.parse, nullable: someNullable(left, right) }),
    concatenate: <L extends IExpr<string, boolean>, R extends IExpr<string, boolean>>(
      left: L,
      right: R
    ): IExpr<string, ExprsNullables<[L, R]>> =>
      create(builder.Expr.concatenate(left, right), { parse: Datatype.text.parse, nullable: someNullable(left, right) }),
    isNull: (expr: IExprUnknow): IExpr<boolean, false> =>
      create(builder.Expr.isNull(expr), { parse: Datatype.boolean.parse, nullable: false }),

    external: <Val extends string | number | boolean | null>(val: Val, name?: string): IExpr<Val, [null] extends [Val] ? true : false> => {
      const paramName = (name ?? '') + '_' + Random.createId();
      return create(builder.Expr.BindParameter.colonNamed(paramName), {
        parse: Datatype.fromLiteral(val).parse,
        param: { name: paramName, value: val },
        nullable: val === null,
      });
    },

    column: <Val, Nullable extends boolean>(table: Ast.Identifier, column: string, internal: IExprInternal): IExpr<Val, Nullable> => {
      return create(builder.Expr.column({ column, table: table ? { table } : undefined }), internal);
    },

    jsonAgg: json_group_array,
    jsonObj: json_object,
    json,

    AggregateFunctions: {
      json_group_array,
      count: <Expr extends IExprUnknow>(expr: Expr): IExpr<number, Expr[TYPES]['nullable']> =>
        create(builder.Expr.AggregateFunctions.count({ params: expr }), { parse: Datatype.number.parse, nullable: expr[PRIV].nullable }),
      avg: <Expr extends IExpr<number, boolean>>(expr: Expr): IExpr<number, Expr[TYPES]['nullable']> =>
        create(builder.Expr.AggregateFunctions.avg({ params: expr }), { parse: Datatype.number.parse, nullable: expr[PRIV].nullable }),
    },

    ScalarFunctions: {
      json_object,
      // json_array_length: (expr: IExpr<IJson<Array<any>>>): IExpr<number> => create(builder.Expr.ScalarFunctions.json_array_length({ params: expr })),
    },
  };

  function json_group_array<Val, Nullable extends boolean>(expr: IExpr<Val, Nullable>): IExpr<Array<Val>, Nullable> {
    return create(builder.Expr.AggregateFunctions.json_group_array({ params: wrapInJson(expr) }), {
      parse: (raw, json) => {
        const arr = json ? raw : JSON.parse(raw);
        return arr.map((item: any) => parseExprVal(expr, item, true));
      },
      jsonMode: 'JsonExpr',
      nullable: expr[PRIV].nullable,
    });
  }

  function json_object<Items extends Record<string, IExprUnknow>>(
    items: Items
  ): IExpr<{ [K in keyof Items]: ExprResultFrom<Items[K]> }, false> {
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
        nullable: false,
      }
    );
  }

  /**
   * Wrap json refs in a json()
   */
  function wrapInJson<Val, Nullable extends boolean>(expr: IExpr<Val, Nullable>): IExpr<Val, Nullable> {
    const { jsonMode } = expr[PRIV];
    if (jsonMode === 'JsonRef') {
      return json(expr);
    }
    return expr;
  }

  function json<Val, Nullable extends boolean>(expr: IExpr<Val, Nullable>): IExpr<Val, Nullable> {
    return create(builder.Expr.ScalarFunctions.json(expr), {
      parse: expr[PRIV].parse,
      jsonMode: 'JsonExpr',
      nullable: expr[PRIV].nullable,
    });
  }

  function createLiteral<Val extends string | number | boolean | null>(val: Val): IExpr<Val, [null] extends [Val] ? true : false> {
    return create(builder.Expr.literal(val), { parse: Datatype.fromLiteral(val).parse, nullable: val === null });
  }

  function parseExprVal<Val, Nullable extends boolean>(expr: IExpr<Val, Nullable>, raw: any, json: boolean): Val {
    return expr[PRIV].parse(raw, json);
  }

  function someNullable(...exprs: IExprUnknow[]): boolean {
    return exprs.some((expr) => expr[PRIV].nullable);
  }
})();
