import type { Ast, builder } from "@dldc/sqlite";
import type { IQueryOperation } from "./Operation.ts";
import type { TExprUnknow } from "./expr/Expr.ts";
import type { PRIV, TYPES } from "./utils/constants.ts";
import type {
  AnyRecord,
  ExprRecord,
  ExprRecord_MakeNullable,
  ExprRecordNested,
  ExprRecordOutput,
  FilterEqualCols,
  Prettify,
} from "./utils/types.ts";

export interface ITableQueryState {
  readonly where?: TExprUnknow;
  readonly groupBy?: Array<TExprUnknow>;
  readonly having?: TExprUnknow;
  readonly select?: Array<Ast.Node<"ResultColumn">>;
  readonly orderBy?: OrderingTerms;
  readonly limit?: TExprUnknow;
  readonly offset?: TExprUnknow;
  readonly joins?: Array<builder.SelectStmt.JoinItem>;
}

export interface ICreateTableQueryParams<
  InCols extends ExprRecordNested,
  OutCols extends ExprRecord,
> {
  readonly inputColsRefs: InCols;
  // Identifiers of the columns of the current query
  readonly outputColsRefs: OutCols;
  // Selected expressions of the current query
  readonly outputColsExprs: OutCols;
  // table or cte name
  readonly from: Ast.Identifier;
  // The current query state (select, filters, order, etc.)
  readonly state: ITableQueryState;
  // parent queries
  readonly dependencies: Array<ITableQueryDependency>;
}

export interface ITableQueryDependency {
  // table or cte name
  readonly from: Ast.Identifier;
  // The current query state (select, filters, order, etc.)
  readonly state: ITableQueryState;
  // Name to use if we need to reference this query
  readonly name: Ast.Identifier;
}

// The added properties are computed when creating a new TableQuery
export interface ITableQueryInternal<
  InCols extends ExprRecordNested,
  OutCols extends ExprRecord,
> extends ITableQueryDependency {
  readonly inputColsRefs: InCols;
  // Identifiers of the columns of the current query
  readonly outputColsRefs: OutCols;
  // Selected expressions of the current query
  readonly outputColsExprs: OutCols;
  // parent queries
  readonly dependencies: Array<ITableQueryDependency>;
}

export interface ITakeConfig {
  limit: number;
  offset?: number;
}

export interface IPaginateConfig {
  size: number;
  page?: number;
}

export type OrderByItem<Cols extends AnyRecord> = [keyof Cols, "Asc" | "Desc"];

export type OrderingTerms = Array<Ast.Node<"OrderingTerm">>;

export type SelectFn<
  InColsRef extends ExprRecordNested,
  CurrentColsRefs extends ExprRecordNested,
  Result,
> = (
  cols: InColsRef,
  current: CurrentColsRefs,
) => Result;

export type ColsFn<InColsRef extends ExprRecordNested, Result> = (
  cols: InColsRef,
) => Result;
export type ColsFnOrRes<InColsRef extends ExprRecordNested, Result> =
  | ColsFn<InColsRef, Result>
  | Result;

export type AllColsFn<
  InCols extends ExprRecordNested,
  OutCols extends ExprRecord,
  Result,
> = (
  inCols: InCols,
  outCols: OutCols,
) => Result;

export type AllColsFnOrRes<
  InCols extends ExprRecordNested,
  OutCols extends AnyRecord,
  Result,
> =
  | AllColsFn<InCols, OutCols, Result>
  | Result;

export type ColsRefInnerJoined<
  Base extends ExprRecordNested,
  RTable extends ITableQuery<any, any>,
  Alias extends string,
> =
  & Base
  & {
    [K in Alias]: RTable[TYPES];
  };

export type ColsRefLeftJoined<
  Base extends ExprRecordNested,
  RTable extends ITableQuery<any, any>,
  Alias extends string,
> =
  & Base
  & {
    [K in Alias]: ExprRecord_MakeNullable<RTable[TYPES]>;
  };

export interface ITableQuery<
  InCols extends ExprRecordNested,
  OutCols extends ExprRecord,
> {
  readonly [TYPES]: OutCols;
  readonly [PRIV]: ITableQueryInternal<InCols, OutCols>;

  /**
   * Set the WHERE clause, this will replace any previous WHERE clause
   * @param whereFn An expression function that should return an expression
   */
  where(whereFn: ColsFn<InCols, TExprUnknow>): ITableQuery<InCols, OutCols>;

  /**
   * Add conditions to the WHERE clause using en AND operator
   * @param whereFn An expression function that should return an expression
   */
  andWhere(whereFn: ColsFn<InCols, TExprUnknow>): ITableQuery<InCols, OutCols>;

  /**
   * .andWhere() shortcut to filter on equality, values passed wiil be injected as variables (Expr.external)
   * @param filters An object with the columns to filter
   */
  andFilterEqual(
    filters: Prettify<FilterEqualCols<InCols>>,
  ): ITableQuery<InCols, OutCols>;

  /**
   * Set the GROUP BY clause, this will replace any previous GROUP BY clause
   * @param groupFn An expression function that should return an array of expressions
   */
  groupBy(
    groupFn: ColsFn<InCols, Array<TExprUnknow>>,
  ): ITableQuery<InCols, OutCols>;

  /**
   * Add items to GROUP BY clause expression list
   * @param groupFn An expression function that should return an array of expressions
   */
  andGroupBy(
    groupFn: ColsFn<InCols, Array<TExprUnknow>>,
  ): ITableQuery<InCols, OutCols>;

  /**
   * Set the HAVING clause, this will replace any previous HAVING clause.
   * @param havingFn An expression function that should return an expression
   */
  having(havingFn: ColsFn<InCols, TExprUnknow>): ITableQuery<InCols, OutCols>;

  /**
   * Add conditions to the HAVING clause using en AND operator
   * @param havingFn An expression function that should return an expression
   */
  andHaving(
    havingFn: ColsFn<InCols, TExprUnknow>,
  ): ITableQuery<InCols, OutCols>;

  /**
   * Set the selected columns, this will replace any previous select clause
   * @param selectFn An expression function that should return an object with the columns to select. This expression will receive as a second argument the current selected columns
   */
  select<NewOutCols extends ExprRecord>(
    selectFn: SelectFn<InCols, OutCols, NewOutCols>,
  ): ITableQuery<InCols, NewOutCols>;

  /**
   * Set the ORDER BY clause, this will replace any previous order clause.
   * For most use cases, you should use `andSortAsc` or `andSortDesc` instead
   * @param orderByFn An expression function that should return an array of OrderingTerm objects (also accept the OrderingTerm array directly)
   */
  orderBy(
    orderByFn: AllColsFnOrRes<InCols, OutCols, OrderingTerms>,
  ): ITableQuery<InCols, OutCols>;

  /**
   * Add a `expression ASC` to the existing ORDER BY clause
   * @param exprFn An expression function that should return an expression, usually `c => c.myColumn`
   */
  andSortAsc(exprFn: ColsFn<InCols, TExprUnknow>): ITableQuery<InCols, OutCols>;

  /**
   * Add a `expression DESC` to the existing ORDER BY clause
   * @param exprFn An expression function that should return an expression, usually `c => c.myColumn`
   */
  andSortDesc(
    exprFn: ColsFn<InCols, TExprUnknow>,
  ): ITableQuery<InCols, OutCols>;

  /**
   * Set the LIMIT clause, this will replace any previous LIMIT clause
   * @param limitFn An expression function that should return an expression, usually `Expr.external(myLimit)`
   */
  limit(
    limitFn: AllColsFnOrRes<InCols, OutCols, TExprUnknow>,
  ): ITableQuery<InCols, OutCols>;

  /**
   * Set the OFFSET clause, this will replace any previous OFFSET clause
   * @param offsetFn An expression function that should return an expression, usually `Expr.external(myOffset)`
   */
  offset(
    offsetFn: AllColsFnOrRes<InCols, OutCols, TExprUnknow>,
  ): ITableQuery<InCols, OutCols>;

  /**
   * Create an INNER JOIN with another table.
   * @param table A Query object, usually created by `schema.someTable.query()`
   * @param alias string that will be used as an alias for the table. This will be used to reference the columns of the table in the expression function.
   * @param joinOn An expression function that should return a boolean expression that will be used to join the tables
   */
  innerJoin<RTable extends ITableQuery<any, any>, Alias extends string>(
    table: RTable,
    alias: Alias,
    joinOn: (cols: ColsRefInnerJoined<InCols, RTable, Alias>) => TExprUnknow,
  ): ITableQuery<ColsRefInnerJoined<InCols, RTable, Alias>, OutCols>;

  /**
   * Create a LEFT JOIN with another table. The joined columns will be nullable as the join may not find a match
   * @param table A Query object, usually created by `schema.someTable.query()`
   * @param alias string that will be used as an alias for the table. This will be used to reference the columns of the table in the expression function.
   * @param joinOn An expression function that should return a boolean expression that will be used to join the tables
   */
  leftJoin<RTable extends ITableQuery<any, any>, Alias extends string>(
    table: RTable,
    alias: Alias,
    joinOn: (cols: ColsRefLeftJoined<InCols, RTable, Alias>) => TExprUnknow,
  ): ITableQuery<ColsRefLeftJoined<InCols, RTable, Alias>, OutCols>;

  /**
   * Return an Database operation that will execute the query and return all the results
   */
  all(): IQueryOperation<Array<Prettify<ExprRecordOutput<OutCols>>>>;

  /**
   * Return an Database operation that will execute the query and return a single result
   * If no result is found, will return null
   * If more than one result is found, will throw
   */
  maybeOne(): IQueryOperation<Prettify<ExprRecordOutput<OutCols>> | null>;

  /**
   * Return an Database operation that will execute the query and return a single result
   * If results count is not exactly 1, will throw
   */
  one(): IQueryOperation<Prettify<ExprRecordOutput<OutCols>>>;

  /**
   * Return an Database operation that will execute the query and return the first result
   * This will override any limit clause by `LIMIT 1`
   * If no result is found, will return null
   */
  maybeFirst(): IQueryOperation<Prettify<ExprRecordOutput<OutCols>> | null>;

  /**
   * Return an Database operation that will execute the query and return the first result
   * This will override any limit clause by `LIMIT 1`
   * If no result is found, will throw
   */
  first(): IQueryOperation<Prettify<ExprRecordOutput<OutCols>>>;
}
