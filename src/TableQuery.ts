import { Ast, builder, printNode, Utils } from 'zensqlite';
import { Expr, IExpr } from './Expr';
import { IQueryOperation } from './Operation';
import { Random } from './Random';
import { PRIV, TYPES } from './utils/constants';
import { extractParams } from './utils/params';
import { ColsBase, ColsFromSelect, ColumnsRef, SelectBase } from './utils/types';
import { mapObject } from './utils/utils';

export interface ITableQueryInternalParent {
  name: string;
  cte: Ast.Node<'CommonTableExpression'>;
  parents: Array<ITableQueryInternalParent>;
}

export interface ITableQueryInternalBase<InCols extends ColsBase, OutCols extends ColsBase> {
  readonly inputCols: ColumnsRef<InCols>;
  readonly outputCols: ColumnsRef<OutCols>;
  readonly from: Ast.Identifier; // table or cte name
  readonly parents: Array<ITableQueryInternalParent>;

  readonly where?: IExpr;
  readonly groupBy?: Array<IExpr>;
  readonly having?: IExpr;
  readonly select?: Array<Ast.Node<'ResultColumn'>>;
  readonly orderBy?: OrderingTerms;
  readonly limit?: IExpr;
  readonly offset?: IExpr;
}

export interface ITableQueryInternal<InCols extends ColsBase, OutCols extends ColsBase> extends ITableQueryInternalBase<InCols, OutCols> {
  // The current query as a cte
  readonly asCteName: Ast.Identifier;
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

export type ColsFn<InCols extends ColsBase, Result> = (cols: ColumnsRef<InCols>) => Result;
export type ColsFnOrRes<InCols extends ColsBase, Result> = ColsFn<InCols, Result> | Result;

export type AllColsFn<InCols extends ColsBase, OutCols extends ColsBase, Result> = (
  outCols: ColumnsRef<OutCols>,
  inCols: ColumnsRef<InCols>
) => Result;
export type AllColsFnOrRes<InCols extends ColsBase, OutCols extends ColsBase, Result> = AllColsFn<InCols, OutCols, Result> | Result;

export interface ITableQuery<InCols extends ColsBase, OutCols extends ColsBase> {
  readonly [TYPES]: { input: InCols; output: OutCols };
  readonly [PRIV]: ITableQueryInternal<InCols, OutCols>;

  // base operations (in order of execution)
  where(whereFn: ColsFn<InCols, IExpr>): ITableQuery<InCols, OutCols>;
  groupBy(groupFn: ColsFn<InCols, Array<IExpr>>): ITableQuery<InCols, OutCols>;
  having(havingFn: ColsFn<InCols, IExpr>): ITableQuery<InCols, OutCols>;
  select<NewCols extends SelectBase>(fn: ColsFn<InCols, NewCols>): ITableQuery<InCols, ColsFromSelect<NewCols>>;
  orderBy(orderByFn: AllColsFnOrRes<InCols, OutCols, OrderingTerms>): ITableQuery<InCols, OutCols>;
  limit(limitFn: AllColsFnOrRes<InCols, OutCols, IExpr>): ITableQuery<InCols, OutCols>;
  offset(offsetFn: AllColsFnOrRes<InCols, OutCols, IExpr>): ITableQuery<InCols, OutCols>;

  // join<RTable extends ITableQuery<any>, NewCols extends SelectBase>(
  //   table: RTable,
  //   expr: (lCols: ColumnsRef<Cols>, rCols: ColumnsRef<RTable[TYPES]>) => IExpr,
  //   select: (lCols: ColumnsRef<Cols>, rCols: ColumnsRef<RTable[TYPES]>) => NewCols
  // ): ITableQuery<ColsFromSelect<NewCols>>;

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

  function createFromTable<Cols extends ColsBase>(table: Ast.Identifier, columnsRef: ColumnsRef<Cols>): ITableQuery<Cols, Cols> {
    return create({
      parents: [],
      from: table,
      inputCols: columnsRef,
      outputCols: columnsRef,
    });
  }

  function create<InCols extends ColsBase, OutCols extends ColsBase>(
    internalBase: ITableQueryInternalBase<InCols, OutCols>
  ): ITableQuery<InCols, OutCols> {
    const internal: ITableQueryInternal<InCols, OutCols> = {
      ...internalBase,
      asCteName: builder.Expr.identifier(`cte_${Random.createId()}`),
    };

    const self: ITableQuery<InCols, OutCols> = {
      [PRIV]: internal,
      [TYPES]: {} as any,

      where,
      groupBy,
      having,
      select,
      orderBy,
      limit,
      offset,

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

    function where(whereFn: ColsFn<InCols, IExpr>): ITableQuery<InCols, OutCols> {
      const result = resolveColFn(whereFn)(internal.inputCols);
      if (result === internal.where) {
        return self;
      }
      return create({ ...internal, where: result });
    }

    function groupBy(groupFn: ColsFn<InCols, Array<IExpr>>): ITableQuery<InCols, OutCols> {
      const groupBy = resolveColFn(groupFn)(internal.inputCols);
      if (groupBy === internal.groupBy) {
        return self;
      }
      return create({ ...internal, groupBy });
    }

    function having(havingFn: ColsFn<InCols, IExpr>): ITableQuery<InCols, OutCols> {
      const having = resolveColFn(havingFn)(internal.inputCols);
      if (having === internal.having) {
        return self;
      }
      return create({ ...internal, having });
    }

    function select<NewCols extends SelectBase>(selectFn: ColsFn<InCols, NewCols>): ITableQuery<InCols, ColsFromSelect<NewCols>> {
      const result = resolveColFn(selectFn)(internal.inputCols);
      const { select, columnsRef } = resolvedColumns(internal.from, result);
      return create({ ...internal, select, outputCols: columnsRef });
    }

    function orderBy(orderByFn: AllColsFnOrRes<InCols, OutCols, OrderingTerms>): ITableQuery<InCols, OutCols> {
      const result = resolveAllColFn(orderByFn)(internal.outputCols, internal.inputCols);
      if (result === internal.orderBy) {
        return self;
      }
      return create({ ...internal, orderBy: result });
    }

    function limit(limitFn: AllColsFnOrRes<InCols, OutCols, IExpr>): ITableQuery<InCols, OutCols> {
      const result = resolveAllColFn(limitFn)(internal.outputCols, internal.inputCols);
      if (result === internal.limit) {
        return self;
      }
      return create({ ...internal, limit: result });
    }

    function offset(offsetFn: AllColsFnOrRes<InCols, OutCols, IExpr>): ITableQuery<InCols, OutCols> {
      const result = resolveAllColFn(offsetFn)(internal.outputCols, internal.inputCols);
      if (result === internal.offset) {
        return self;
      }
      return create({ ...internal, offset: result });
    }

    // function join<RTable extends ITableQuery<any>, NewCols extends SelectBase>(
    //   table: RTable,
    //   expr: (lCols: ColumnsRef<Cols>, rCols: ColumnsRef<RTable[TYPES]>) => IExpr,
    //   select: (lCols: ColumnsRef<Cols>, rCols: ColumnsRef<RTable[TYPES]>) => NewCols
    // ): ITableQuery<ColsFromSelect<NewCols>> {
    //   const asCte = Boolean(internal.columns || internal.where || internal.join);
    //   return maybeAsCte(self, asCte, (internal) => {
    //     return maybeAsCte(table);
    //     const joinedCte = buildCteInternal(table[PRIV]);
    //     const joinedInternal = joinedCte ?? table[PRIV];
    //     const { columns, columnsRef } = resolvedColumns(internal.from, select(internal.columnsRef, joinedInternal.columnsRef));
    //     const join: Ast.Node<'JoinClause'> = {
    //       kind: 'JoinClause',
    //       tableOrSubquery: builder.TableOrSubquery.Table(internal.from.name),
    //       joins: [
    //         {
    //           joinOperator: builder.JoinOperator.Join('Left'),
    //           tableOrSubquery: builder.TableOrSubquery.Table(joinedInternal.from.name),
    //           joinConstraint: builder.JoinConstraint.On(expr(internalBase.columnsRef, joinedInternal.columnsRef)),
    //         },
    //       ],
    //     };
    //     return {
    //       ...internal,
    //       columns,
    //       columnsRef,
    //       join,
    //       parents: joinedCte ? [...internal.parents, toParent(joinedCte.from, joinedCte)] : internalBase.parents,
    //     };
    //   });
    // }

    // function take(config: number | ITakeConfig): ITableQuery<Cols> {
    //   const limitNum = typeof config === 'number' ? config : config.limit;
    //   const offsetNum = typeof config === 'number' ? undefined : config.offset;
    //   return create({
    //     ...internalBase,
    //     limit: Expr.external(limitNum),
    //     offset: offsetNum ? Expr.external(offsetNum) : undefined,
    //   });
    // }

    // function paginate(config: number | IPaginateConfig): ITableQuery<Cols> {
    //   const size = typeof config === 'number' ? config : config.size;
    //   const page = (typeof config === 'number' ? undefined : config.page) ?? 1;
    //   if (page < 1) {
    //     throw new Error('Page must be greater than 0');
    //   }
    //   return take({ limit: size, offset: (page - 1) * size });
    // }

    // function filter(filters: FilterEqual<Cols>): ITableQuery<Cols> {
    //   const cols = internal.columnsRef;
    //   const whereExprs = Object.entries(filters)
    //     .map(([key, value]): IExpr | null => {
    //       const col = cols[key];
    //       if (!col) {
    //         console.warn(`Filtering on unknown column ${key}`);
    //         return null;
    //       }
    //       if (value === undefined) {
    //         return null;
    //       }
    //       if (value === null) {
    //         return Expr.isNull(col);
    //       }
    //       return Expr.equal(col, Expr.external(value));
    //     })
    //     .filter(isNotNull);

    //   if (whereExprs.length === 0) {
    //     return self;
    //   }
    //   const [first, ...rest] = whereExprs;
    //   if (rest.length === 0) {
    //     return where(first);
    //   }
    //   return where(rest.reduce((acc, expr) => Expr.and(acc, expr), first));
    // }

    // function groupByCol<NewCols extends SelectBase>(
    //   cols: Array<keyof Cols>,
    //   selectFn: ColsFnOrRes<Cols, NewCols>
    // ): ITableQuery<ColsFromSelect<NewCols>> {
    //   const result = cols
    //     .map((col): IExpr | null => {
    //       const colRef = internal.columnsRef[col];
    //       if (!colRef) {
    //         console.warn(`Grouping on unknown column ${String(col)}`);
    //         return null;
    //       }
    //       return colRef;
    //     })
    //     .filter(isNotNull);

    //   if (result.length === 0) {
    //     return select(selectFn);
    //   }
    //   return groupBy(result, selectFn);
    // }

    // function orderByCol(...cols: Array<keyof Cols | OrderByItem<Cols>>): ITableQuery<Cols> {
    //   const colsRef = internal.columnsRef;
    //   const result = cols
    //     .map((col): Ast.Node<'OrderingTerm'> | null => {
    //       const [colName, direction] = Array.isArray(col) ? col : ([col as keyof Cols, 'Asc'] as const);
    //       const colRef = colsRef[colName];
    //       if (!colRef) {
    //         console.warn(`Ordering on unknown column ${String(colName)}`);
    //         return null;
    //       }
    //       return { kind: 'OrderingTerm', expr: colRef, direction };
    //     })
    //     .filter(isNotNull);

    //   if (result.length === 0) {
    //     return self;
    //   }

    //   return orderBy(result);
    // }

    function all(): IQueryOperation<Array<OutCols>> {
      const node = buildFinalNode(internalBase);
      const params = extractParams(node);
      const sql = printNode(node);
      return {
        kind: 'Query',
        sql,
        params,
        parse: (rows) => {
          return rows.map((row) => mapObject(internalBase.outputCols, (key, col) => col[PRIV].parse(row[key], false)));
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

  function buildFinalNode(internal: ITableQueryInternalBase<ColsBase, ColsBase>): Ast.Node<'SelectStmt'> {
    const ctes = extractCtes(internal.parents);
    const select = buildSelectNode(internal);
    return {
      ...select,
      with: ctes.length === 0 ? undefined : { commonTableExpressions: Utils.arrayToNonEmptyArray(ctes) },
    };
  }

  function extractCtes(parents: Array<ITableQueryInternalParent>): Array<Ast.Node<'CommonTableExpression'>> {
    const alreadyIncluded = new Set<string>();
    const ctes: Array<Ast.Node<'CommonTableExpression'>> = [];
    traverse(parents);
    return ctes;

    function traverse(parents: Array<ITableQueryInternalParent>) {
      for (const parent of parents) {
        traverse(parent.parents);
        if (alreadyIncluded.has(parent.name)) {
          continue;
        }
        alreadyIncluded.add(parent.name);
        ctes.push(parent.cte);
      }
    }
  }

  function buildSelectNode(internal: ITableQueryInternalBase<ColsBase, ColsBase>): Ast.Node<'SelectStmt'> {
    return {
      kind: 'SelectStmt',
      select: {
        kind: 'SelectCore',
        variant: 'Select',
        from: builder.From.Table(internal.from.name),
        resultColumns: internal.select ? Utils.arrayToNonEmptyArray(internal.select) : [builder.ResultColumn.Star()],
        where: internal.where,
        groupBy: internal.groupBy ? { exprs: Utils.arrayToNonEmptyArray(internal.groupBy) } : undefined,
      },
      limit: internal.limit
        ? { expr: internal.limit, offset: internal.offset ? { separator: 'Offset', expr: internal.offset } : undefined }
        : undefined,
    };
  }

  function resolvedColumns(
    table: Ast.Identifier | null,
    selected: SelectBase
  ): { select: Array<Ast.Node<'ResultColumn'>>; columnsRef: ColumnsRef<any> } {
    const select = Object.entries(selected).map(([key, expr]): Ast.Node<'ResultColumn'> => {
      return builder.ResultColumn.Expr(expr, key);
    });
    const columnsRef = mapObject(selected, (col, expr) => Expr.column(col, expr[PRIV].parse, table ?? undefined));
    return { select, columnsRef };
  }

  function createCteFrom<OutCols extends ColsBase>(table: ITableQuery<ColsBase, OutCols>): ITableQuery<OutCols, OutCols> {
    const internal = table[PRIV];
    if (
      !internal.where &&
      !internal.groupBy &&
      !internal.having &&
      !internal.select &&
      !internal.orderBy &&
      !internal.limit &&
      !internal.offset
    ) {
      // Nothing was done to the table, so we can just return it
      return table as any;
    }
    const parent: ITableQueryInternalParent = {
      cte: {
        kind: 'CommonTableExpression',
        tableName: internal.asCteName,
        select: buildSelectNode(internal),
      },
      name: internal.asCteName.name,
      parents: internal.parents,
    };
    const colsRef = mapObject(internal.outputCols, (key, col) => Expr.column(key, col[PRIV].parse, internal.asCteName));

    return create({
      from: internal.asCteName,
      parents: [parent],
      inputCols: colsRef,
      outputCols: colsRef,
    });
  }
})();
