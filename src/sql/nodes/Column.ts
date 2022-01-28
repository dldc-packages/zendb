import { PRIV } from '../../Utils';
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
