import { Ast, builder, JoinItem, printNode, Utils } from 'zensqlite';
import { Expr, IExpr } from './Expr';
import { IQueryOperation } from './Operation';
import { Random } from './Random';
import { PRIV, TYPES } from './utils/constants';
import { extractParams } from './utils/params';
import { ColsBase, ColsFromSelect, ColsRefBase, ExprRecordFrom, SelectBase } from './utils/types';
import { mapObject } from './utils/utils';

export interface ITableQueryState {
  readonly where?: IExpr;
  readonly groupBy?: Array<IExpr>;
  readonly having?: IExpr;
  readonly select?: Array<Ast.Node<'ResultColumn'>>;
  readonly orderBy?: OrderingTerms;
  readonly limit?: IExpr;
  readonly offset?: IExpr;
  readonly joins?: Array<JoinItem>;
}

export interface ITableQueryInternalBase<InColsRefs extends ColsRefBase, OutCols extends ColsBase> {
  readonly inputColsRefs: InColsRefs;
  // Identifiers of the columns of the current query
  readonly outputColsRefs: ExprRecordFrom<OutCols>;
  // Selected expressions of the current query
  readonly outputColsExprs: ExprRecordFrom<OutCols>;
  readonly from: Ast.Identifier; // table or cte name
  readonly parents: Array<ITableQueryInternal<any, any>>;

  readonly state: ITableQueryState;
}

export interface ITableQueryInternal<InColsRefs extends ColsRefBase, OutCols extends ColsBase>
  extends ITableQueryInternalBase<InColsRefs, OutCols> {
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

export type OrderByItem<Cols extends ColsBase> = [keyof Cols, 'Asc' | 'Desc'];

export type OrderingTerms = Array<Ast.Node<'OrderingTerm'>>;

export type SelectFn<InColsRef extends ColsRefBase, CurrentColsRefs extends ColsRefBase, Result> = (
  cols: InColsRef,
  current: CurrentColsRefs
) => Result;

export type ColsFn<InColsRef extends ColsRefBase, Result> = (cols: InColsRef) => Result;
export type ColsFnOrRes<InColsRef extends ColsRefBase, Result> = ColsFn<InColsRef, Result> | Result;

export type AllColsFn<InColsRef extends ColsRefBase, OutCols extends ColsBase, Result> = (
  inCols: InColsRef,
  outCols: ExprRecordFrom<OutCols>
) => Result;
export type AllColsFnOrRes<InColsRef extends ColsRefBase, OutCols extends ColsBase, Result> =
  | AllColsFn<InColsRef, OutCols, Result>
  | Result;

export type ColsRefJoined<Base extends ColsRefBase, RTable extends ITableQuery<any, any>, Alias extends string> = Base & {
  [K in Alias]: ExprRecordFrom<RTable[TYPES]>;
};

export interface ITableQuery<InColsRefs extends ColsRefBase, OutCols extends ColsBase> {
  readonly [TYPES]: OutCols;
  readonly [PRIV]: ITableQueryInternal<InColsRefs, OutCols>;

  // base operations (in order of execution)
  where(whereFn: ColsFn<InColsRefs, IExpr>): ITableQuery<InColsRefs, OutCols>;
  groupBy(groupFn: ColsFn<InColsRefs, Array<IExpr>>): ITableQuery<InColsRefs, OutCols>;
  having(havingFn: ColsFn<InColsRefs, IExpr>): ITableQuery<InColsRefs, OutCols>;
  select<NewCols extends SelectBase>(
    selectFn: SelectFn<InColsRefs, ExprRecordFrom<OutCols>, NewCols>
  ): ITableQuery<InColsRefs, ColsFromSelect<NewCols>>;

  orderBy(orderByFn: AllColsFnOrRes<InColsRefs, OutCols, OrderingTerms>): ITableQuery<InColsRefs, OutCols>;
  limit(limitFn: AllColsFnOrRes<InColsRefs, OutCols, IExpr>): ITableQuery<InColsRefs, OutCols>;
  offset(offsetFn: AllColsFnOrRes<InColsRefs, OutCols, IExpr>): ITableQuery<InColsRefs, OutCols>;

  join<RTable extends ITableQuery<any, any>, Alias extends string>(
    table: RTable,
    alias: Alias,
    joinOn: (cols: ColsRefJoined<InColsRefs, RTable, Alias>) => IExpr
  ): ITableQuery<ColsRefJoined<InColsRefs, RTable, Alias>, OutCols>;

  /**
   *
   */
  populate<Field extends string, Table extends ITableQuery<any, any>, Value>(
    field: Field,
    leftExpr: (cols: InColsRefs) => IExpr,
    table: Table,
    rightKey: (cols: ExprRecordFrom<Table[TYPES]>) => IExpr,
    rightExpr: (cols: ExprRecordFrom<Table[TYPES]>) => IExpr<Value>
  ): ITableQuery<InColsRefs, OutCols & { [K in Field]: Value }>;

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
  all(): IQueryOperation<Array<OutCols>>;
  // Throw if result count is not === 1
  one(): IQueryOperation<OutCols>;
  // Throw if result count is > 1
  maybeOne(): IQueryOperation<OutCols | null>;
  // Throw if result count is === 0
  first(): IQueryOperation<OutCols>;
  // Never throws
  maybeFirst(): IQueryOperation<OutCols | null>;
}

export const TableQuery = (() => {
  return { createFromTable, createCteFrom };

  function createFromTable<Cols extends ColsBase>(
    table: Ast.Identifier,
    columnsRef: ExprRecordFrom<Cols>
  ): ITableQuery<ExprRecordFrom<Cols>, Cols> {
    return create(
      {
        parents: [],
        from: table,
        inputColsRefs: columnsRef,
        outputColsRefs: columnsRef,
        outputColsExprs: columnsRef,
        state: {},
      },
      true
    );
  }

  function create<InColsRefs extends ColsRefBase, OutCols extends ColsBase>(
    internalBase: ITableQueryInternalBase<InColsRefs, OutCols>,
    isBaseTable: boolean = false
  ): ITableQuery<InColsRefs, OutCols> {
    const internal: ITableQueryInternal<InColsRefs, OutCols> = {
      ...internalBase,
      isBaseTable,
      asCteName: builder.Expr.identifier(`cte_${Random.createId()}`),
    };

    const self: ITableQuery<InColsRefs, OutCols> = {
      [PRIV]: internal,
      [TYPES]: {} as any,

      where,
      groupBy,
      having,
      select,
      orderBy,
      limit,
      offset,

      join,
      populate,

      // filter,
      // take,
      // paginate,
      // groupByCol,
      // orderByCol,

      all,
      one,
      maybeOne,
      first,
      maybeFirst,
    };

    return self;

    function where(whereFn: ColsFn<InColsRefs, IExpr>): ITableQuery<InColsRefs, OutCols> {
      const result = resolveColFn(whereFn)(internal.inputColsRefs);
      if (result === internal.state.where) {
        return self;
      }
      return create({ ...internal, state: { ...internal.state, where: result } });
    }

    function groupBy(groupFn: ColsFn<InColsRefs, Array<IExpr>>): ITableQuery<InColsRefs, OutCols> {
      const groupBy = resolveColFn(groupFn)(internal.inputColsRefs);
      if (groupBy === internal.state.groupBy) {
        return self;
      }
      return create({ ...internal, state: { ...internal.state, groupBy } });
    }

    function having(havingFn: ColsFn<InColsRefs, IExpr>): ITableQuery<InColsRefs, OutCols> {
      const having = resolveColFn(havingFn)(internal.inputColsRefs);
      if (having === internal.state.having) {
        return self;
      }
      return create({ ...internal, state: { ...internal.state, having } });
    }

    function select<NewCols extends SelectBase>(
      selectFn: SelectFn<InColsRefs, ExprRecordFrom<OutCols>, NewCols>
    ): ITableQuery<InColsRefs, ColsFromSelect<NewCols>> {
      const nextOutputColsExprs = selectFn(internal.inputColsRefs, internal.outputColsExprs);
      if (nextOutputColsExprs === internal.outputColsExprs) {
        return self as any;
      }
      const { select, columnsRef } = resolvedColumns(internal.from, nextOutputColsExprs);
      return create({
        ...internal,
        outputColsRefs: nextOutputColsExprs,
        outputColsExprs: columnsRef,
        state: { ...internal.state, select },
      });
    }

    function orderBy(orderByFn: AllColsFnOrRes<InColsRefs, OutCols, OrderingTerms>): ITableQuery<InColsRefs, OutCols> {
      const result = resolveAllColFn(orderByFn)(internal.inputColsRefs, internal.outputColsRefs);
      if (result === internal.state.orderBy) {
        return self;
      }
      return create({ ...internal, state: { ...internal.state, orderBy: result } });
    }

    function limit(limitFn: AllColsFnOrRes<InColsRefs, OutCols, IExpr>): ITableQuery<InColsRefs, OutCols> {
      const result = resolveAllColFn(limitFn)(internal.inputColsRefs, internal.outputColsRefs);
      if (result === internal.state.limit) {
        return self;
      }
      return create({ ...internal, state: { ...internal.state, limit: result } });
    }

    function offset(offsetFn: AllColsFnOrRes<InColsRefs, OutCols, IExpr>): ITableQuery<InColsRefs, OutCols> {
      const result = resolveAllColFn(offsetFn)(internal.inputColsRefs, internal.outputColsRefs);
      if (result === internal.state.offset) {
        return self;
      }
      return create({ ...internal, state: { ...internal.state, offset: result } });
    }

    function join<RTable extends ITableQuery<any, any>, Alias extends string>(
      table: RTable,
      alias: Alias,
      joinOn: (cols: ColsRefJoined<InColsRefs, RTable, Alias>) => IExpr
    ): ITableQuery<ColsRefJoined<InColsRefs, RTable, Alias>, OutCols> {
      const tableCte = createCteFrom(table);

      const newInColsRef: ColsRefJoined<InColsRefs, RTable, Alias> = {
        ...internal.inputColsRefs,
        [alias]: tableCte[PRIV].outputColsRefs,
      };

      const joinItem: JoinItem = {
        joinOperator: builder.JoinOperator.Join('Left'),
        tableOrSubquery: builder.TableOrSubquery.Table(table[PRIV].from.name),
        joinConstraint: builder.JoinConstraint.On(joinOn(newInColsRef)),
      };
      return create({
        ...internal,
        inputColsRefs: newInColsRef,
        state: {
          ...internal.state,
          joins: [...(internal.state.joins ?? []), joinItem],
        },
        parents: mergeParent(internal.parents, table[PRIV]),
      });
    }

    function populate<Field extends string, Table extends ITableQuery<any, any>, Value>(
      field: Field,
      leftExpr: (cols: InColsRefs) => IExpr,
      table: Table,
      rightKey: (cols: ExprRecordFrom<Table[TYPES]>) => IExpr,
      rightExpr: (cols: ExprRecordFrom<Table[TYPES]>) => IExpr<Value>
    ): ITableQuery<InColsRefs, OutCols & { [K in Field]: Value }> {
      const tableGrouped = createCteFrom(table)
        .groupBy((cols) => [rightKey(cols)])
        .select((cols) => ({
          key: rightKey(cols),
          value: Expr.AggregateFunctions.json_group_array(rightExpr(cols)),
        }));
      const joinItem: JoinItem = {
        joinOperator: builder.JoinOperator.Join('Left'),
        tableOrSubquery: builder.TableOrSubquery.Table(table[PRIV].from.name),
        joinConstraint: builder.JoinConstraint.On(Expr.equal(leftExpr(internal.inputColsRefs), tableGrouped[PRIV].outputColsRefs.key)),
      };
      const joined = create({
        ...internal,
        state: {
          ...internal.state,
          joins: [...(internal.state.joins ?? []), joinItem],
        },
        parents: mergeParent(internal.parents, tableGrouped[PRIV]),
      });

      return joined.select((_cols, prev) => ({
        ...prev,
        [field]: tableGrouped[PRIV].outputColsRefs.value,
      })) as any;
    }

    // --------------

    function all(): IQueryOperation<Array<OutCols>> {
      const node = buildFinalNode(internalBase);
      const params = extractParams(node);
      const sql = printNode(node);
      return {
        kind: 'Query',
        sql,
        params,
        parse: (rows) => {
          return rows.map((row) => mapObject(internalBase.outputColsRefs, (key, col) => col[PRIV].parse(row[key], false)));
        },
      };
    }

    function maybeOne(): IQueryOperation<OutCols | null> {
      const allOp = limit(() => Expr.literal(1)).all();
      return {
        ...allOp,
        parse: (rows) => {
          const res = allOp.parse(rows);
          return res.length === 0 ? null : res[0];
        },
      };
    }

    function one(): IQueryOperation<OutCols> {
      const maybeOneOp = maybeOne();
      return {
        ...maybeOneOp,
        parse: (rows) => {
          const res = maybeOneOp.parse(rows);
          if (res === null) {
            throw new Error('Expected one row, got 0');
          }
          return res;
        },
      };
    }

    function maybeFirst(): IQueryOperation<OutCols | null> {
      const allOp = all();
      return {
        ...allOp,
        parse: (rows) => {
          const res = allOp.parse(rows);
          return res.length === 0 ? null : res[0];
        },
      };
    }

    function first(): IQueryOperation<OutCols> {
      const maybeFirstOp = maybeFirst();
      return {
        ...maybeFirstOp,
        parse: (rows) => {
          const res = maybeFirstOp.parse(rows);
          if (res === null) {
            throw new Error('Expected one row, got 0');
          }
          return res;
        },
      };
    }
  }

  function resolveColFn<Cols extends ColsBase, Result>(fn: ColsFnOrRes<Cols, Result>): ColsFn<Cols, Result> {
    const fnResolved: ColsFn<Cols, Result> = typeof fn === 'function' ? (fn as any) : () => fn;
    return fnResolved;
  }

  function resolveAllColFn<InCols extends ColsBase, OutCols extends ColsBase, Result>(
    fn: AllColsFnOrRes<InCols, OutCols, Result>
  ): AllColsFn<InCols, OutCols, Result> {
    const fnResolved: AllColsFn<InCols, OutCols, Result> = typeof fn === 'function' ? (fn as any) : () => fn;
    return fnResolved;
  }

  // function buildCteInternal(internal: ITableQueryInternal<any>): ITableQueryInternalBase<any> | null {
  //   if (
  //     !internal.columns &&
  //     !internal.where &&
  //     !internal.join &&
  //     !internal.groupBy &&
  //     !internal.orderBy &&
  //     !internal.limit &&
  //     !internal.offset
  //   ) {
  //     return null;
  //   }

  //   const columnsRef = mapObject(internal.columnsRef, (key, col) => Expr.column(internal.asCteName, key, col[PRIV].parse));
  //   return {
  //     from: internal.asCteName,
  //     parents: [toParent(internal.asCteName, internal)],
  //     columnsRef,
  //   };
  // }

  // function toParent(cteFrom: Ast.Identifier, internal: ITableQueryInternalBase<any>): ITableQueryInternalParent {
  //   return {
  //     name: cteFrom.name,
  //     cte: {
  //       kind: 'CommonTableExpression',
  //       tableName: cteFrom,
  //       select: buildSelectNode(internal),
  //     },
  //     parents: internal.parents,
  //   };
  // }

  function buildFinalNode(internal: ITableQueryInternalBase<any, any>): Ast.Node<'SelectStmt'> {
    const ctes = extractCtes(internal);
    const select = buildSelectNode(internal);
    return {
      ...select,
      with: ctes.length === 0 ? undefined : { commonTableExpressions: Utils.arrayToNonEmptyArray(ctes) },
    };
  }

  function extractCtes(internal: ITableQueryInternalBase<any, any>): Array<Ast.Node<'CommonTableExpression'>> {
    const alreadyIncluded = new Set<string>();
    const ctes: Array<Ast.Node<'CommonTableExpression'>> = [];
    traverse(internal.parents);
    return ctes;

    function traverse(parents: Array<ITableQueryInternal<any, any>>) {
      for (const parent of parents) {
        traverse(parent.parents);
        const name = parent.asCteName.name;
        if (alreadyIncluded.has(name)) {
          continue;
        }
        alreadyIncluded.add(name);
        ctes.push({
          kind: 'CommonTableExpression',
          tableName: parent.asCteName,
          select: buildSelectNode(parent),
        });
      }
    }
  }

  function buildSelectNode(internal: ITableQueryInternalBase<ColsBase, ColsBase>): Ast.Node<'SelectStmt'> {
    const { state } = internal;
    const [firstJoin, ...restJoins] = state.joins || [];

    return {
      kind: 'SelectStmt',
      select: {
        kind: 'SelectCore',
        variant: 'Select',
        from: firstJoin
          ? builder.From.Joins(builder.TableOrSubquery.Table(internal.from.name), firstJoin, ...restJoins)
          : builder.From.Table(internal.from.name),
        resultColumns: state.select ? Utils.arrayToNonEmptyArray(state.select) : [builder.ResultColumn.Star()],
        where: state.where,
        groupBy: state.groupBy ? { exprs: Utils.arrayToNonEmptyArray(state.groupBy) } : undefined,
      },
      limit: state.limit
        ? { expr: state.limit, offset: state.offset ? { separator: 'Offset', expr: state.offset } : undefined }
        : undefined,
    };
  }

  function resolvedColumns(
    table: Ast.Identifier | null,
    selected: SelectBase
  ): { select: Array<Ast.Node<'ResultColumn'>>; columnsRef: ExprRecordFrom<any> } {
    const select = Object.entries(selected).map(([key, expr]): Ast.Node<'ResultColumn'> => {
      return builder.ResultColumn.Expr(expr, key);
    });
    const columnsRef = mapObject(selected, (col, expr) => Expr.column(col, expr[PRIV].parse, table ?? undefined));
    return { select, columnsRef };
  }

  function createCteFrom<OutCols extends ColsBase>(table: ITableQuery<ColsBase, OutCols>): ITableQuery<ExprRecordFrom<OutCols>, OutCols> {
    const parentInternal = table[PRIV];
    if (parentInternal.isBaseTable) {
      return table as any;
    }
    const hasState = Object.values(parentInternal.state).some((v) => v !== undefined);
    if (!hasState) {
      return table as any;
    }

    const colsRef = mapObject(parentInternal.outputColsRefs, (key, col) => Expr.column(key, col[PRIV].parse, parentInternal.asCteName));

    return create({
      from: parentInternal.asCteName,
      parents: [parentInternal],
      inputColsRefs: colsRef,
      outputColsRefs: colsRef,
      outputColsExprs: colsRef,
      state: {},
    });
  }

  function mergeParent(
    prevParents: Array<ITableQueryInternal<any, any>>,
    parent: ITableQueryInternal<any, any>
  ): Array<ITableQueryInternal<any, any>> {
    if (parent.isBaseTable) {
      return prevParents;
    }
    return [...prevParents, parent];
  }

  // join<RTable extends ITableQuery<any>, NewCols extends SelectBase>(
  //   table: RTable,
  //   expr: (lCols: ColumnsRef<Cols>, rCols: ColumnsRef<RTable[TYPES]>) => IExpr,
  //   select: (lCols: ColumnsRef<Cols>, rCols: ColumnsRef<RTable[TYPES]>) => NewCols
  // ): ITableQuery<ColsFromSelect<NewCols>>;

  // function join<LeftTable extends ITableQuery<any, any>, RightTable extends ITableQuery<any, any>>() {

  // }
})();
