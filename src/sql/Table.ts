import { PRIV } from '../Utils';
import { Column } from './Column';

type TableInternal = Readonly<{
  name: string;
  alias: null | { original: Table; alias: string };
}>;

export class Table {
  static create(name: string): Table {
    return new Table({ name, alias: null });
  }

  readonly [PRIV]: TableInternal;

  private constructor(internal: TableInternal) {
    this[PRIV] = internal;
  }

  public column(name: string): Column {
    return Column.create(this, name);
  }

  public as(alias: string): Table {
    if (this[PRIV].alias) {
      throw new Error('Table already aliased');
    }
    return new Table({
      ...this[PRIV],
      alias: { alias, original: this },
    });
  }
}
