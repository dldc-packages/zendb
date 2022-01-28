import { expectNever, join, mapMaybe, parent, PRIV, sqlQuote } from '../Utils';
import { Node, sql } from './nodes';

/**
 * full: table.col as bar
 * ref: table.col
 * name: col (no table)
 */
type PrintMode = 'full' | 'ref' | 'name';

function mapPrintMode<Res>(mode: PrintMode, options: { [K in PrintMode]: () => Res }): Res {
  return options[mode]();
}

export function printNode(node: Node, printMode: PrintMode): string {
  if (node instanceof sql.BinaryExpr) {
    const { left, right, operator } = node[PRIV];
    return `(${printNode(left, 'ref')} ${operator} ${printNode(right, 'ref')})`;
  }
  if (node instanceof sql.UnaryExpr) {
    const { expr, operator } = node[PRIV];
    return `(${operator} ${printNode(expr, 'ref')})`;
  }
  if (node instanceof sql.LiteralExpr) {
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
  if (node instanceof sql.Column) {
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
  if (node instanceof sql.Param) {
    const internal = node[PRIV];
    if (internal.kind === 'Anonymous') {
      return `?`;
    }
    if (internal.kind === 'Named') {
      return `:${internal.name}`;
    }
    return expectNever(internal);
  }
  if (node instanceof sql.JsonTable) {
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
  if (node instanceof sql.Table) {
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
  if (node instanceof sql.Aggregate) {
    const { alias, column, fn, distinct } = node[PRIV];
    const fnName = { Count: 'COUNT', Sum: 'SUM', Min: 'MIN', Max: 'MAX' }[fn];
    return mapPrintMode(printMode, {
      full: () =>
        join.all(
          fnName,
          '(',
          join.space(distinct ? 'DISTINCT' : null, printNode(column, 'ref')),
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
  if (node instanceof sql.ColumnDef) {
    const { name, value } = node[PRIV];
    return join.space(sqlQuote(name), printNode(value, 'ref'));
  }
  if (node instanceof sql.Value) {
    // const { datatype, nullable, primary, unique } = node[PRIV];
    // return join.space();
    throw new Error('Not implemented');
  }
  if (node instanceof sql.SelectStmt) {
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
  if (node instanceof sql.InsertStmt) {
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
  if (node instanceof sql.UpdateStmt) {
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
  if (node instanceof sql.DeleteStmt) {
    const { from, where } = node[PRIV];
    return join.space(
      'DELETE FROM',
      printNode(from, 'full'),
      mapMaybe(where, (w) => `WHERE ${printNode(w, 'ref')}`)
    );
  }
  if (node instanceof sql.CreateTableStmt) {
    const { table, columns, ifNotExists, strict } = node[PRIV];
    return join.space(
      'CREATE TABLE',
      printNode(table, 'full'),
      ifNotExists ? 'IF NOT EXISTS' : null,
      parent(join.comma(...columns.map((c) => printNode(c, 'full')))),
      strict ? 'STRICT' : null
    );
  }
  return expectNever(node);
}
