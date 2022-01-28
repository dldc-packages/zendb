import { expectNever, PRIV } from '../Utils';

type LiteralExprInternal = Readonly<{
  value: string | number | boolean | null;
}>;

export class LiteralExpr {
  static create(value: string | number | boolean | null): LiteralExpr {
    return new LiteralExpr({ value });
  }

  static print(node: LiteralExpr): string {
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

  static null = LiteralExpr.create(null);

  readonly [PRIV]: LiteralExprInternal;

  private constructor(internal: LiteralExprInternal) {
    this[PRIV] = internal;
  }
}
