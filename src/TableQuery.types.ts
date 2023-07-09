import { Ast, JoinItem } from '@dldc/sqlite';
import { IExprUnknow } from './Expr';
import { IQueryOperation } from './Operation';
import { PRIV, TYPES } from './utils/constants';
import {
  AnyRecord,
  ExprRecord,
  ExprRecordNested,
  ExprRecordOutput,
  ExprRecord_MakeNullable,
  ExprResultFrom,
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

export interface ITableQueryInternalBase<InCols extends ExprRecordNested, OutCols extends ExprRecord> {
  readonly inputColsRefs: InCols;
  // Identifiers of the columns of the current query
  readonly outputColsRefs: OutCols;
  // Selected expressions of the current query
  readonly outputColsExprs: OutCols;
  readonly from: Ast.Identifier; // table or cte name
  readonly parents: Array<ITableQueryInternal<any, any>>;

  readonly state: ITableQueryState;
}

export interface ITableQueryInternal<InCols extends ExprRecordNested, OutCols extends ExprRecord>
  extends ITableQueryInternalBase<InCols, OutCols> {
  // The current query as a cte
  readonly asCteName: Ast.Identifier;
  readonly isBaseTable: boolean;
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

export type FilterEqualCols<InCols extends ExprRecordNested> = Partial<
  {
    [K in keyof InCols]: InCols[K] extends IExprUnknow
      ? { [K2 in K & string]: ExprResultFrom<InCols[K]> }
      : {
          [K2 in keyof InCols[K] as `${K & string}.${K2 & string}`]: InCols[K][K2] extends IExprUnknow
            ? ExprResultFrom<InCols[K][K2]>
            : never;
        };
  }[keyof InCols]
>;

export interface ITableQuery<InCols extends ExprRecordNested, OutCols extends ExprRecord> {
  readonly [TYPES]: OutCols;
  readonly [PRIV]: ITableQueryInternal<InCols, OutCols>;

  // Operations before select
  where(whereFn: ColsFn<InCols, IExprUnknow>): ITableQuery<InCols, OutCols>;
  groupBy(groupFn: ColsFn<InCols, Array<IExprUnknow>>): ITableQuery<InCols, OutCols>;
  having(havingFn: ColsFn<InCols, IExprUnknow>): ITableQuery<InCols, OutCols>;
  // Select
  select<NewOutCols extends ExprRecord>(
    selectFn: SelectFn<InCols, OutCols, NewOutCols>,
  ): ITableQuery<InCols, NewOutCols>;
  // Operations after select
  orderBy(orderByFn: AllColsFnOrRes<InCols, OutCols, OrderingTerms>): ITableQuery<InCols, OutCols>;
  limit(limitFn: AllColsFnOrRes<InCols, OutCols, IExprUnknow>): ITableQuery<InCols, OutCols>;
  offset(offsetFn: AllColsFnOrRes<InCols, OutCols, IExprUnknow>): ITableQuery<InCols, OutCols>;

  // Shortcuts
  filterEqual(filters: Prettify<FilterEqualCols<InCols>>): ITableQuery<InCols, OutCols>;

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
  // filter(filters: FilterEqual<Cols>): ITableQuery<Cols>;
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
