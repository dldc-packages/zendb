import { PRIV } from '../../Utils';
import { ValueAny } from './Value';

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
