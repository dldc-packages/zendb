import { expectNever, join, mapMaybe, parent, PRIV, sqlQuote } from '../Utils';
import { Aggregate } from './Aggregate';
import { BinaryOperator, BinaryExpr } from './BinaryExpr';
import { Column } from './Column';
import { Expr } from './Expr';
import { InsertStmt } from './InsertStmt';
import { JsonTable } from './JsonTable';
import { LiteralExpr } from './LiteralExpr';
import { Param } from './Param';
import { SelectStmt, SelectStmtFrom, SelectStmtLimit, SelectStmtOptions } from './SelectStmt';
import { UpdateStmt } from './UpdateStmt';
import { DeleteStmt } from './DeleteStmt';
import { Table } from './Table';
import { UnaryExpr } from './UnaryExpr';

export const sql = {
  BinaryExpr,
  Column,
  JsonTable,
  LiteralExpr,
  Param,
  Table,
  UnaryExpr,
  Aggregate,
  // stmt
  InsertStmt,
  SelectStmt,
  UpdateStmt,
  DeleteStmt,
  // shortcuts
  eq: BinaryExpr.equal,
  neq: BinaryExpr.notEqual,
  gt: BinaryExpr.greaterThan,
  gte: BinaryExpr.greaterThanOrEqual,
  lt: BinaryExpr.lessThan,
  lte: BinaryExpr.lessThanOrEqual,
  and: BinaryExpr.and,
  or: BinaryExpr.or,
  literal: LiteralExpr.create,
};

export type {
  SelectStmtFrom,
  SelectStmtLimit,
  SelectStmtOptions,
  BinaryOperator,
  Expr,
  BinaryExpr,
  Column,
  InsertStmt,
  JsonTable,
  LiteralExpr,
  Param,
  SelectStmt,
  Table,
  UnaryExpr,
  Aggregate,
  DeleteStmt,
  UpdateStmt,
};

export type Node =
  | Expr
  | Column
  | BinaryExpr
  | UnaryExpr
  | LiteralExpr
  | Param
  | JsonTable
  | Table
  | Aggregate
  | Stmt;

export type Stmt = SelectStmt | InsertStmt | UpdateStmt | DeleteStmt;

export type Resolved = {
  query: string;
};

export function resolveStmt(stmt: Stmt): Resolved {
  if (stmt instanceof SelectStmt) {
    return resolveSelectStmt(stmt);
  }
  if (stmt instanceof InsertStmt) {
    return resolveInsertStmt(stmt);
  }
  if (stmt instanceof UpdateStmt) {
    return resolveUpdateStmt(stmt);
  }
  if (stmt instanceof DeleteStmt) {
    return resolveDeleteStmt(stmt);
  }
  return expectNever(stmt);
}

function resolveUpdateStmt(stmt: UpdateStmt): Resolved {
  const params = extractParams(stmt) ?? new Set<Param>();
  const tables = extractTables(stmt) ?? new Set<Table | JsonTable>();
  const columns = extractColumns(stmt) ?? new Set<Column>();

  ensureColumnsInTables(columns, tables);
  ensureUniqueParams(params);
  ensureUniqueTables(tables);

  const query = printNode(stmt, 'ref');
  return { query };
}

function resolveDeleteStmt(stmt: DeleteStmt): Resolved {
  const params = extractParams(stmt) ?? new Set<Param>();
  const tables = extractTables(stmt) ?? new Set<Table | JsonTable>();
  const columns = extractColumns(stmt) ?? new Set<Column>();

  ensureColumnsInTables(columns, tables);
  ensureUniqueParams(params);
  ensureUniqueTables(tables);

  const query = printNode(stmt, 'ref');
  return { query };
}

function resolveInsertStmt(stmt: InsertStmt): Resolved {
  const params = extractParams(stmt) ?? new Set<Param>();
  const tables = extractTables(stmt) ?? new Set<Table | JsonTable>();
  const columns = extractColumns(stmt) ?? new Set<Column>();

  ensureColumnsInTables(columns, tables);
  ensureUniqueParams(params);
  ensureUniqueTables(tables);

  const query = printNode(stmt, 'ref');
  return { query };
}

function resolveSelectStmt(stmt: SelectStmt): Resolved {
  // extract params, columns, tables
  const params = extractParams(stmt) ?? new Set<Param>();
  const tables = extractTables(stmt) ?? new Set<Table | JsonTable>();
  const columns = extractColumns(stmt) ?? new Set<Column>();

  ensureColumnsInTables(columns, tables);
  ensureUniqueParams(params);
  ensureUniqueTables(tables);

  // all select items must be unique
  const selectNames = new Map<Table | JsonTable | null, Set<string>>();
  stmt[PRIV].columns.forEach((item) => {
    const name = printNode(item, 'ref');
    const key = (() => {
      if (item instanceof Column) {
        return item[PRIV].table;
      }
      if (item instanceof Aggregate) {
        // global namespace
        return null;
      }
      return expectNever(item);
    })();
    let tableColumnNames = selectNames.get(key);
    if (!tableColumnNames) {
      tableColumnNames = new Set();
      selectNames.set(key, tableColumnNames);
    }
    if (tableColumnNames.has(name)) {
      throw new Error(`Duplicate select name ${name}`);
    }
    tableColumnNames.add(name);
  });
  const query = printNode(stmt, 'ref');
  return { query };
}

function ensureColumnsInTables(columns: Set<Column>, tables: Set<Table | JsonTable>) {
  columns.forEach((column) => {
    if (!tables.has(column[PRIV].table)) {
      throw new Error(`Column "${column[PRIV].name}" is not in any table`);
    }
    return;
  });
}

function ensureUniqueParams(params: Set<Param>) {
  const paramNames = new Set<string>();
  params.forEach((param) => {
    const internal = param[PRIV];
    if (internal.kind === 'Anonymous') {
      return;
    }
    if (internal.kind === 'Named') {
      if (paramNames.has(internal.name)) {
        throw new Error(
          `Duplicate parameter name ${internal.name}, reuse the same param instance.`
        );
      }
      paramNames.add(internal.name);
      return;
    }
    return expectNever(internal);
  });
}

function ensureUniqueTables(tables: Set<Table | JsonTable>) {
  const tableNames = new Set<string>();
  tables.forEach((table) => {
    const name = printNode(table, 'ref').toLowerCase();
    if (tableNames.has(name)) {
      throw new Error(`Duplicate table name ${name}, reuse the same table instance.`);
    }
    tableNames.add(name);
    return;
  });
}

function mergeSets<T>(...sets: Array<Set<T> | null>): Set<T> {
  const merged = new Set<T>();
  sets.forEach((set) => {
    if (set) {
      set.forEach((item) => {
        merged.add(item);
      });
    }
  });
  return merged;
}

function extractParams(node: Node | null): Set<Param> | null {
  if (node === null) {
    return null;
  }
  if (node instanceof SelectStmt) {
    const internal = node[PRIV];
    return mergeSets(
      ...internal.columns.map((c) => extractParams(c)),
      extractParams(internal.where),
      mapMaybe(internal.limit, ({ limit, offset }) =>
        mergeSets(extractParams(limit), extractParams(offset))
      )
    );
  }
  if (node instanceof InsertStmt) {
    const internal = node[PRIV];
    return mergeSets(...internal.values.map((v) => mergeSets(...v.map((c) => extractParams(c)))));
  }
  if (node instanceof UpdateStmt) {
    const internal = node[PRIV];
    return mergeSets(
      ...internal.set.map(([_col, val]) => extractParams(val)),
      extractParams(internal.where)
    );
  }
  if (node instanceof DeleteStmt) {
    const internal = node[PRIV];
    return extractParams(internal.where);
  }
  if (node instanceof Column) {
    return null;
  }
  if (node instanceof BinaryExpr) {
    return mergeSets(extractParams(node[PRIV].left), extractParams(node[PRIV].right));
  }
  if (node instanceof UnaryExpr) {
    return extractParams(node[PRIV].expr);
  }
  if (node instanceof LiteralExpr) {
    return null;
  }
  if (node instanceof Param) {
    return new Set([node]);
  }
  if (node instanceof JsonTable) {
    return null;
  }
  if (node instanceof Table) {
    return null;
  }
  if (node instanceof Aggregate) {
    return null;
  }
  return expectNever(node);
}

function extractTables(node: Node | null): Set<Table | JsonTable> | null {
  if (node === null) {
    return null;
  }
  if (node instanceof SelectStmt) {
    const internal = node[PRIV];
    return mergeSets(...internal.from.map((t) => extractTables(t)));
  }
  if (node instanceof InsertStmt) {
    return extractTables(node[PRIV].into);
  }
  if (node instanceof UpdateStmt) {
    return extractTables(node[PRIV].table);
  }
  if (node instanceof DeleteStmt) {
    return extractTables(node[PRIV].from);
  }
  if (node instanceof Column) {
    return null;
  }
  if (node instanceof BinaryExpr) {
    return null;
  }
  if (node instanceof UnaryExpr) {
    return null;
  }
  if (node instanceof LiteralExpr) {
    return null;
  }
  if (node instanceof Param) {
    return null;
  }
  if (node instanceof JsonTable) {
    return new Set([node]);
  }
  if (node instanceof Table) {
    return new Set([node]);
  }
  if (node instanceof Aggregate) {
    return null;
  }
  return expectNever(node);
}

function extractColumns(node: Node | null): Set<Column> | null {
  if (node === null) {
    return null;
  }
  if (node instanceof SelectStmt) {
    const internal = node[PRIV];
    return mergeSets(
      ...internal.columns.map((c) => extractColumns(c)),
      extractColumns(internal.where),
      mapMaybe(internal.limit, ({ limit, offset }) =>
        mergeSets(extractColumns(limit), extractColumns(offset))
      )
    );
  }
  if (node instanceof InsertStmt) {
    const internal = node[PRIV];
    return mergeSets(
      new Set(internal.columns),
      ...internal.values.map((v) => mergeSets(...v.map((c) => extractColumns(c))))
    );
  }
  if (node instanceof UpdateStmt) {
    const internal = node[PRIV];
    return mergeSets(
      ...internal.set.map(([_col, val]) => extractColumns(val)),
      extractColumns(internal.where)
    );
  }
  if (node instanceof DeleteStmt) {
    const internal = node[PRIV];
    return extractColumns(internal.where);
  }
  if (node instanceof Column) {
    return new Set([node]);
  }
  if (node instanceof BinaryExpr) {
    return mergeSets(extractColumns(node[PRIV].left), extractColumns(node[PRIV].right));
  }
  if (node instanceof UnaryExpr) {
    return extractColumns(node[PRIV].expr);
  }
  if (node instanceof LiteralExpr) {
    return null;
  }
  if (node instanceof Param) {
    return null;
  }
  if (node instanceof JsonTable) {
    return new Set([node[PRIV].sourceColumn]);
  }
  if (node instanceof Table) {
    return null;
  }
  if (node instanceof Aggregate) {
    return new Set([node[PRIV].column]);
  }
  return expectNever(node);
}

/**
 * full: table.col as bar
 * ref: table.col
 * name: col (no table)
 */
type PrintMode = 'full' | 'ref' | 'name';

function mapPrintMode<Res>(mode: PrintMode, options: { [K in PrintMode]: () => Res }): Res {
  return options[mode]();
}

function printNode(node: Node, printMode: PrintMode): string {
  if (node instanceof BinaryExpr) {
    const { left, right, operator } = node[PRIV];
    return `(${printNode(left, 'ref')} ${operator} ${printNode(right, 'ref')})`;
  }
  if (node instanceof UnaryExpr) {
    const { expr, operator } = node[PRIV];
    return `(${operator} ${printNode(expr, 'ref')})`;
  }
  if (node instanceof LiteralExpr) {
    const { value } = node[PRIV];
    if (value === null) {
      return 'NULL';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    if (typeof value === 'string') {
      return `'${value}'`;
    }
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    return expectNever(value);
  }
  if (node instanceof Column) {
    const { alias, name, table } = node[PRIV];
    return mapPrintMode(printMode, {
      full: () =>
        join.all(
          printNode(table, 'ref'),
          '.',
          sqlQuote(name),
          mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
        ),
      ref: () =>
        alias ? sqlQuote(alias.alias) : join.all(printNode(table, 'ref'), '.', sqlQuote(name)),
      name: () => sqlQuote(name),
    });
  }
  if (node instanceof Param) {
    const internal = node[PRIV];
    if (internal.kind === 'Anonymous') {
      return `?`;
    }
    if (internal.kind === 'Named') {
      return `:${internal.name}`;
    }
    return expectNever(internal);
  }
  if (node instanceof JsonTable) {
    const { alias, mode, sourceColumn, path } = node[PRIV];
    const fnName = { Each: 'json_each', Tree: 'json_tree' }[mode];
    return mapPrintMode(printMode, {
      full: () =>
        join.all(
          fnName,
          '(',
          printNode(sourceColumn, 'ref'),
          mapMaybe(path, (p) => `, '${p}'`),
          ')',
          mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
        ),
      ref: () => sqlQuote(alias ? alias.alias : 'json_each'),
      name: () => {
        throw new Error('Invalid print mode');
      },
    });
  }
  if (node instanceof Table) {
    const { alias, name } = node[PRIV];
    return mapPrintMode(printMode, {
      full: () =>
        join.all(
          sqlQuote(name),
          mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
        ),
      ref: () => sqlQuote(alias ? alias.alias : name),
      name: () => {
        throw new Error('Invalid print mode for table');
      },
    });
  }
  if (node instanceof Aggregate) {
    const { alias, column, fn } = node[PRIV];
    const fnName = { Count: 'COUNT', Sum: 'SUM', Min: 'MIN', Max: 'MAX' }[fn];
    return mapPrintMode(printMode, {
      full: () =>
        join.all(
          fnName,
          '(',
          printNode(column, 'ref'),
          ')',
          mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
        ),
      ref: () =>
        alias ? sqlQuote(alias.alias) : `${fnName}(${sqlQuote(printNode(column, 'ref'))})`,
      name: () => {
        throw new Error('Invalid print mode for table');
      },
    });
  }
  if (node instanceof SelectStmt) {
    const { columns, from, where, orderBy, limit, distinct } = node[PRIV];
    return join.space(
      'SELECT',
      distinct ? 'DISTINCT' : null,
      join.comma(...columns.map((c) => printNode(c, 'full'))),
      'FROM',
      join.comma(...from.map((t) => printNode(t, 'full'))),
      mapMaybe(where, (w) => `WHERE ${printNode(w, 'ref')}`),
      mapMaybe(
        orderBy,
        (o) => `ORDER BY ${join.comma(...o.map((expr) => printNode(expr, 'ref')))}`
      ),
      mapMaybe(limit, (l) =>
        join.space(
          `LIMIT`,
          printNode(l.limit, 'ref'),
          mapMaybe(l.offset, (o) => join.space(`OFFSET`, printNode(o, 'ref')))
        )
      )
    );
  }
  if (node instanceof InsertStmt) {
    const { into, columns, values } = node[PRIV];
    return join.space(
      'INSERT INTO',
      printNode(into, 'full'),
      mapMaybe(columns, (c) => parent(join.comma(...c.map((c) => printNode(c, 'name'))))),
      'VALUES',
      join.comma(
        ...values.map((row) => parent(join.comma(...row.map((cell) => printNode(cell, 'ref')))))
      )
    );
  }
  if (node instanceof UpdateStmt) {
    const { table, set, where } = node[PRIV];
    return join.space(
      'UPDATE',
      printNode(table, 'full'),
      'SET',
      join.comma(
        ...set.map(([col, val]) => join.space(printNode(col, 'name'), '=', printNode(val, 'ref')))
      ),
      mapMaybe(where, (w) => `WHERE ${printNode(w, 'ref')}`)
    );
  }
  if (node instanceof DeleteStmt) {
    const { from, where } = node[PRIV];
    return join.space(
      'DELETE FROM',
      printNode(from, 'full'),
      mapMaybe(where, (w) => `WHERE ${printNode(w, 'ref')}`)
    );
  }
  return expectNever(node);
}
