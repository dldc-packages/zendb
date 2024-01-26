import type { Ast, JoinItem } from '@dldc/sqlite';
import type { IExprUnknow } from './Expr';
import type { IQueryOperation } from './Operation';
import type { PRIV, TYPES } from './utils/constants';
import type {
  AnyRecord,
  ExprRecord,
  ExprRecordNested,
  ExprRecordOutput,
  ExprRecord_MakeNullable,
  FilterEqualCols,
  Prettify,
} from './utils/types';

export interface ITableQueryState {
  readonly where?: IExprUnknow;
  readonly groupBy?: Array<IExprUnknow>;
  readonly having?: IExprUnknow;
  readonly select?: Array<Ast.Node<'ResultColumn'>>;
  readonly orderBy?: OrderingTerms;
  readonly limit?: IExprUnknow;
  readonly offset?: IExprUnknow;
  readonly joins?: Array<JoinItem>;
}

export interface ICreateTableQueryParams<InCols extends ExprRecordNested, OutCols extends ExprRecord> {
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
export interface ITableQueryInternal<InCols extends ExprRecordNested, OutCols extends ExprRecord>
  extends ITableQueryDependency {
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

export type OrderByItem<Cols extends AnyRecord> = [keyof Cols, 'Asc' | 'Desc'];

export type OrderingTerms = Array<Ast.Node<'OrderingTerm'>>;

export type SelectFn<InColsRef extends ExprRecordNested, CurrentColsRefs extends ExprRecordNested, Result> = (
  cols: InColsRef,
  current: CurrentColsRefs,
) => Result;

export type ColsFn<InColsRef extends ExprRecordNested, Result> = (cols: InColsRef) => Result;
export type ColsFnOrRes<InColsRef extends ExprRecordNested, Result> = ColsFn<InColsRef, Result> | Result;

export type AllColsFn<InCols extends ExprRecordNested, OutCols extends ExprRecord, Result> = (
  inCols: InCols,
  outCols: OutCols,
) => Result;

export type AllColsFnOrRes<InCols extends ExprRecordNested, OutCols extends AnyRecord, Result> =
  | AllColsFn<InCols, OutCols, Result>
  | Result;

export type ColsRefInnerJoined<
  Base extends ExprRecordNested,
  RTable extends ITableQuery<any, any>,
  Alias extends string,
> = Base & {
  [K in Alias]: RTable[TYPES];
};

export type ColsRefLeftJoined<
  Base extends ExprRecordNested,
  RTable extends ITableQuery<any, any>,
  Alias extends string,
> = Base & {
  [K in Alias]: ExprRecord_MakeNullable<RTable[TYPES]>;
};

export interface ITableQuery<InCols extends ExprRecordNested, OutCols extends ExprRecord> {
  readonly [TYPES]: OutCols;
  readonly [PRIV]: ITableQueryInternal<InCols, OutCols>;

  // - Where
  /**
   * Add conditions to the where clause, you can call it multiple times (AND)
   */
  where(whereFn: ColsFn<InCols, IExprUnknow>): ITableQuery<InCols, OutCols>;
  /**
   * .where() shortcut to filter on equality
   */
  filterEqual(filters: Prettify<FilterEqualCols<InCols>>): ITableQuery<InCols, OutCols>;
  // - Group
  groupBy(groupFn: ColsFn<InCols, Array<IExprUnknow>>): ITableQuery<InCols, OutCols>;
  // - Having
  having(havingFn: ColsFn<InCols, IExprUnknow>): ITableQuery<InCols, OutCols>;
  // Select
  select<NewOutCols extends ExprRecord>(
    selectFn: SelectFn<InCols, OutCols, NewOutCols>,
  ): ITableQuery<InCols, NewOutCols>;
  // - Order
  /**
   * Set the order by clause, this will replace any previous order clause
   */
  orderBy(orderByFn: AllColsFnOrRes<InCols, OutCols, OrderingTerms>): ITableQuery<InCols, OutCols>;
  /**
   * Add an order by clause, this will not replace any previous order clause
   */
  sortAsc(exprFn: ColsFn<InCols, IExprUnknow>): ITableQuery<InCols, OutCols>;
  /**
   * Add an order by clause, this will not replace any previous order clause
   */
  sortDesc(exprFn: ColsFn<InCols, IExprUnknow>): ITableQuery<InCols, OutCols>;
  // - Limit / Offset
  limit(limitFn: AllColsFnOrRes<InCols, OutCols, IExprUnknow>): ITableQuery<InCols, OutCols>;
  offset(offsetFn: AllColsFnOrRes<InCols, OutCols, IExprUnknow>): ITableQuery<InCols, OutCols>;

  // Joins
  innerJoin<RTable extends ITableQuery<any, any>, Alias extends string>(
    table: RTable,
    alias: Alias,
    joinOn: (cols: ColsRefInnerJoined<InCols, RTable, Alias>) => IExprUnknow,
  ): ITableQuery<ColsRefInnerJoined<InCols, RTable, Alias>, OutCols>;
  leftJoin<RTable extends ITableQuery<any, any>, Alias extends string>(
    table: RTable,
    alias: Alias,
    joinOn: (cols: ColsRefLeftJoined<InCols, RTable, Alias>) => IExprUnknow,
  ): ITableQuery<ColsRefLeftJoined<InCols, RTable, Alias>, OutCols>;

  // shortcut for ease of use
  // take(config: number | ITakeConfig): ITableQuery<Cols>;
  // paginate(config: number | IPaginateConfig): ITableQuery<Cols>;
  // groupByCol<NewCols extends SelectBase>(
  //   cols: Array<keyof Cols>,
  //   selectFn: ColsFnOrRes<Cols, NewCols>
  // ): ITableQuery<ColsFromSelect<NewCols>>;
  // orderByCol(...cols: Array<keyof Cols | OrderByItem<Cols>>): ITableQuery<Cols>;

  // Returns an Array
  all(): IQueryOperation<Array<Prettify<ExprRecordOutput<OutCols>>>>;
  // Throw if result count is > 1
  maybeOne(): IQueryOperation<Prettify<ExprRecordOutput<OutCols>> | null>;
  // Throw if result count is not === 1
  one(): IQueryOperation<Prettify<ExprRecordOutput<OutCols>>>;
  // Never throws
  maybeFirst(): IQueryOperation<Prettify<ExprRecordOutput<OutCols>> | null>;
  // Throw if result count is === 0
  first(): IQueryOperation<Prettify<ExprRecordOutput<OutCols>>>;
}
