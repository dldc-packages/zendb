import { expectNever, mapMaybe, PRIV, mergeSets } from '../Utils';
import { printNode } from './Printer';
import {
  Node,
  sql,
  Stmt,
  UpdateStmt,
  Param,
  Table,
  JsonTable,
  Column,
  SelectStmt,
  DeleteStmt,
  InsertStmt,
  CreateTableStmt,
} from './nodes';

export type Resolved = {
  query: string;
};

export function resolveStmt(stmt: Stmt): Resolved {
  if (stmt instanceof sql.SelectStmt) {
    return resolveSelectStmt(stmt);
  }
  if (stmt instanceof sql.InsertStmt) {
    return resolveInsertStmt(stmt);
  }
  if (stmt instanceof sql.UpdateStmt) {
    return resolveUpdateStmt(stmt);
  }
  if (stmt instanceof sql.DeleteStmt) {
    return resolveDeleteStmt(stmt);
  }
  if (stmt instanceof sql.CreateTableStmt) {
    return resolveCreateTableStmt(stmt);
  }
  return expectNever(stmt);
}

function resolveCreateTableStmt(stmt: CreateTableStmt): Resolved {
  const params = extractParams(stmt) ?? new Set<Param>();
  const tables = extractTables(stmt) ?? new Set<Table | JsonTable>();
  const columns = extractColumns(stmt) ?? new Set<Column>();

  ensureColumnsInTables(columns, tables);
  ensureUniqueParams(params);
  ensureUniqueTables(tables);

  const query = printNode(stmt, 'ref');
  return { query };
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
      if (item instanceof sql.Column) {
        return item[PRIV].table;
      }
      if (item instanceof sql.Aggregate) {
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
      console.error(column);
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

export function extractParams(node: Node | null): Set<Param> | null {
  if (node === null) {
    return null;
  }
  if (node instanceof sql.SelectStmt) {
    const internal = node[PRIV];
    return mergeSets(
      ...internal.columns.map((c) => extractParams(c)),
      extractParams(internal.where),
      mapMaybe(internal.limit, ({ limit, offset }) =>
        mergeSets(extractParams(limit), extractParams(offset))
      )
    );
  }
  if (node instanceof sql.InsertStmt) {
    const internal = node[PRIV];
    return mergeSets(...internal.values.map((v) => mergeSets(...v.map((c) => extractParams(c)))));
  }
  if (node instanceof sql.UpdateStmt) {
    const internal = node[PRIV];
    return mergeSets(
      ...internal.set.map(([_col, val]) => extractParams(val)),
      extractParams(internal.where)
    );
  }
  if (node instanceof sql.DeleteStmt) {
    const internal = node[PRIV];
    return extractParams(internal.where);
  }
  if (node instanceof sql.CreateTableStmt) {
    throw new Error('Not implemented');
  }
  if (node instanceof sql.Column) {
    return null;
  }
  if (node instanceof sql.BinaryExpr) {
    return mergeSets(extractParams(node[PRIV].left), extractParams(node[PRIV].right));
  }
  if (node instanceof sql.UnaryExpr) {
    return extractParams(node[PRIV].expr);
  }
  if (node instanceof sql.LiteralExpr) {
    return null;
  }
  if (node instanceof sql.Param) {
    return new Set([node]);
  }
  if (node instanceof sql.JsonTable) {
    return null;
  }
  if (node instanceof sql.Table) {
    return null;
  }
  if (node instanceof sql.Aggregate) {
    return null;
  }
  if (node instanceof sql.ColumnDef) {
    throw new Error('Not implemented');
  }
  if (node instanceof sql.Value) {
    throw new Error('Not implemented');
  }
  return expectNever(node);
}

export function extractTables(node: Node | null): Set<Table | JsonTable> | null {
  if (node === null) {
    return null;
  }
  if (node instanceof sql.SelectStmt) {
    const internal = node[PRIV];
    return mergeSets(...internal.from.map((t) => extractTables(t)));
  }
  if (node instanceof sql.InsertStmt) {
    return extractTables(node[PRIV].into);
  }
  if (node instanceof sql.UpdateStmt) {
    return extractTables(node[PRIV].table);
  }
  if (node instanceof sql.DeleteStmt) {
    return extractTables(node[PRIV].from);
  }
  if (node instanceof sql.CreateTableStmt) {
    throw new Error('Not implemented');
  }
  if (node instanceof sql.Column) {
    return null;
  }
  if (node instanceof sql.BinaryExpr) {
    return null;
  }
  if (node instanceof sql.UnaryExpr) {
    return null;
  }
  if (node instanceof sql.LiteralExpr) {
    return null;
  }
  if (node instanceof sql.Param) {
    return null;
  }
  if (node instanceof sql.JsonTable) {
    return new Set([node]);
  }
  if (node instanceof sql.Table) {
    return new Set([node]);
  }
  if (node instanceof sql.Aggregate) {
    return null;
  }
  if (node instanceof sql.ColumnDef) {
    throw new Error('Not implemented');
  }
  if (node instanceof sql.Value) {
    throw new Error('Not implemented');
  }
  return expectNever(node);
}

export function extractColumns(node: Node | null): Set<Column> | null {
  if (node === null) {
    return null;
  }
  if (node instanceof sql.SelectStmt) {
    const internal = node[PRIV];
    return mergeSets(
      ...internal.columns.map((c) => extractColumns(c)),
      extractColumns(internal.where),
      mapMaybe(internal.limit, ({ limit, offset }) =>
        mergeSets(extractColumns(limit), extractColumns(offset))
      )
    );
  }
  if (node instanceof sql.InsertStmt) {
    const internal = node[PRIV];
    return mergeSets(
      new Set(internal.columns),
      ...internal.values.map((v) => mergeSets(...v.map((c) => extractColumns(c))))
    );
  }
  if (node instanceof sql.UpdateStmt) {
    const internal = node[PRIV];
    return mergeSets(
      ...internal.set.map(([_col, val]) => extractColumns(val)),
      extractColumns(internal.where)
    );
  }
  if (node instanceof sql.DeleteStmt) {
    const internal = node[PRIV];
    return extractColumns(internal.where);
  }
  if (node instanceof sql.CreateTableStmt) {
    throw new Error('Not implemented');
  }
  if (node instanceof sql.Column) {
    return new Set([node]);
  }
  if (node instanceof sql.BinaryExpr) {
    return mergeSets(extractColumns(node[PRIV].left), extractColumns(node[PRIV].right));
  }
  if (node instanceof sql.UnaryExpr) {
    return extractColumns(node[PRIV].expr);
  }
  if (node instanceof sql.LiteralExpr) {
    return null;
  }
  if (node instanceof sql.Param) {
    return null;
  }
  if (node instanceof sql.JsonTable) {
    return new Set([node[PRIV].sourceColumn]);
  }
  if (node instanceof sql.Table) {
    return null;
  }
  if (node instanceof sql.Aggregate) {
    return new Set([node[PRIV].column]);
  }
  if (node instanceof sql.ColumnDef) {
    throw new Error('Not implemented');
  }
  if (node instanceof sql.Value) {
    throw new Error('Not implemented');
  }
  return expectNever(node);
}
