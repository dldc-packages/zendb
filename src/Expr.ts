import type { Ast } from '@dldc/sqlite';
import { builder, Utils } from '@dldc/sqlite';
import { Datatype } from './Datatype';
import { Random } from './Random';
import type { ITableQuery, ITableQueryDependency } from './TableQuery.types';
import { PRIV, TYPES } from './utils/constants';
import { appendDependencies } from './utils/dependencies';
import { expectNever, mapObject } from './utils/functions';
import type { ExprResultFrom, ExprsNullables } from './utils/types';

export interface IExpr<Val, Nullable extends boolean> {
  readonly ast: Ast.Expr;
  readonly [TYPES]: { val: Val; nullable: Nullable };
  readonly [PRIV]: IExprInternal;
}

// Any value maybe nullable
export type IExprUnknow = IExpr<any, boolean>;

// Any value but not nullable
export type IExprAny = IExpr<any, false>;

// json option is set to true when the expression was already JSON parsed
export type ExprParser = (raw: any, json: boolean, nullable: boolean) => any;

export type JsonMode = 'JsonExpr' | 'JsonRef' | undefined;

// Data attached to [PRIV] on ast nodes that represent external values
export type IExprAstParam = { readonly name?: string; readonly value: any };

export interface IExprInternal {
  readonly parse: ExprParser;
  readonly nullable: boolean;
  // JsonExpr is transformed to JsonRef when converted to a ref
  // JsonRef is wrapped in a json() function when unsed in other json functions
  readonly jsonMode?: JsonMode;
  // Used for X in (select X from ...) where the target is a CTE that needs to be defined
  readonly dependencies?: Array<ITableQueryDependency>;
}

export const Expr = (() => {
  function create<Val, Nullable extends boolean>(expr: Ast.Expr, internal: IExprInternal): IExpr<Val, Nullable> {
    return { ast: expr, [PRIV]: internal, [TYPES]: {} as any };
  }

  return {
    utils: {
      create,
      createLiteral,
      parseExprVal,
      someNullable,
    },

    simpleFunctionInvocation,
    literal,
    add,
    equal,
    different,
    like,
    or,
    and,
    notNull,
    lowerThan,
    lowerThanOrEqual,
    greaterThan,
    greaterThanOrEqual,
    concatenate,
    isNull,
    inList,
    notInList,
    inSubquery,
    notInSubquery,

    compare,

    external,
    column,

    jsonAgg: json_group_array,
    jsonObj: json_object,
    json,

    AggregateFunctions: {
      count: <Expr extends IExprUnknow>(expr: Expr): IExpr<number, false> => {
        // count always returns a number
        return create(builder.Expr.AggregateFunctions.count({ params: expr.ast }), {
          parse: Datatype.number.parse,
          nullable: false,
          dependencies: expr[PRIV].dependencies,
        });
      },
      // Note: for the following functions, the result is always nullable because the result is null when the input is empty
      avg: <Expr extends IExpr<number, boolean>>(expr: Expr): IExpr<number, true> => {
        return create(builder.Expr.AggregateFunctions.avg({ params: expr.ast }), {
          parse: Datatype.number.parse,
          nullable: true,
          dependencies: expr[PRIV].dependencies,
        });
      },
      sum: <Expr extends IExpr<number, boolean>>(expr: Expr): IExpr<number, true> => {
        return create(builder.Expr.AggregateFunctions.sum({ params: expr.ast }), {
          parse: Datatype.number.parse,
          nullable: true,
          dependencies: expr[PRIV].dependencies,
        });
      },
      min: <Expr extends IExprUnknow>(expr: Expr): IExpr<Expr[TYPES]['val'], true> => {
        return create(builder.Expr.AggregateFunctions.min({ params: expr.ast }), {
          parse: expr[PRIV].parse,
          nullable: true,
          dependencies: expr[PRIV].dependencies,
        });
      },
      max: <Expr extends IExprUnknow>(expr: Expr): IExpr<Expr[TYPES]['val'], true> => {
        return create(builder.Expr.AggregateFunctions.max({ params: expr.ast }), {
          parse: expr[PRIV].parse,
          nullable: true,
          dependencies: expr[PRIV].dependencies,
        });
      },
    },
  };

  function simpleFunctionInvocation<Exprs extends IExprUnknow[], Res>(
    name: string,
    parse: ExprParser,
    ...params: Exprs
  ): IExpr<Res, ExprsNullables<Exprs>> {
    const nullable = params.some((p) => p[PRIV].nullable);
    return create(builder.Expr.simpleFunctionInvocation(name, ...params.map((e) => e.ast)), { parse, nullable });
  }

  function literal<Val extends string | number | boolean | null>(val: Val) {
    return createLiteral<Val>(val);
  }

  function add<L extends IExpr<number, boolean>, R extends IExpr<number, boolean>>(
    left: L,
    right: L,
  ): IExpr<number, ExprsNullables<[L, R]>> {
    return create(builder.Expr.add(left.ast, right.ast), {
      parse: Datatype.number.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function equal<L extends IExprUnknow, R extends IExprUnknow>(
    left: L,
    right: R,
  ): IExpr<boolean, L[TYPES]['nullable'] | R[TYPES]['nullable']> {
    return create(builder.Expr.equal(left.ast, right.ast), {
      parse: Datatype.boolean.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function compare<L extends IExprUnknow, R extends L[TYPES]['val']>(
    left: L,
    operator: '<' | '<=' | '>' | '>=' | '=' | '!=',
    right: R,
  ): IExpr<boolean, L[TYPES]['nullable']> {
    const rExpr = external(right);
    switch (operator) {
      case '<':
        return lowerThan(left, rExpr);
      case '<=':
        return lowerThanOrEqual(left, rExpr);
      case '>':
        return greaterThan(left, rExpr);
      case '>=':
        return greaterThanOrEqual(left, rExpr);
      case '=':
        return equal(left, rExpr);
      case '!=':
        return different(left, rExpr);
      default:
        return expectNever(operator);
    }
  }

  function different<L extends IExprUnknow, R extends IExprUnknow>(
    left: L,
    right: R,
  ): IExpr<boolean, ExprsNullables<[L, R]>> {
    return create(builder.Expr.different(left.ast, right.ast), {
      parse: Datatype.boolean.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function like<L extends IExprUnknow, R extends IExprUnknow>(
    left: L,
    right: R,
  ): IExpr<boolean, ExprsNullables<[L, R]>> {
    return create(builder.Expr.like(left.ast, right.ast), {
      parse: Datatype.boolean.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function or<L extends IExprUnknow, R extends IExprUnknow>(left: L, right: R): IExpr<boolean, ExprsNullables<[L, R]>> {
    return create(builder.Expr.or(left.ast, right.ast), {
      parse: Datatype.boolean.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function and<L extends IExprUnknow, R extends IExprUnknow>(
    left: L,
    right: R,
  ): IExpr<boolean, ExprsNullables<[L, R]>> {
    return create(builder.Expr.and(left.ast, right.ast), {
      parse: Datatype.boolean.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function notNull(expr: IExprUnknow): IExpr<boolean, false> {
    return create(builder.Expr.notNull(expr.ast), { parse: Datatype.boolean.parse, nullable: false });
  }

  function lowerThan<L extends IExprUnknow, R extends IExprUnknow>(
    left: L,
    right: R,
  ): IExpr<boolean, ExprsNullables<[L, R]>> {
    return create(builder.Expr.lowerThan(left.ast, right.ast), {
      parse: Datatype.boolean.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function lowerThanOrEqual<L extends IExprUnknow, R extends IExprUnknow>(
    left: L,
    right: R,
  ): IExpr<boolean, ExprsNullables<[L, R]>> {
    return create(builder.Expr.lowerThanOrEqual(left.ast, right.ast), {
      parse: Datatype.boolean.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function greaterThan<L extends IExprUnknow, R extends IExprUnknow>(
    left: L,
    right: R,
  ): IExpr<boolean, ExprsNullables<[L, R]>> {
    return create(builder.Expr.greaterThan(left.ast, right.ast), {
      parse: Datatype.boolean.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function greaterThanOrEqual<L extends IExprUnknow, R extends IExprUnknow>(
    left: L,
    right: R,
  ): IExpr<boolean, ExprsNullables<[L, R]>> {
    return create(builder.Expr.greaterThanOrEqual(left.ast, right.ast), {
      parse: Datatype.boolean.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function concatenate<L extends IExpr<string, boolean>, R extends IExpr<string, boolean>>(
    left: L,
    right: R,
  ): IExpr<string, ExprsNullables<[L, R]>> {
    return create(builder.Expr.concatenate(left.ast, right.ast), {
      parse: Datatype.text.parse,
      nullable: someNullable(left, right),
      dependencies: mergeExprDependencies(left, right),
    });
  }

  function isNull(expr: IExprUnknow): IExpr<boolean, false> {
    return create(builder.Expr.isNull(expr.ast), {
      parse: Datatype.boolean.parse,
      nullable: false,
      dependencies: expr[PRIV].dependencies,
    });
  }

  function inList(left: IExprUnknow, items: IExprUnknow[]): IExpr<boolean, false> {
    return create(builder.Expr.In.list(left.ast, Utils.arrayToNonEmptyArray(items.map((item) => item.ast))), {
      nullable: false,
      parse: Datatype.boolean.parse,
      dependencies: mergeExprDependencies(left, ...items),
    });
  }

  function notInList(left: IExprUnknow, items: IExprUnknow[]): IExpr<boolean, false> {
    return create(builder.Expr.NotIn.list(left.ast, Utils.arrayToNonEmptyArray(items.map((item) => item.ast))), {
      nullable: false,
      parse: Datatype.boolean.parse,
      dependencies: mergeExprDependencies(left, ...items),
    });
  }

  function inSubquery<RTable extends ITableQuery<any, any>>(
    expr: IExprUnknow,
    subquery: RTable,
  ): IExpr<boolean, false> {
    return create(builder.Expr.In.tableName(expr.ast, subquery[PRIV].name), {
      nullable: false,
      parse: Datatype.boolean.parse,
      dependencies: appendDependencies(expr[PRIV].dependencies ?? [], subquery[PRIV]),
    });
  }

  function notInSubquery<RTable extends ITableQuery<any, any>>(
    expr: IExprUnknow,
    subquery: RTable,
  ): IExpr<boolean, false> {
    return create(builder.Expr.NotIn.tableName(expr.ast, subquery[PRIV].name), {
      nullable: false,
      parse: Datatype.boolean.parse,
      dependencies: appendDependencies(expr[PRIV].dependencies ?? [], subquery[PRIV]),
    });
  }

  function external<Val extends string | number | boolean | null>(
    val: Val,
    name?: string,
  ): IExpr<Val, [null] extends [Val] ? true : false> {
    const paramName = (name ?? '') + '_' + Random.createId();
    const ast = builder.Expr.BindParameter.colonNamed(paramName);
    const param: IExprAstParam = { name: paramName, value: val };
    Object.assign(ast, {
      [PRIV]: param,
    });
    return create(ast, {
      parse: Datatype.fromLiteral(val).parse,
      nullable: val === null,
    });
  }

  function column<Val, Nullable extends boolean>(
    table: Ast.Identifier | null,
    column: string,
    internal: IExprInternal,
  ): IExpr<Val, Nullable> {
    return create(builder.Expr.column({ column, table: table ? { table } : undefined }), internal);
  }

  function json_group_array<Val, Nullable extends boolean>(expr: IExpr<Val, Nullable>): IExpr<Array<Val>, Nullable> {
    return create(builder.Expr.AggregateFunctions.json_group_array({ params: wrapInJson(expr).ast }), {
      parse: (raw, json, nullable) => {
        if (nullable && raw === null) {
          return null;
        }
        const arr: any[] = json ? raw : JSON.parse(raw);
        return arr.map((item: any) => parseExprVal(expr, item, true));
      },
      jsonMode: 'JsonExpr',
      nullable: expr[PRIV].nullable,
    });
  }

  function json_object<Items extends Record<string, IExprUnknow>>(
    items: Items,
  ): IExpr<{ [K in keyof Items]: ExprResultFrom<Items[K]> }, false> {
    return create(
      builder.Expr.ScalarFunctions.json_object(
        ...Object.entries(items)
          .map(([name, value]): [Ast.Expr, Ast.Expr] => [builder.Expr.literal(name), wrapInJson(value).ast])
          .flat(),
      ),
      {
        parse: (raw, json) => {
          const obj = json ? raw : JSON.parse(raw);
          return mapObject(items, (name, expr) => parseExprVal(expr, obj[name], true));
        },
        jsonMode: 'JsonExpr',
        nullable: false,
      },
    );
  }

  /**
   * Wrap json refs in a json()
   */
  function wrapInJson<Expr extends IExprUnknow>(expr: Expr): Expr {
    const { jsonMode } = expr[PRIV];
    if (jsonMode === 'JsonRef') {
      return json(expr) as any;
    }
    return expr;
  }

  function json<Val, Nullable extends boolean>(expr: IExpr<Val, Nullable>): IExpr<Val, Nullable> {
    return create(builder.Expr.ScalarFunctions.json(expr.ast), {
      parse: expr[PRIV].parse,
      jsonMode: 'JsonExpr',
      nullable: expr[PRIV].nullable,
    });
  }

  function createLiteral<Val extends string | number | boolean | null>(
    val: Val,
  ): IExpr<Val, [null] extends [Val] ? true : false> {
    return create(builder.Expr.literal(val), { parse: Datatype.fromLiteral(val).parse, nullable: val === null });
  }

  function parseExprVal<Val, Nullable extends boolean>(expr: IExpr<Val, Nullable>, raw: any, json: boolean): Val {
    return expr[PRIV].parse(raw, json, expr[PRIV].nullable);
  }

  function someNullable(...exprs: IExprUnknow[]): boolean {
    return exprs.some((expr) => expr[PRIV].nullable);
  }

  function mergeExprDependencies(...exprs: IExprUnknow[]): ITableQueryDependency[] {
    return exprs.flatMap((expr) => expr[PRIV].dependencies ?? []);
  }
})();
