import type { Ast, JoinItem } from '@dldc/sqlite';
import { Utils, builder, printNode } from '@dldc/sqlite';
import type { IExprUnknow, JsonMode } from './Expr';
import { Expr } from './Expr';
import type { IQueryOperation } from './Operation';
import { Random } from './Random';
import type {
  AllColsFn,
  AllColsFnOrRes,
  ColsFn,
  ColsFnOrRes,
  ColsRefInnerJoined,
  ColsRefLeftJoined,
  ITableQuery,
  ITableQueryInternal,
  ITableQueryInternalBase,
  OrderingTerms,
  SelectFn,
} from './TableQuery.types';
import { ZendbErreur } from './ZendbErreur';
import { PRIV, TYPES } from './utils/constants';
import { mapObject } from './utils/functions';
import { extractParams } from './utils/params';
import type { AnyRecord, ExprRecord, ExprRecordNested, ExprRecordOutput, FilterEqualCols } from './utils/types';
import { whereEqual } from './utils/whereEqual';

export const TableQuery = (() => {
  return { createFromTable, createCteFrom };

  function createFromTable<Cols extends ExprRecord>(table: Ast.Identifier, columnsRef: Cols): ITableQuery<Cols, Cols> {
    return create(
      {
        parents: [],
        from: table,
        inputColsRefs: columnsRef,
        outputColsRefs: columnsRef,
        outputColsExprs: columnsRef,
        state: {},
      },
      true,
    );
  }

  function create<InCols extends ExprRecordNested, OutCols extends ExprRecord>(
    internalBase: ITableQueryInternalBase<InCols, OutCols>,
    isBaseTable: boolean = false,
  ): ITableQuery<InCols, OutCols> {
    const internal: ITableQueryInternal<InCols, OutCols> = {
      ...internalBase,
      isBaseTable,
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

      // Shortcuts
      filterEqual,

      // joins
      innerJoin,
      leftJoin,
      // populate,

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

    function where(whereFn: ColsFn<InCols, IExprUnknow>): ITableQuery<InCols, OutCols> {
      const result = resolveColFn(whereFn)(internal.inputColsRefs);
      if (internal.state.where) {
        const whereAnd = Expr.and(internal.state.where, result);
        return create({ ...internal, state: { ...internal.state, where: whereAnd } });
      }
      return create({ ...internal, state: { ...internal.state, where: result } });
    }

    function groupBy(groupFn: ColsFn<InCols, Array<IExprUnknow>>): ITableQuery<InCols, OutCols> {
      const groupBy = resolveColFn(groupFn)(internal.inputColsRefs);
      return create({ ...internal, state: { ...internal.state, groupBy } });
    }

    function having(havingFn: ColsFn<InCols, IExprUnknow>): ITableQuery<InCols, OutCols> {
      const having = resolveColFn(havingFn)(internal.inputColsRefs);
      if (having === internal.state.having) {
        return self;
      }
      return create({ ...internal, state: { ...internal.state, having } });
    }

    function select<NewOutCols extends ExprRecord>(
      selectFn: SelectFn<InCols, OutCols, NewOutCols>,
    ): ITableQuery<InCols, NewOutCols> {
      const nextOutputColsExprs = selectFn(internal.inputColsRefs, internal.outputColsExprs);
      // Why does TS complains here ?
      if ((nextOutputColsExprs as any) === internal.outputColsExprs) {
        return self as any;
      }
      const { select, columnsRef } = resolvedColumns(internal.from, nextOutputColsExprs);
      return create<InCols, NewOutCols>({
        ...internal,
        outputColsRefs: nextOutputColsExprs,
        outputColsExprs: columnsRef as any,
        state: { ...internal.state, select },
      });
    }

    function orderBy(orderByFn: AllColsFnOrRes<InCols, OutCols, OrderingTerms>): ITableQuery<InCols, OutCols> {
      const result = resolveAllColFn(orderByFn)(internal.inputColsRefs, resolveLocalColumns(internal.outputColsRefs));
      if (result === internal.state.orderBy) {
        return self;
      }
      return create({ ...internal, state: { ...internal.state, orderBy: result } });
    }

    function limit(limitFn: AllColsFnOrRes<InCols, OutCols, IExprUnknow>): ITableQuery<InCols, OutCols> {
      const result = resolveAllColFn(limitFn)(internal.inputColsRefs, resolveLocalColumns(internal.outputColsRefs));
      if (result === internal.state.limit) {
        return self;
      }
      return create({ ...internal, state: { ...internal.state, limit: result } });
    }

    function offset(offsetFn: AllColsFnOrRes<InCols, OutCols, IExprUnknow>): ITableQuery<InCols, OutCols> {
      const result = resolveAllColFn(offsetFn)(internal.inputColsRefs, resolveLocalColumns(internal.outputColsRefs));
      if (result === internal.state.offset) {
        return self;
      }
      return create({ ...internal, state: { ...internal.state, offset: result } });
    }

    function innerJoin<RTable extends ITableQuery<any, any>, Alias extends string>(
      table: RTable,
      alias: Alias,
      joinOn: (cols: ColsRefInnerJoined<InCols, RTable, Alias>) => IExprUnknow,
    ): ITableQuery<ColsRefInnerJoined<InCols, RTable, Alias>, OutCols> {
      const tableCte = createCteFrom(table);

      const newInColsRef: ColsRefInnerJoined<InCols, RTable, Alias> = {
        ...internal.inputColsRefs,
        [alias]: tableCte[PRIV].outputColsRefs,
      };

      const joinItem: JoinItem = {
        joinOperator: builder.JoinOperator.InnerJoin(),
        tableOrSubquery: builder.TableOrSubquery.Table(table[PRIV].from.name),
        joinConstraint: builder.JoinConstraint.On(joinOn(newInColsRef).ast),
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

    function leftJoin<RTable extends ITableQuery<any, any>, Alias extends string>(
      table: RTable,
      alias: Alias,
      joinOn: (cols: ColsRefLeftJoined<InCols, RTable, Alias>) => IExprUnknow,
    ): ITableQuery<ColsRefLeftJoined<InCols, RTable, Alias>, OutCols> {
      const tableCte = createCteFrom(table);

      const newInColsRef: ColsRefLeftJoined<InCols, RTable, Alias> = {
        ...internal.inputColsRefs,
        [alias]: mapObject(
          tableCte[PRIV].outputColsRefs,
          (_, col: IExprUnknow): IExprUnknow => ({ ...col, [PRIV]: { ...col[PRIV], nullable: true } }),
        ),
      };

      const joinItem: JoinItem = {
        joinOperator: builder.JoinOperator.Join('Left'),
        tableOrSubquery: builder.TableOrSubquery.Table(table[PRIV].from.name),
        joinConstraint: builder.JoinConstraint.On(joinOn(newInColsRef).ast),
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

    function filterEqual(filters: Partial<FilterEqualCols<InCols>>): ITableQuery<InCols, OutCols> {
      return where((cols) => whereEqual(cols, filters));
    }

    // function populate<Field extends string, Table extends ITableQuery<any, any>, Value>(
    //   field: Field,
    //   leftExpr: (cols: InCols) => IExpr,
    //   table: Table,
    //   rightKey: (cols: ExprRecordFrom<Table[TYPES]>) => IExpr,
    //   rightExpr: (cols: ExprRecordFrom<Table[TYPES]>) => IExpr<Value>
    // ): ITableQuery<InCols, OutCols & { [K in Field]: Value }> {
    //   const tableGrouped = createCteFrom(table)
    //     .groupBy((cols) => [rightKey(cols)])
    //     .select((cols) => ({
    //       key: rightKey(cols),
    //       value: Expr.AggregateFunctions.json_group_array(rightExpr(cols)),
    //     }));
    //   const joinItem: JoinItem = {
    //     joinOperator: builder.JoinOperator.Join('Left'),
    //     tableOrSubquery: builder.TableOrSubquery.Table(table[PRIV].from.name),
    //     joinConstraint: builder.JoinConstraint.On(Expr.equal(leftExpr(internal.inputColsRefs), tableGrouped[PRIV].outputColsRefs.key)),
    //   };
    //   const joined = create({
    //     ...internal,
    //     state: {
    //       ...internal.state,
    //       joins: [...(internal.state.joins ?? []), joinItem],
    //     },
    //     parents: mergeParent(internal.parents, tableGrouped[PRIV]),
    //   });

    //   return joined.select((_cols, prev) => ({
    //     ...prev,
    //     [field]: tableGrouped[PRIV].outputColsRefs.value,
    //   })) as any;
    // }

    // --------------

    function all(): IQueryOperation<Array<ExprRecordOutput<OutCols>>> {
      const node = buildFinalNode(internalBase);
      const params = extractParams(node);
      const sql = printNode(node);
      return {
        kind: 'Query',
        sql,
        params,
        parse: (rows) => {
          return rows.map((row) =>
            mapObject(internalBase.outputColsRefs, (key, col) => col[PRIV].parse(row[key], false)),
          );
        },
      };
    }

    function maybeOne(): IQueryOperation<ExprRecordOutput<OutCols> | null> {
      const allOp = limit(() => Expr.literal(1)).all();
      return {
        ...allOp,
        parse: (rows) => {
          const res = allOp.parse(rows);
          return res.length === 0 ? null : res[0];
        },
      };
    }

    function one(): IQueryOperation<ExprRecordOutput<OutCols>> {
      const maybeOneOp = maybeOne();
      return {
        ...maybeOneOp,
        parse: (rows) => {
          const res = maybeOneOp.parse(rows);
          if (res === null) {
            throw ZendbErreur.NoRows();
          }
          return res;
        },
      };
    }

    function maybeFirst(): IQueryOperation<ExprRecordOutput<OutCols> | null> {
      const allOp = all();
      return {
        ...allOp,
        parse: (rows) => {
          const res = allOp.parse(rows);
          return res.length === 0 ? null : res[0];
        },
      };
    }

    function first(): IQueryOperation<ExprRecordOutput<OutCols>> {
      const maybeFirstOp = maybeFirst();
      return {
        ...maybeFirstOp,
        parse: (rows) => {
          const res = maybeFirstOp.parse(rows);
          if (res === null) {
            throw ZendbErreur.NoRows();
          }
          return res;
        },
      };
    }
  }

  function resolveColFn<Cols extends AnyRecord, Result>(fn: ColsFnOrRes<Cols, Result>): ColsFn<Cols, Result> {
    const fnResolved: ColsFn<Cols, Result> = typeof fn === 'function' ? (fn as any) : () => fn;
    return fnResolved;
  }

  function resolveAllColFn<InCols extends AnyRecord, OutCols extends AnyRecord, Result>(
    fn: AllColsFnOrRes<InCols, OutCols, Result>,
  ): AllColsFn<InCols, OutCols, Result> {
    const fnResolved: AllColsFn<InCols, OutCols, Result> = typeof fn === 'function' ? (fn as any) : () => fn;
    return fnResolved;
  }

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

  function buildSelectNode(internal: ITableQueryInternalBase<AnyRecord, AnyRecord>): Ast.Node<'SelectStmt'> {
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
        where: state.where?.ast,
        groupBy: state.groupBy ? { exprs: Utils.arrayToNonEmptyArray(state.groupBy.map((e) => e.ast)) } : undefined,
      },
      orderBy: state.orderBy ? Utils.arrayToNonEmptyArray(state.orderBy) : undefined,
      limit: state.limit
        ? { expr: state.limit.ast, offset: state.offset ? { separator: 'Offset', expr: state.offset.ast } : undefined }
        : undefined,
    };
  }

  function resolveLocalColumns<Cols extends ExprRecord>(cols: Cols): Cols {
    return mapObject(cols, (key, col): any => Expr.column(null, key, col[PRIV]));
  }

  function resolvedColumns(
    table: Ast.Identifier,
    selected: ExprRecord,
  ): { select: Array<Ast.Node<'ResultColumn'>>; columnsRef: ExprRecord } {
    const select = Object.entries(selected).map(([key, expr]): Ast.Node<'ResultColumn'> => {
      return builder.ResultColumn.Expr(expr.ast, key);
    });
    const columnsRef = exprsToRefs(table, selected);
    return { select, columnsRef };
  }

  function exprsToRefs(table: Ast.Identifier, exprs: ExprRecord): ExprRecord {
    return mapObject(exprs, (col, expr) => {
      const exprJsonMode = expr[PRIV].jsonMode;
      const jsonMode: JsonMode | undefined =
        exprJsonMode === 'JsonExpr' || exprJsonMode === 'JsonRef' ? 'JsonRef' : undefined;
      return Expr.column(table, col, { parse: expr[PRIV].parse, jsonMode, nullable: expr[PRIV].nullable });
    });
  }

  function createCteFrom<Table extends ITableQuery<ExprRecordNested, ExprRecord>>(
    table: Table,
  ): ITableQuery<Table[TYPES], Table[TYPES]> {
    const parentInternal = table[PRIV];
    if (parentInternal.isBaseTable) {
      return table as any;
    }
    const hasState = Object.values(parentInternal.state).some((v) => v !== undefined);
    if (!hasState) {
      return table as any;
    }

    const colsRef = mapObject(parentInternal.outputColsRefs, (key, col) => {
      const jsonMode: JsonMode | undefined = col[PRIV].jsonMode === undefined ? undefined : 'JsonRef';
      return Expr.column(parentInternal.asCteName, key, {
        parse: col[PRIV].parse,
        jsonMode,
        nullable: col[PRIV].nullable,
      });
    });

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
    parent: ITableQueryInternal<any, any>,
  ): Array<ITableQueryInternal<any, any>> {
    if (parent.isBaseTable) {
      return prevParents;
    }
    return [...prevParents, parent];
  }
})();
