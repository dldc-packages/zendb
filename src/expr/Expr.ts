import type { Ast } from "@dldc/sqlite";
import { builder, Utils } from "@dldc/sqlite";
import * as Datatype from "../Datatype.ts";
import type { ITableQuery, ITableQueryDependency } from "../Query.types.ts";
import * as Random from "../Random.ts";
import { PRIV, TYPES } from "../utils/constants.ts";
import { appendDependencies } from "../utils/dependencies.ts";
import { expectNever, mapObject, maybeParseJson } from "../utils/functions.ts";
import type { ExprResultFrom, ExprsNullables } from "../utils/types.ts";

export * as Aggregate from "./Aggregate.ts";

export interface TExpr<Val, Nullable extends boolean> {
  readonly ast: Ast.Expr;
  readonly [TYPES]: { val: Val; nullable: Nullable };
  readonly [PRIV]: TExprInternal;
}

// Any value maybe nullable
export type TExprUnknow = TExpr<any, boolean>;

// Any value but not nullable
export type TExprAny = TExpr<any, false>;

// json option is set to true when the expression was already JSON parsed
export type TExprParser = (raw: any, json: boolean, nullable: boolean) => any;

export type TJsonMode = "JsonExpr" | "JsonRef" | undefined;

// Data attached to [PRIV] on ast nodes that represent external values
export type TExprAstParam = { readonly name?: string; readonly value: any };

export interface TExprInternal {
  readonly parse: TExprParser;
  readonly nullable: boolean;
  // JsonExpr is transformed to JsonRef when converted to a ref
  // JsonRef is wrapped in a json() function when unsed in other json functions
  readonly jsonMode?: TJsonMode;
  // Used for X in (select X from ...) where the target is a CTE that needs to be defined
  readonly dependencies?: Array<ITableQueryDependency>;
}

export function create<Val, Nullable extends boolean>(
  expr: Ast.Expr,
  internal: TExprInternal,
): TExpr<Val, Nullable> {
  return { ast: expr, [PRIV]: internal, [TYPES]: {} as any };
}

export function literal<Val extends string | number | boolean | null>(
  val: Val,
): TExpr<Val, [null] extends [Val] ? true : false> {
  return createLiteral<Val>(val);
}

export function add<
  L extends TExpr<number, boolean>,
  R extends TExpr<number, boolean>,
>(
  left: L,
  right: L,
): TExpr<number, ExprsNullables<[L, R]>> {
  return create(builder.Operations.add(left.ast, right.ast), {
    parse: Datatype.number.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

export function equal<L extends TExprUnknow, R extends TExprUnknow>(
  left: L,
  right: R,
): TExpr<boolean, L[TYPES]["nullable"] | R[TYPES]["nullable"]> {
  return create(builder.Operations.equal(left.ast, right.ast), {
    parse: Datatype.boolean.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

export function compare<L extends TExprUnknow, R extends L[TYPES]["val"]>(
  left: L,
  operator: "<" | "<=" | ">" | ">=" | "=" | "!=",
  right: R,
): TExpr<boolean, L[TYPES]["nullable"]> {
  const rExpr = external(right);
  switch (operator) {
    case "<":
      return lowerThan(left, rExpr);
    case "<=":
      return lowerThanOrEqual(left, rExpr);
    case ">":
      return greaterThan(left, rExpr);
    case ">=":
      return greaterThanOrEqual(left, rExpr);
    case "=":
      return equal(left, rExpr);
    case "!=":
      return different(left, rExpr);
    default:
      return expectNever(operator);
  }
}

export function different<L extends TExprUnknow, R extends TExprUnknow>(
  left: L,
  right: R,
): TExpr<boolean, ExprsNullables<[L, R]>> {
  return create(builder.Operations.different(left.ast, right.ast), {
    parse: Datatype.boolean.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

export function like<L extends TExprUnknow, R extends TExprUnknow>(
  left: L,
  right: R,
): TExpr<boolean, ExprsNullables<[L, R]>> {
  return create(builder.Operations.like(left.ast, right.ast), {
    parse: Datatype.boolean.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

export function or<L extends TExprUnknow, R extends TExprUnknow>(
  left: L,
  right: R,
): TExpr<boolean, ExprsNullables<[L, R]>> {
  return create(builder.Operations.or(left.ast, right.ast), {
    parse: Datatype.boolean.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

export function and<L extends TExprUnknow, R extends TExprUnknow>(
  left: L,
  right: R,
): TExpr<boolean, ExprsNullables<[L, R]>> {
  return create(builder.Operations.and(left.ast, right.ast), {
    parse: Datatype.boolean.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

export function not<E extends TExprUnknow>(
  expr: E,
): TExpr<boolean, E[TYPES]["nullable"]> {
  return create(builder.Operations.not(expr.ast), {
    parse: Datatype.boolean.parse,
    nullable: expr[PRIV].nullable,
    dependencies: expr[PRIV].dependencies,
  });
}

export function notNull(expr: TExprUnknow): TExpr<boolean, false> {
  return create(builder.Operations.notNull(expr.ast), {
    parse: Datatype.boolean.parse,
    nullable: false,
  });
}

export function lowerThan<L extends TExprUnknow, R extends TExprUnknow>(
  left: L,
  right: R,
): TExpr<boolean, ExprsNullables<[L, R]>> {
  return create(builder.Operations.lowerThan(left.ast, right.ast), {
    parse: Datatype.boolean.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

export function lowerThanOrEqual<L extends TExprUnknow, R extends TExprUnknow>(
  left: L,
  right: R,
): TExpr<boolean, ExprsNullables<[L, R]>> {
  return create(builder.Operations.lowerThanOrEqual(left.ast, right.ast), {
    parse: Datatype.boolean.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

export function greaterThan<L extends TExprUnknow, R extends TExprUnknow>(
  left: L,
  right: R,
): TExpr<boolean, ExprsNullables<[L, R]>> {
  return create(builder.Operations.greaterThan(left.ast, right.ast), {
    parse: Datatype.boolean.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

function greaterThanOrEqual<L extends TExprUnknow, R extends TExprUnknow>(
  left: L,
  right: R,
): TExpr<boolean, ExprsNullables<[L, R]>> {
  return create(builder.Operations.greaterThanOrEqual(left.ast, right.ast), {
    parse: Datatype.boolean.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

export function concatenate<
  L extends TExpr<string, boolean>,
  R extends TExpr<string, boolean>,
>(
  left: L,
  right: R,
): TExpr<string, ExprsNullables<[L, R]>> {
  return create(builder.Operations.concatenate(left.ast, right.ast), {
    parse: Datatype.text.parse,
    nullable: someNullable(left, right),
    dependencies: mergeExprDependencies(left, right),
  });
}

export function isNull(expr: TExprUnknow): TExpr<boolean, false> {
  return create(builder.Operations.isNull(expr.ast), {
    parse: Datatype.boolean.parse,
    nullable: false,
    dependencies: expr[PRIV].dependencies,
  });
}

export function inList(
  left: TExprUnknow,
  items: TExprUnknow[],
): TExpr<boolean, false> {
  return create(
    builder.Operations.inList(
      left.ast,
      Utils.arrayToNonEmptyArray(items.map((item) => item.ast)),
    ),
    {
      nullable: false,
      parse: Datatype.boolean.parse,
      dependencies: mergeExprDependencies(left, ...items),
    },
  );
}

export function notInList(
  left: TExprUnknow,
  items: TExprUnknow[],
): TExpr<boolean, false> {
  return create(
    builder.Operations.notInList(
      left.ast,
      Utils.arrayToNonEmptyArray(items.map((item) => item.ast)),
    ),
    {
      nullable: false,
      parse: Datatype.boolean.parse,
      dependencies: mergeExprDependencies(left, ...items),
    },
  );
}

export function inSubquery<RTable extends ITableQuery<any, any>>(
  expr: TExprUnknow,
  subquery: RTable,
): TExpr<boolean, false> {
  return create(
    builder.Operations.inTableName(expr.ast, subquery[PRIV].name),
    {
      nullable: false,
      parse: Datatype.boolean.parse,
      dependencies: appendDependencies(
        expr[PRIV].dependencies ?? [],
        subquery[PRIV],
      ),
    },
  );
}

export function notInSubquery<RTable extends ITableQuery<any, any>>(
  expr: TExprUnknow,
  subquery: RTable,
): TExpr<boolean, false> {
  return create(
    builder.Operations.notInTableName(expr.ast, subquery[PRIV].name),
    {
      nullable: false,
      parse: Datatype.boolean.parse,
      dependencies: appendDependencies(
        expr[PRIV].dependencies ?? [],
        subquery[PRIV],
      ),
    },
  );
}

export function external<Val extends string | number | boolean | null>(
  val: Val,
  name?: string,
): TExpr<Val, [null] extends [Val] ? true : false> {
  const paramName = (name ?? "") + "_" + Random.createId();
  const ast = builder.BindParameter.colonNamed(paramName);
  const param: TExprAstParam = { name: paramName, value: val };
  Object.assign(ast, {
    [PRIV]: param,
  });
  return create(ast, {
    parse: Datatype.fromLiteral(val).parse,
    nullable: val === null,
  });
}

export function column<Val, Nullable extends boolean>(
  table: Ast.Identifier | null,
  column: string,
  internal: TExprInternal,
): TExpr<Val, Nullable> {
  return create(
    builder.Expr.column({ column, table: table ? { table } : undefined }),
    internal,
  );
}

export function jsonGroupArray<Val, Nullable extends boolean>(
  expr: TExpr<Val, Nullable>,
): TExpr<Array<Val>, Nullable> {
  return create(
    builder.Aggregate.json_group_array({
      params: wrapInJson(expr).ast,
    }),
    {
      parse: (raw, json, nullable) => {
        if (nullable && raw === null) {
          return null;
        }
        const arr: any[] = json ? raw : maybeParseJson(raw);
        return arr.map((item: any) => parseExprVal(expr, item, true));
      },
      jsonMode: "JsonExpr",
      nullable: expr[PRIV].nullable,
    },
  );
}

export function jsonObj<Items extends Record<string, TExprUnknow>>(
  items: Items,
): TExpr<{ [K in keyof Items]: ExprResultFrom<Items[K]> }, false> {
  return create(
    builder.Functions.json_object(
      ...Object.entries(items)
        .map((
          [name, value],
        ): [Ast.Expr, Ast.Expr] => [
          builder.Literal.literal(name),
          wrapInJson(value).ast,
        ])
        .flat(),
    ),
    {
      parse: (raw, json) => {
        const obj = json ? raw : maybeParseJson(raw);
        return mapObject(
          items,
          (name, expr) => parseExprVal(expr, obj[name], true),
        );
      },
      jsonMode: "JsonExpr",
      nullable: false,
    },
  );
}

/**
 * Wrap json refs in a json()
 */
export function wrapInJson<Expr extends TExprUnknow>(expr: Expr): Expr {
  const { jsonMode } = expr[PRIV];
  if (jsonMode === "JsonRef") {
    return json(expr) as any;
  }
  return expr;
}

export function json<Val, Nullable extends boolean>(
  expr: TExpr<Val, Nullable>,
): TExpr<Val, Nullable> {
  return create(builder.Functions.json(expr.ast), {
    parse: expr[PRIV].parse,
    jsonMode: "JsonExpr",
    nullable: expr[PRIV].nullable,
  });
}

export function createLiteral<Val extends string | number | boolean | null>(
  val: Val,
): TExpr<Val, [null] extends [Val] ? true : false> {
  return create(builder.Literal.literal(val), {
    parse: Datatype.fromLiteral(val).parse,
    nullable: val === null,
  });
}

export function parseExprVal<Val, Nullable extends boolean>(
  expr: TExpr<Val, Nullable>,
  raw: any,
  json: boolean,
): Val {
  return expr[PRIV].parse(raw, json, expr[PRIV].nullable);
}

export function someNullable(...exprs: TExprUnknow[]): boolean {
  return exprs.some((expr) => expr[PRIV].nullable);
}

export function mergeExprDependencies(
  ...exprs: TExprUnknow[]
): ITableQueryDependency[] {
  return exprs.flatMap((expr) => expr[PRIV].dependencies ?? []);
}
