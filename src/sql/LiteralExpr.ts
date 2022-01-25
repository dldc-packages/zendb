import { PRIV } from '../Utils';

type LiteralExprInternal = Readonly<{
  value: string | number | boolean | null;
}>;

export class LiteralExpr {
  static create(value: string | number | boolean | null): LiteralExpr {
    return new LiteralExpr({ value });
  }

  static null = LiteralExpr.create(null);

  readonly [PRIV]: LiteralExprInternal;

  private constructor(internal: LiteralExprInternal) {
    this[PRIV] = internal;
  }
}
