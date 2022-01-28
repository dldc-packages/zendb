import { join, parent, PRIV } from '../Utils';
import { Table } from './Table';
import { ColumnDef } from './ColumnDef';

type CreateTableStmtInternal = Readonly<{
  table: Table;
  strict: boolean;
  ifNotExists: boolean;
  columns: Array<ColumnDef>;
}>;

type CreateTableOptions = {
  table: Table;
  strict?: boolean;
  ifNotExists?: boolean;
  columns?: Array<ColumnDef>;
};

export class CreateTableStmt {
  static create({
    table,
    columns = [],
    ifNotExists = false,
    strict = false,
  }: CreateTableOptions): CreateTableStmt {
    return new CreateTableStmt({ table, columns, ifNotExists, strict });
  }

  static print(node: CreateTableStmt): string {
    const { table, columns, ifNotExists, strict } = node[PRIV];
    return join.space(
      'CREATE TABLE',
      Table.printFrom(table),
      ifNotExists ? 'IF NOT EXISTS' : null,
      parent(join.comma(...columns.map((c) => ColumnDef.print(c)))),
      strict ? 'STRICT' : null
    );
  }

  readonly [PRIV]: CreateTableStmtInternal;

  private constructor(internale: CreateTableStmtInternal) {
    this[PRIV] = internale;
  }

  strict() {
    return new CreateTableStmt({
      ...this[PRIV],
      strict: true,
    });
  }

  ifNotExists() {
    return new CreateTableStmt({
      ...this[PRIV],
      ifNotExists: true,
    });
  }

  column(columnDef: ColumnDef) {
    return new CreateTableStmt({
      ...this[PRIV],
      columns: [...this[PRIV].columns, columnDef],
    });
  }
}
