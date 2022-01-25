import { expectNever, join, mapMaybe, PRIV, sqlQuote } from '../Utils';
import { Aggregate } from './Aggregate';
import { BinaryOperator, BinaryExpr } from './BinaryExpr';
import { Column } from './Column';
import { Expr } from './Expr';
import { InsertStmt } from './InsertStmt';
import { JsonTable } from './JsonTable';
import { LiteralExpr } from './LiteralExpr';
import { Param } from './Param';
import { SelectStmt, SelectStmtFrom, SelectStmtLimit, SelectStmtOptions } from './SelectStmt';
import { Table } from './Table';
import { UnaryExpr } from './UnaryExpr';

export const sql = {
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
};

export type Node =
  | Expr
  | Column
  | BinaryExpr
  | UnaryExpr
  | LiteralExpr
  | Param
  | SelectStmt
  | InsertStmt
  | JsonTable
  | Table
  | Aggregate;

export type Stmt = SelectStmt | InsertStmt;

export type Resolved = {
  query: string;
};

export function resolveStmt(stmt: Stmt): Resolved {
  if (stmt instanceof SelectStmt) {
    return resolveSelectStmt(stmt);
  }
  if (stmt instanceof InsertStmt) {
    throw new Error('Not implemented');
  }
  return expectNever(stmt);
}

function resolveSelectStmt(stmt: SelectStmt): Resolved {
  // extract params, columns, tables
  const { params, select, tables } = extract(stmt);
  const columns = new Set(
    Array.from(select).map((item) => {
      if (item instanceof Column) {
        return item;
      }
      if (item instanceof Aggregate) {
        return item[PRIV].column;
      }
      return expectNever(item);
    })
  );
  // all columns must be in tables
  columns.forEach((column) => {
    if (!tables.has(column[PRIV].table)) {
      throw new Error(`Column "${column[PRIV].name}" is not in any table`);
    }
    return;
  });
  // all params be be anonymous or unique
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
  // all tables must be unique
  const tableNames = new Set<string>();
  tables.forEach((table) => {
    const name = printNodeAsRef(table).toLowerCase();
    if (tableNames.has(name)) {
      throw new Error(`Duplicate table name ${name}, reuse the same table instance.`);
    }
    tableNames.add(name);
    return;
  });
  // all select items must be unique
  const selectNames = new Map<Table | JsonTable | null, Set<string>>();
  select.forEach((item) => {
    const name = printNodeAsRef(item);
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
  // create names
  // const names = new Map<Node, string>();
  // function getName(node: Node): string {
  //   const name = names.get(node);
  //   if (!name) {
  //     console.error(node);
  //     throw new Error(`Unresolved name for node ${node}`);
  //   }
  //   return name;
  // }
  // params.forEach((param) => {
  //   const internal = param[PRIV];
  //   if (internal.kind === 'Anonymous') {
  //     names.set(param, `?`);
  //     return;
  //   }
  //   if (internal.kind === 'Named') {
  //     names.set(param, `:${internal.name}`);
  //     return;
  //   }
  //   return expectNever(internal);
  // });
  // columns.forEach((column) => {
  //   if (column instanceof Column) {
  //     const { alias, name, table } = column[PRIV];
  //     const resolved = join.space(
  //       `${sqlQuote(tableName(table))}.${sqlQuote(name)}`,
  //       mapMaybe(alias, ({ alias }) => `AS ${sqlQuote(alias)}`)
  //     );
  //     names.set(column, resolved);
  //     return;
  //   }
  //   return expectNever(column);
  // });
  // tables.forEach((table) => {
  //   if (table instanceof Table) {
  //     const { alias, name } = table[PRIV];
  //     const nameResolve = join.space(
  //       sqlQuote(name),
  //       mapMaybe(alias, ({ alias }) => `AS ${sqlQuote(alias)}`)
  //     );
  //     names.set(table, nameResolve);
  //     return;
  //   }
  //   if (table instanceof JsonTable) {
  //     const { alias, sourceColumn, mode, path } = table[PRIV];
  //     const fnName = { Each: 'json_each', Tree: 'json_tree' }[mode];
  //     const nameResolve = join.space(
  //       `${fnName}(${getName(sourceColumn)}${path ? `, '${path}'` : ''})`,
  //       mapMaybe(alias, ({ alias }) => `AS ${sqlQuote(alias)}`)
  //     );
  //     names.set(table, nameResolve);
  //     return;
  //   }
  //   return expectNever(table);
  // });
  const query = printNodeAsRef(stmt);
  return { query };
}

type Extracted = {
  params: Set<Param>;
  select: Set<Column | Aggregate>;
  tables: Set<Table | JsonTable>;
};

function mergeExtracts(...extracts: Array<Extracted | null>): Extracted {
  const params = new Set<Param>();
  const columns = new Set<Column | Aggregate>();
  const tables = new Set<Table | JsonTable>();
  for (const extract of extracts) {
    if (extract) {
      extract.params.forEach((param) => params.add(param));
      extract.select.forEach((column) => columns.add(column));
      extract.tables.forEach((table) => tables.add(table));
    }
  }
  return { params, select: columns, tables };
}

function extract(node: Node | null): Extracted {
  if (node === null) {
    return { params: new Set(), select: new Set(), tables: new Set() };
  }
  if (node instanceof SelectStmt) {
    const internal = node[PRIV];
    return mergeExtracts(
      ...internal.from.map((t) => extract(t)),
      ...internal.select.map((c) => extract(c)),
      extract(internal.where),
      mapMaybe(internal.limit, ({ limit, offset }) =>
        mergeExtracts(extract(limit), extract(offset))
      )
    );
  }
  if (node instanceof InsertStmt) {
    throw new Error('not implemented');
  }
  if (node instanceof Column) {
    return { params: new Set(), select: new Set([node]), tables: new Set() };
  }
  if (node instanceof BinaryExpr) {
    return mergeExtracts(extract(node[PRIV].left), extract(node[PRIV].right));
  }
  if (node instanceof UnaryExpr) {
    return extract(node[PRIV].expr);
  }
  if (node instanceof LiteralExpr) {
    return { params: new Set(), select: new Set(), tables: new Set() };
  }
  if (node instanceof Param) {
    return { params: new Set([node]), select: new Set(), tables: new Set() };
  }
  if (node instanceof JsonTable) {
    return {
      params: new Set(),
      select: new Set([node[PRIV].sourceColumn]),
      tables: new Set([node]),
    };
  }
  if (node instanceof Table) {
    return { params: new Set(), select: new Set(), tables: new Set([node]) };
  }
  if (node instanceof Aggregate) {
    return {
      params: new Set(),
      select: new Set([node]),
      tables: new Set(),
    };
  }
  return expectNever(node);
}

type PrintContext = {
  mode: 'select' | 'ref';
};

function printNodeAsRef(node: Node) {
  return printNode(node, { mode: 'ref' });
}

function printNodeAsSelect(node: Node) {
  return printNode(node, { mode: 'select' });
}

function mapContextMode<Res>(
  ctx: PrintContext,
  options: { [K in PrintContext['mode']]: () => Res }
): Res {
  return options[ctx.mode]();
}

function printNode(node: Node, ctx: PrintContext): string {
  if (node instanceof BinaryExpr) {
    const { left, right, operator } = node[PRIV];
    return `(${printNodeAsRef(left)} ${operator} ${printNodeAsRef(right)})`;
  }
  if (node instanceof UnaryExpr) {
    const { expr, operator } = node[PRIV];
    return `(${operator} ${printNodeAsRef(expr)})`;
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
    return mapContextMode(ctx, {
      select: () =>
        join.all(
          printNodeAsRef(table),
          '.',
          sqlQuote(name),
          mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
        ),
      ref: () =>
        alias ? sqlQuote(alias.alias) : join.all(printNodeAsRef(table), '.', sqlQuote(name)),
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
    return mapContextMode(ctx, {
      select: () =>
        join.all(
          fnName,
          '(',
          printNodeAsRef(sourceColumn),
          mapMaybe(path, (p) => `, '${p}'`),
          ')',
          mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
        ),
      ref: () => sqlQuote(alias ? alias.alias : 'json_each'),
    });
  }
  if (node instanceof Table) {
    const { alias, name } = node[PRIV];
    return mapContextMode(ctx, {
      select: () =>
        join.all(
          sqlQuote(name),
          mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
        ),
      ref: () => sqlQuote(alias ? alias.alias : name),
    });
  }
  if (node instanceof Aggregate) {
    const { alias, column, fn } = node[PRIV];
    const fnName = { Count: 'COUNT', Sum: 'SUM', Min: 'MIN', Max: 'MAX' }[fn];
    return mapContextMode(ctx, {
      select: () =>
        join.all(
          fnName,
          '(',
          printNodeAsRef(column),
          ')',
          mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
        ),
      ref: () => (alias ? sqlQuote(alias.alias) : `${fnName}(${sqlQuote(printNodeAsRef(column))})`),
    });
  }
  if (node instanceof SelectStmt) {
    const { select, from, where, orderBy, limit, distinct } = node[PRIV];
    return join.space(
      'SELECT',
      distinct ? 'DISTINCT' : null,
      join.comma(...select.map((c) => printNodeAsSelect(c))),
      'FROM',
      join.comma(...from.map((t) => printNodeAsSelect(t))),
      mapMaybe(where, (w) => `WHERE ${printNodeAsRef(w)}`),
      mapMaybe(orderBy, (o) => `ORDER BY ${join.comma(...o.map((expr) => printNodeAsRef(expr)))}`),
      mapMaybe(limit, (l) =>
        join.space(
          `LIMIT`,
          printNodeAsRef(l.limit),
          mapMaybe(l.offset, (o) => join.space(`OFFSET`, printNodeAsRef(o)))
        )
      )
    );
  }
  if (node instanceof InsertStmt) {
    throw new Error('not implemented');
  }
  return expectNever(node);
}
