import { join, mapMaybe, PRIV, sqlQuote } from '../Utils';
import { JsonTable } from './JsonTable';
import { Table } from './Table';

type ColumnInternal = {
  table: Table | JsonTable;
  name: string;
  alias: null | { original: Column; alias: string };
};

export class Column {
  static create(table: Table | JsonTable, name: string): Column {
    return new Column({ table, name, alias: null });
  }

  static printSelect(node: Column): string {
    const { alias, name, table } = node[PRIV];
    const tableRef = table instanceof Table ? Table.printRef(table) : JsonTable.printRef(table);
    return join.all(
      tableRef,
      '.',
      sqlQuote(name),
      mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
    );
  }

  static printRef(node: Column): string {
    const { alias, name, table } = node[PRIV];
    const tableRef = table instanceof Table ? Table.printRef(table) : JsonTable.printRef(table);
    return alias ? sqlQuote(alias.alias) : join.all(tableRef, '.', sqlQuote(name));
  }

  static printName(node: Column): string {
    const { name } = node[PRIV];
    return sqlQuote(name);
  }

  readonly [PRIV]: ColumnInternal;

  private constructor(internal: ColumnInternal) {
    this[PRIV] = internal;
  }

  public as(alias: string) {
    if (this[PRIV].alias) {
      throw new Error('Column already aliased');
    }
    return new Column({
      ...this[PRIV],
      alias: { original: this, alias },
    });
  }
}
