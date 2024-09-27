import { Ast, builder, printNode, Utils } from "@dldc/sqlite";
import { ExprUtils } from "../mod.ts";
import type { TExprUnknow, TJsonMode } from "./expr/Expr.ts";
import * as Expr from "./expr/Expr.ts";
import type { TQueryOperation } from "./Operation.ts";
import type {
  AllColsFn,
  AllColsFnOrRes,
  ColsFn,
  ColsFnOrRes,
  ColsRefInnerJoined,
  ColsRefLeftJoined,
  OrderingTerms,
  SelectFn,
  TCreateTableQueryParams,
  TTableQuery,
  TTableQueryDependency,
  TTableQueryInternal,
} from "./Query.types.ts";
import * as Random from "./Random.ts";
import { PRIV, TYPES } from "./utils/constants.ts";
import { appendDependencies, mergeDependencies } from "./utils/dependencies.ts";
import { mapObject } from "./utils/functions.ts";
import { isStateEmpty } from "./utils/isStateEmpty.ts";
import { markColumnsNullable } from "./utils/markColumnsNullable.ts";
import { extractParams } from "./utils/params.ts";
import { remapColumnsTables } from "./utils/remapColumnsTables.ts";
import type {
  AnyRecord,
  ExprRecord,
  ExprRecordNested,
  ExprRecordOutput,
  FilterEqualCols,
} from "./utils/types.ts";
import { whereEqual } from "./utils/whereEqual.ts";
import { createNoRows, createTooManyRows } from "./ZendbErreur.ts";

export function queryFromTable<Cols extends ExprRecord>(
  table: Ast.Identifier,
  columnsRef: Cols,
): TTableQuery<Cols, Cols> {
  return createQuery({
    dependencies: [],
    from: table,
    inputColsRefs: columnsRef,
    outputColsRefs: columnsRef,
    outputColsExprs: columnsRef,
    state: {},
  });
}

export function queryFrom<
  Query extends TTableQuery<ExprRecordNested, ExprRecord>,
>(query: Query): TTableQuery<Query[TYPES], Query[TYPES]> {
  const internal = query[PRIV];
  if (isStateEmpty(internal.state)) {
    // if there are no state, there is no need to create a CTE
    return query as any;
  }
  const colsRef = mapObject(internal.outputColsRefs, (key, col) => {
    const jsonMode: TJsonMode | undefined = col[PRIV].jsonMode === undefined
      ? undefined
      : "JsonRef";
    return Expr.column(internal.name, key, {
      parse: col[PRIV].parse,
      jsonMode,
      nullable: col[PRIV].nullable,
    });
  });

  return createQuery({
    from: internal.name,
    dependencies: [internal, ...internal.dependencies],
    inputColsRefs: colsRef,
    outputColsRefs: colsRef,
    outputColsExprs: colsRef,
    state: {},
  });
}

function createQuery<
  InCols extends ExprRecordNested,
  OutCols extends ExprRecord,
>(
  params: TCreateTableQueryParams<InCols, OutCols>,
): TTableQuery<InCols, OutCols> {
  const isEmptyState = isStateEmpty(params.state);
  const internal: TTableQueryInternal<InCols, OutCols> = {
    ...params,
    name: isEmptyState
      ? params.from
      : builder.Expr.identifier(`cte_${Random.createId()}`),
  };

  const self: TTableQuery<InCols, OutCols> = {
    [PRIV]: internal,
    [TYPES]: {} as any,

    where,
    andWhere,
    andFilterEqual,

    groupBy,
    andGroupBy,

    having,
    andHaving,

    select,

    orderBy,
    andSortAsc,
    andSortDesc,
    limit,
    offset,

    // Shortcuts

    // joins
    innerJoin,
    leftJoin,
    // populate,

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

  function where(
    whereFn: ColsFn<InCols, TExprUnknow>,
  ): TTableQuery<InCols, OutCols> {
    const result = resolveColFn(whereFn)(internal.inputColsRefs);
    const nextDependencies = mergeDependencies(
      internal.dependencies,
      result[PRIV].dependencies,
    );
    return createQuery({
      ...internal,
      dependencies: nextDependencies,
      state: { ...internal.state, where: result },
    });
  }

  function andWhere(
    whereFn: ColsFn<InCols, TExprUnknow>,
  ): TTableQuery<InCols, OutCols> {
    const result = resolveColFn(whereFn)(internal.inputColsRefs);
    const nextDependencies = mergeDependencies(
      internal.dependencies,
      result[PRIV].dependencies,
    );
    if (internal.state.where) {
      const whereAnd = Expr.and(internal.state.where, result);
      return createQuery({
        ...internal,
        dependencies: nextDependencies,
        state: { ...internal.state, where: whereAnd },
      });
    }
    return createQuery({
      ...internal,
      dependencies: nextDependencies,
      state: { ...internal.state, where: result },
    });
  }

  function andFilterEqual(
    filters: Partial<FilterEqualCols<InCols>>,
  ): TTableQuery<InCols, OutCols> {
    return andWhere((cols) => whereEqual(cols, filters));
  }

  function groupBy(
    groupFn: ColsFn<InCols, Array<TExprUnknow>>,
  ): TTableQuery<InCols, OutCols> {
    const groupBy = resolveColFn(groupFn)(internal.inputColsRefs);
    return createQuery({ ...internal, state: { ...internal.state, groupBy } });
  }

  function andGroupBy(
    groupFn: ColsFn<InCols, Array<TExprUnknow>>,
  ): TTableQuery<InCols, OutCols> {
    const groupBy = resolveColFn(groupFn)(internal.inputColsRefs);
    const nextGroupBy = [...(internal.state.groupBy ?? []), ...groupBy];
    return createQuery({
      ...internal,
      state: { ...internal.state, groupBy: nextGroupBy },
    });
  }

  function having(
    havingFn: ColsFn<InCols, TExprUnknow>,
  ): TTableQuery<InCols, OutCols> {
    const having = resolveColFn(havingFn)(internal.inputColsRefs);
    if (having === internal.state.having) {
      return self;
    }
    return createQuery({
      ...internal,
      dependencies: mergeDependencies(
        internal.dependencies,
        having[PRIV].dependencies,
      ),
      state: { ...internal.state, having },
    });
  }

  function andHaving(
    havingFn: ColsFn<InCols, TExprUnknow>,
  ): TTableQuery<InCols, OutCols> {
    const having = resolveColFn(havingFn)(internal.inputColsRefs);
    if (internal.state.having) {
      const havingAnd = Expr.and(internal.state.having, having);
      return createQuery({
        ...internal,
        dependencies: mergeDependencies(
          internal.dependencies,
          having[PRIV].dependencies,
        ),
        state: { ...internal.state, having: havingAnd },
      });
    }
    return createQuery({
      ...internal,
      dependencies: mergeDependencies(
        internal.dependencies,
        having[PRIV].dependencies,
      ),
      state: { ...internal.state, having },
    });
  }

  function select<NewOutCols extends ExprRecord>(
    selectFn: SelectFn<InCols, OutCols, NewOutCols>,
  ): TTableQuery<InCols, NewOutCols> {
    const nextOutputColsExprs = selectFn(
      internal.inputColsRefs,
      internal.outputColsExprs,
    );
    // Why does TS complains here ?
    if ((nextOutputColsExprs as any) === internal.outputColsExprs) {
      return self as any;
    }
    const { select, columnsRef, dependencies } = resolvedColumns(
      internal.from,
      nextOutputColsExprs,
    );
    return createQuery<InCols, NewOutCols>({
      ...internal,
      outputColsRefs: nextOutputColsExprs,
      outputColsExprs: columnsRef as any,
      dependencies: mergeDependencies(internal.dependencies, dependencies),
      state: { ...internal.state, select },
    });
  }

  function orderBy(
    orderByFn: AllColsFnOrRes<InCols, OutCols, OrderingTerms>,
  ): TTableQuery<InCols, OutCols> {
    const result = resolveAllColFn(orderByFn)(
      internal.inputColsRefs,
      resolveLocalColumns(internal.outputColsRefs),
    );
    if (result === internal.state.orderBy) {
      return self;
    }
    return createQuery({
      ...internal,
      state: { ...internal.state, orderBy: result },
    });
  }

  function andSortAsc(
    exprFn: ColsFn<InCols, TExprUnknow>,
  ): TTableQuery<InCols, OutCols> {
    const expr = resolveColFn(exprFn)(internal.inputColsRefs);
    return appendOrderingExpr(expr, "Asc");
  }

  function andSortDesc(
    exprFn: ColsFn<InCols, TExprUnknow>,
  ): TTableQuery<InCols, OutCols> {
    const expr = resolveColFn(exprFn)(internal.inputColsRefs);
    return appendOrderingExpr(expr, "Desc");
  }

  function limit(
    limitFn: AllColsFnOrRes<InCols, OutCols, TExprUnknow>,
  ): TTableQuery<InCols, OutCols> {
    const result = resolveAllColFn(limitFn)(
      internal.inputColsRefs,
      resolveLocalColumns(internal.outputColsRefs),
    );
    if (result === internal.state.limit) {
      return self;
    }
    return createQuery({
      ...internal,
      state: { ...internal.state, limit: result },
    });
  }

  function offset(
    offsetFn: AllColsFnOrRes<InCols, OutCols, TExprUnknow>,
  ): TTableQuery<InCols, OutCols> {
    const result = resolveAllColFn(offsetFn)(
      internal.inputColsRefs,
      resolveLocalColumns(internal.outputColsRefs),
    );
    if (result === internal.state.offset) {
      return self;
    }
    return createQuery({
      ...internal,
      state: { ...internal.state, offset: result },
    });
  }

  function innerJoin<
    RTable extends TTableQuery<any, any>,
    Alias extends string,
  >(
    table: RTable,
    alias: Alias,
    joinOn: (cols: ColsRefInnerJoined<InCols, RTable, Alias>) => TExprUnknow,
  ): TTableQuery<ColsRefInnerJoined<InCols, RTable, Alias>, OutCols> {
    const tableCte = queryFrom(table);
    const tableAlias = builder.Expr.identifier(`t_${Random.createId()}`);

    const newInColsRef: ColsRefInnerJoined<InCols, RTable, Alias> = {
      ...internal.inputColsRefs,
      [alias]: remapColumnsTables(tableCte[PRIV].outputColsRefs, tableAlias),
    };

    const joinItem: builder.SelectStmt.JoinItem = {
      joinOperator: builder.SelectStmt.InnerJoinOperator(),
      tableOrSubquery: builder.SelectStmt.Table(tableCte[PRIV].from.name, {
        alias: tableAlias,
      }),
      joinConstraint: builder.SelectStmt.OnJoinConstraint(
        joinOn(newInColsRef).ast,
      ),
    };
    return createQuery({
      ...internal,
      inputColsRefs: newInColsRef,
      state: {
        ...internal.state,
        joins: [...(internal.state.joins ?? []), joinItem],
      },
      dependencies: appendDependencies(internal.dependencies, table[PRIV]),
    });
  }

  function leftJoin<RTable extends TTableQuery<any, any>, Alias extends string>(
    table: RTable,
    alias: Alias,
    joinOn: (cols: ColsRefLeftJoined<InCols, RTable, Alias>) => TExprUnknow,
  ): TTableQuery<ColsRefLeftJoined<InCols, RTable, Alias>, OutCols> {
    const tableCte = queryFrom(table);
    const tableAlias = builder.Expr.identifier(`t_${Random.createId()}`);

    const newInColsRef: ColsRefLeftJoined<InCols, RTable, Alias> = {
      ...internal.inputColsRefs,
      [alias]: markColumnsNullable(
        remapColumnsTables(tableCte[PRIV].outputColsRefs, tableAlias),
      ),
    };

    const joinItem: builder.SelectStmt.JoinItem = {
      joinOperator: builder.SelectStmt.JoinOperator("Left"),
      tableOrSubquery: builder.SelectStmt.Table(tableCte[PRIV].from.name, {
        alias: tableAlias,
      }),
      joinConstraint: builder.SelectStmt.OnJoinConstraint(
        joinOn(newInColsRef).ast,
      ),
    };
    return createQuery({
      ...internal,
      inputColsRefs: newInColsRef,
      state: {
        ...internal.state,
        joins: [...(internal.state.joins ?? []), joinItem],
      },
      dependencies: appendDependencies(internal.dependencies, table[PRIV]),
    });
  }

  function all(): TQueryOperation<Array<ExprRecordOutput<OutCols>>> {
    const node = buildFinalNode(internal);
    const params = extractParams(node);
    const sql = printNode(node);
    return {
      kind: "Query",
      sql,
      params,
      parse: (rows) => {
        return rows.map((row) =>
          mapObject(
            internal.outputColsRefs,
            (key, col) => ExprUtils.parseExpr(col, row[key], false),
          )
        );
      },
    };
  }

  function maybeOne(): TQueryOperation<ExprRecordOutput<OutCols> | null> {
    // Note: here we could limit to 2 rows to detect if there are too many rows
    // But we don't because we want to know how many rows there are in the error
    const allOp = all();
    return {
      ...allOp,
      parse: (rows) => {
        const res = allOp.parse(rows);
        if (res.length > 1) {
          throw createTooManyRows(res.length);
        }
        return res.length === 0 ? null : res[0];
      },
    };
  }

  function one(): TQueryOperation<ExprRecordOutput<OutCols>> {
    const maybeOneOp = maybeOne();
    return {
      ...maybeOneOp,
      parse: (rows) => {
        const res = maybeOneOp.parse(rows);
        if (res === null) {
          throw createNoRows();
        }
        return res;
      },
    };
  }

  function maybeFirst(): TQueryOperation<ExprRecordOutput<OutCols> | null> {
    const allOp = limit(Expr.literal(1)).all();
    return {
      ...allOp,
      parse: (rows) => {
        const res = allOp.parse(rows);
        return res.length === 0 ? null : res[0];
      },
    };
  }

  function first(): TQueryOperation<ExprRecordOutput<OutCols>> {
    const maybeFirstOp = maybeFirst();
    return {
      ...maybeFirstOp,
      parse: (rows) => {
        const res = maybeFirstOp.parse(rows);
        if (res === null) {
          throw createNoRows();
        }
        return res;
      },
    };
  }

  // UTILS

  function appendOrderingExpr(
    expr: TExprUnknow,
    dir: "Asc" | "Desc",
  ): TTableQuery<InCols, OutCols> {
    const orderingTerm = Ast.createNode("OrderingTerm", {
      expr: expr.ast,
      direction: dir,
    });
    if (!internal.state.orderBy) {
      return createQuery({
        ...internal,
        state: { ...internal.state, orderBy: [orderingTerm] },
      });
    }
    return createQuery({
      ...internal,
      state: {
        ...internal.state,
        orderBy: [...internal.state.orderBy, orderingTerm],
      },
    });
  }
}

function resolveColFn<Cols extends AnyRecord, Result>(
  fn: ColsFnOrRes<Cols, Result>,
): ColsFn<Cols, Result> {
  const fnResolved: ColsFn<Cols, Result> = typeof fn === "function"
    ? (fn as any)
    : () => fn;
  return fnResolved;
}

function resolveAllColFn<
  InCols extends AnyRecord,
  OutCols extends AnyRecord,
  Result,
>(
  fn: AllColsFnOrRes<InCols, OutCols, Result>,
): AllColsFn<InCols, OutCols, Result> {
  const fnResolved: AllColsFn<InCols, OutCols, Result> =
    typeof fn === "function" ? (fn as any) : () => fn;
  return fnResolved;
}

function buildFinalNode(
  internal: TTableQueryInternal<any, any>,
): Ast.Node<"SelectStmt"> {
  const ctes = buildCtes(internal.dependencies);
  const select = buildSelectNode(internal);
  return {
    ...select,
    with: ctes.length === 0
      ? undefined
      : { commonTableExpressions: Utils.arrayToNonEmptyArray(ctes) },
  };
}

function buildCtes(
  dependencies: TTableQueryDependency[],
): Array<Ast.Node<"CommonTableExpression">> {
  const alreadyIncluded = new Set<string>();
  const ctes: Array<Ast.Node<"CommonTableExpression">> = [];
  dependencies.forEach((dep) => {
    const name = dep.name.name;
    if (alreadyIncluded.has(name)) {
      return;
    }
    alreadyIncluded.add(name);
    ctes.push({
      kind: "CommonTableExpression",
      tableName: dep.name,
      select: buildSelectNode(dep),
    });
  });
  return ctes;
}

function buildSelectNode(
  internal: TTableQueryDependency,
): Ast.Node<"SelectStmt"> {
  const { state } = internal;
  const [firstJoin, ...restJoins] = state.joins || [];

  return {
    kind: "SelectStmt",
    select: {
      kind: "SelectCore",
      variant: "Select",
      from: firstJoin
        ? builder.SelectStmt.FromJoins(
          builder.SelectStmt.Table(internal.from.name),
          firstJoin,
          ...restJoins,
        )
        : builder.SelectStmt.FromTable(internal.from.name),
      resultColumns: state.select
        ? Utils.arrayToNonEmptyArray(state.select)
        : [builder.ResultColumn.TableStar(internal.from)],
      where: state.where?.ast,
      groupBy: state.groupBy
        ? {
          exprs: Utils.arrayToNonEmptyArray(state.groupBy.map((e) => e.ast)),
          having: state.having?.ast,
        }
        : undefined,
    },
    orderBy: state.orderBy
      ? Utils.arrayToNonEmptyArray(state.orderBy)
      : undefined,
    limit: state.limit
      ? {
        expr: state.limit.ast,
        offset: state.offset
          ? { separator: "Offset", expr: state.offset.ast }
          : undefined,
      }
      : undefined,
  };
}

function resolveLocalColumns<Cols extends ExprRecord>(cols: Cols): Cols {
  return mapObject(cols, (key, col): any => Expr.column(null, key, col[PRIV]));
}

function resolvedColumns(
  table: Ast.Identifier,
  selected: ExprRecord,
): {
  select: Array<Ast.Node<"ResultColumn">>;
  columnsRef: ExprRecord;
  dependencies: TTableQueryDependency[];
} {
  let dependencies: TTableQueryDependency[] = [];
  const select = Object.entries(selected).map(
    ([key, expr]): Ast.Node<"ResultColumn"> => {
      dependencies = mergeDependencies(dependencies, expr[PRIV].dependencies);
      return builder.ResultColumn.Expr(expr.ast, key);
    },
  );
  const columnsRef = exprsToRefs(table, selected);
  return { select, columnsRef, dependencies };
}

function exprsToRefs(table: Ast.Identifier, exprs: ExprRecord): ExprRecord {
  return mapObject(exprs, (col, expr) => {
    const exprJsonMode = expr[PRIV].jsonMode;
    const jsonMode: TJsonMode | undefined =
      exprJsonMode === "JsonExpr" || exprJsonMode === "JsonRef"
        ? "JsonRef"
        : undefined;
    return Expr.column(table, col, {
      parse: expr[PRIV].parse,
      jsonMode,
      nullable: expr[PRIV].nullable,
    });
  });
}
