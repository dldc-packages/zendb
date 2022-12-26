import { Expr as SqlExpr, builder as b, Node, SetItem, arrayToNonEmptyArray, createNode, arrayToOptionalNonEmptyArray } from 'zensqlite';
import { DatabaseTableQueryInternalAny, OrderDirection, JoinKind, SelectFrom, SelectOrderBy } from './DatabaseTableQuery';
import { Expr, isExpr } from './Expr';
import { SchemaAny, SchemaColumnAny, SchemaTableAny, serializeColumn } from './schema';
import { dedupe, expectNever, isNotNull, PRIV, customAlphabet } from './Utils';

export type ParamsMap = Map<string, unknown>;

export type ResolvedQuery = {
  table: string;
  tableAlias: string;
  limit: null | number;
  offset: null | number;
  columns: Array<string> | null;
  joinColumns: Array<string>;
  primaryColumns: Array<string>;
  where: Record<string, unknown> | null;
  orderBy: null | Array<[string, OrderDirection]>;
};

export type ResolvedJoin = {
  kind: JoinKind;
  currentCol: string;
  joinCol: string;
};

export type ResolvedJoinItem = { query: ResolvedQuery; join: ResolvedJoin };

export type Resolved = [query: ResolvedQuery, joins: Array<ResolvedJoinItem>];

export const createParamName = customAlphabet('abcdefghijklmnopqrstuvwxyz', 8);

export function dotCol(table: string, col: string): string {
  return `${table}__${col}`;
}

export function resolveQuery(
  schema: SchemaAny,
  query: DatabaseTableQueryInternalAny,
  parentJoinCol: string | null,
  depth: number
): Resolved {
  const joinCol = query.parent?.joinCol ?? null;
  const table = schema.tables[query.table];
  const primaryColumns = Object.entries(table[PRIV].columns)
    .filter(([_, column]) => column[PRIV].primary)
    .map(([key]) => key);

  const resolved: ResolvedQuery = {
    table: query.table,
    tableAlias: `_${depth}`,
    columns: query.selection ? Object.keys(query.selection) : null,
    joinColumns: [joinCol, parentJoinCol].filter(isNotNull),
    primaryColumns,
    limit: query.take?.limit ?? null,
    offset: query.take?.offset ?? null,
    where: query.filter,
    orderBy: query.sort as any,
  };
  if (!query.parent) {
    return [resolved, []];
  }
  const [innerQuery, innerJoins] = resolveQuery(schema, query.parent.query, query.parent.currentCol, depth + 1);
  const join: ResolvedJoin = {
    currentCol: query.parent.currentCol,
    joinCol: query.parent.joinCol,
    kind: query.parent.kind,
  };
  return [innerQuery, [...innerJoins, { query: resolved, join }]];
}

export function createWhere(
  paramsMap: ParamsMap,
  table: SchemaTableAny,
  where: Record<string, unknown> | null,
  tableAlias: string
): SqlExpr | undefined {
  if (!where) {
    return undefined;
  }
  const conditions = Object.entries(where).map(([key, value]) => {
    const col = b.Column({ column: key, table: tableAlias });
    if (value === null) {
      return b.Expr.Is(col, b.LiteralValue.Null);
    }
    const column = table[PRIV].columns[key];
    if (isExpr(value)) {
      return exprToSqlNode(paramsMap, column, value, col);
    }
    return b.Expr.Equal(col, getValueParam(paramsMap, column, col.columnName.name, value));
  });
  if (conditions.length === 0) {
    return undefined;
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  const [first, ...rest] = conditions;
  let current: SqlExpr = first;
  rest.forEach((item) => {
    current = b.Expr.And(current, item);
  });
  return current;
}

function exprToSqlNode(paramsMap: ParamsMap, column: SchemaColumnAny, expr: Expr<any>, col: Node<'Column'>): SqlExpr {
  const colName = col.columnName.name;
  if (expr.kind === 'And') {
    return b.Expr.And(exprToSqlNode(paramsMap, column, expr.left, col), exprToSqlNode(paramsMap, column, expr.right, col));
  }
  if (expr.kind === 'Or') {
    return b.Expr.Or(exprToSqlNode(paramsMap, column, expr.left, col), exprToSqlNode(paramsMap, column, expr.right, col));
  }
  if (expr.kind === 'Equal') {
    return b.Expr.Equal(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'Different') {
    return b.Expr.Different(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'GreaterThan') {
    return b.Expr.GreaterThan(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'GreaterThanOrEqual') {
    return b.Expr.GreaterThanOrEqual(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'LowerThan') {
    return b.Expr.LowerThan(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'LowerThanOrEqual') {
    return b.Expr.LowerThanOrEqual(col, getValueParam(paramsMap, column, colName, expr.val));
  }
  if (expr.kind === 'In') {
    return b.Expr.In.List(col, arrayToNonEmptyArray(expr.values.map((val, i) => getValueParam(paramsMap, column, `${colName}_${i}`, val))));
  }
  if (expr.kind === 'NotIn') {
    return b.Expr.NotIn.List(
      col,
      arrayToNonEmptyArray(expr.values.map((val, i) => getValueParam(paramsMap, column, `${colName}_${i}`, val)))
    );
  }
  if (expr.kind === 'IsNull') {
    return b.Expr.Is(col, b.LiteralValue.Null);
  }
  if (expr.kind === 'IsNotNull') {
    return b.Expr.IsNot(col, b.LiteralValue.Null);
  }
  return expectNever(expr.kind);
}

export function createSetItems(paramsMap: ParamsMap, table: SchemaTableAny, values: Record<string, any>): Array<SetItem> {
  return Object.entries(values).map(([col, value]) => {
    const column = table[PRIV].columns[col];
    if (!column) {
      throw new Error(`Column ${col} does not exist`);
    }
    return b.SetItems.ColumnName(col, getValueParam(paramsMap, column, col, value));
  });
}

function getValueParam(paramsMap: ParamsMap, column: SchemaColumnAny, name: string, value: any): Node<'BindParameter'> {
  let uniqueName = name;
  // Find unique name
  if (paramsMap.has(name)) {
    let i = 1;
    while (paramsMap.has(`${name}_${i}`)) {
      i++;
    }
    uniqueName = `${name}_${i}`;
  }
  paramsMap.set(uniqueName, serializeColumn(column, value));
  return b.Expr.BindParameter.ColonNamed(uniqueName);
}

export function paramsFromMap(paramsMap: ParamsMap): Record<string, any> | null {
  const entries = Array.from(paramsMap.entries());
  if (entries.length === 0) {
    return null;
  }
  return Object.fromEntries(entries);
}

export function resolvedQueryToSelect(
  paramsMap: ParamsMap,
  table: SchemaTableAny,
  resolved: ResolvedQuery,
  join: { join: ResolvedJoin; query: ResolvedQuery; select: Node<'SelectStmt'> } | null
): Node<'SelectStmt'> {
  return b.SelectStmt({
    resultColumns: [
      ...dedupe([...(resolved.columns ?? []), ...resolved.joinColumns, ...resolved.primaryColumns]).map((col) =>
        b.ResultColumn.Expr(
          b.Column({ column: col, table: resolved.tableAlias }),
          b.Identifier(dotCol(resolved.tableAlias, col)) // alias to "table.col"
        )
      ),
      join ? b.ResultColumn.TableStar(join.query.tableAlias) : null,
    ].filter(isNotNull),
    from: createFrom(resolved, join),
    where: createWhere(paramsMap, table, resolved.where, resolved.tableAlias),
    limit: createLimit(resolved.limit, resolved.offset),
    orderBy: createOrderBy(resolved.orderBy, resolved.tableAlias),
  });
}

function createOrderBy(orderBy: null | Array<[string, OrderDirection]>, tableAlias: string): SelectOrderBy | undefined {
  if (orderBy === null) {
    return undefined;
  }
  return arrayToOptionalNonEmptyArray(
    orderBy.map(([col, dir]) => {
      return createNode('OrderingTerm', {
        expr: b.Column({ column: col, table: tableAlias }),
        direction: dir,
      });
    })
  );
}

function createLimit(limit: number | null, offset: number | null): Node<'SelectStmt'>['limit'] | undefined {
  if (limit === null) {
    return undefined;
  }
  return {
    expr: b.literal(limit),
    offset: offset !== null ? { separator: 'Offset', expr: b.literal(offset) } : undefined,
  };
}

function createFrom(
  resolved: ResolvedQuery,
  join: { join: ResolvedJoin; query: ResolvedQuery; select: Node<'SelectStmt'> } | null
): SelectFrom {
  return join
    ? b.From.Join(
        b.TableOrSubquery.Select(join.select, join.query.tableAlias),
        b.JoinOperator.Join('Left'),
        b.TableOrSubquery.Table(resolved.table, { alias: resolved.tableAlias }),
        b.JoinConstraint.On(
          b.Expr.Equal(
            b.Expr.Column(dotCol(join.query.tableAlias, join.join.currentCol)),
            b.Expr.Column(dotCol(resolved.tableAlias, join.join.joinCol))
          )
        )
      )
    : b.From.Table(resolved.table, { alias: resolved.tableAlias });
}
