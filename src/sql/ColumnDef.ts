import { join, PRIV, sqlQuote } from '../Utils';
import { ValueAny, Value } from './Value';

type ColumnDefInternal = {
  name: string;
  value: ValueAny;
};

export class ColumnDef {
  static create(name: string, value: ValueAny): ColumnDef {
    return new ColumnDef({
      name,
      value,
    });
  }

  static print(node: ColumnDef): string {
    const { name, value } = node[PRIV];
    return join.space(sqlQuote(name), Value.print(value));
  }

  readonly [PRIV]: ColumnDefInternal;

  private constructor(internal: ColumnDefInternal) {
    this[PRIV] = internal;
  }

  nullable(): ColumnDef {
    return new ColumnDef({ ...this[PRIV], value: this[PRIV].value.nullable() });
  }

  defaultValue(defaultValue: () => any) {
    return new ColumnDef({ ...this[PRIV], value: this[PRIV].value.defaultValue(defaultValue) });
  }

  primary() {
    return new ColumnDef({ ...this[PRIV], value: this[PRIV].value.primary() });
  }

  unique() {
    return new ColumnDef({ ...this[PRIV], value: this[PRIV].value.unique() });
  }
}
