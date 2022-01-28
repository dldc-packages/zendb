import { join, mapMaybe, PRIV, sqlQuote } from '../Utils';
import { Column } from './Column';

type TableInternal = Readonly<{
  name: string;
  strict: boolean;
  alias: null | { original: Table; alias: string };
}>;

export class Table {
  static create(name: string): Table {
    return new Table({ name, alias: null, strict: false });
  }

  static printFrom(node: Table): string {
    const { alias, name } = node[PRIV];
    return join.all(
      sqlQuote(name),
      mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
    );
  }

  static printRef(node: Table): string {
    const { alias, name } = node[PRIV];
    return sqlQuote(alias ? alias.alias : name);
  }

  readonly [PRIV]: TableInternal;

  private constructor(internal: TableInternal) {
    this[PRIV] = internal;
  }

  public column(name: string): Column {
    return Column.create(this, name);
  }

  public strict(): Table {
    return new Table({ ...this[PRIV], strict: true });
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
