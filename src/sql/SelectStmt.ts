import { expectNever, join, mapMaybe, mergeSets, PRIV } from '../Utils';
import { Table } from './Table';
import { JsonTable } from './JsonTable';
import { Expr } from './Expr';
import { Column } from './Column';
import { Aggregate } from './Aggregate';
import { Param } from './Param';
import {
  ensureColumnsInTables,
  ensureUniqueParams,
  ensureUniqueTables,
  printColumnOrAggregateRef,
  printColumnOrAggregateSelect,
} from './Utils';

export type SelectStmtFrom = Table | JsonTable | Array<Table | JsonTable>;
export type SelectStmtLimit = { limit: Expr; offset: Expr | null } | null;

type SelectStmtInternal = Readonly<{
  distinct: boolean;
  columns: Array<Column | Aggregate>;
  from: Array<Table | JsonTable>;
  where: Expr | null;
  orderBy: Array<Expr> | null;
  limit: SelectStmtLimit;
  alias: null | { original: SelectStmt; alias: string };
}>;

export type SelectStmtOptions = {
  columns: Array<Column | Aggregate>;
  from: SelectStmtFrom;
  where?: Expr | null;
  orderBy?: Array<Expr> | null;
  limit?: SelectStmtLimit;
  distinct?: boolean;
};

export class SelectStmt {
  static create({
    columns,
    from,
    limit = null,
    orderBy = null,
    where = null,
    distinct = false,
  }: SelectStmtOptions): SelectStmt {
    return new SelectStmt({
      distinct,
      columns,
      from: Array.isArray(from) ? from : [from],
      where,
      orderBy,
      limit,
      alias: null,
    });
  }

  static print(node: SelectStmt): string {
    const { columns, from, where, orderBy, limit, distinct } = node[PRIV];

    // extract params, columns, tables
    const params = SelectStmt.extractParams(node);
    const tables = new Set(from);
    const allColumns = SelectStmt.extractColumns(node);

    ensureColumnsInTables(allColumns, tables);
    ensureUniqueParams(params);
    ensureUniqueTables(tables);

    // all select items must be unique
    const selectNames = new Map<Table | JsonTable | null, Set<string>>();
    columns.forEach((item) => {
      const name = printColumnOrAggregateRef(item);
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

    return join.space(
      'SELECT',
      distinct ? 'DISTINCT' : null,
      join.comma(...columns.map((c) => printColumnOrAggregateSelect(c))),
      'FROM',
      join.comma(
        ...from.map((t) => (t instanceof Table ? Table.printFrom(t) : JsonTable.printFrom(t)))
      ),
      mapMaybe(where, (w) => `WHERE ${Expr.print(w)}`),
      mapMaybe(orderBy, (o) => `ORDER BY ${join.comma(...o.map((expr) => Expr.print(expr)))}`),
      mapMaybe(limit, (l) =>
        join.space(
          `LIMIT`,
          Expr.print(l.limit),
          mapMaybe(l.offset, (o) => join.space(`OFFSET`, Expr.print(o)))
        )
      )
    );
  }

  static extractParams(node: SelectStmt): Set<Param> {
    const internal = node[PRIV];
    return mergeSets(
      mapMaybe(internal.where, (w) => Expr.extractParams(w)),
      mapMaybe(internal.limit, ({ limit, offset }) =>
        mergeSets(
          Expr.extractParams(limit),
          mapMaybe(offset, (o) => Expr.extractParams(o))
        )
      )
    );
  }

  static extractColumns(node: SelectStmt): Set<Column> {
    const internal = node[PRIV];
    return mergeSets(
      ...internal.columns.map((c) => {
        if (c instanceof Column) {
          return new Set([c]);
        }
        if (c instanceof Aggregate) {
          return new Set([c[PRIV].column]);
        }
        return expectNever(c);
      }),
      mapMaybe(internal.where, (w) => Expr.extractColumns(w)),
      mapMaybe(internal.limit, ({ limit, offset }) =>
        mergeSets(
          Expr.extractColumns(limit),
          mapMaybe(offset, (o) => Expr.extractColumns(o))
        )
      )
    );
  }

  readonly [PRIV]: SelectStmtInternal;

  private constructor(internal: SelectStmtInternal) {
    this[PRIV] = internal;
  }

  public where(where: Expr | null): SelectStmt {
    return new SelectStmt({
      ...this[PRIV],
      where,
    });
  }

  public limit(limit: Expr, offset: Expr | null = null): SelectStmt {
    return new SelectStmt({
      ...this[PRIV],
      limit: { limit, offset },
    });
  }

  public orderBy(orderBy: Array<Expr> | null): SelectStmt {
    return new SelectStmt({
      ...this[PRIV],
      orderBy,
    });
  }

  public as(alias: string): SelectStmt {
    if (this[PRIV].alias) {
      throw new Error('Cannot alias a SelectStmt more than once');
    }
    return new SelectStmt({
      ...this[PRIV],
      alias: { alias, original: this },
    });
  }
}
