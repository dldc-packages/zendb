import { PRIV } from '../Utils';
import { Expr } from './Expr';

type UnaryExprInteral = Readonly<{
  operator: UnaryOperator;
  expr: Expr;
}>;

export type UnaryOperator = 'NOT' | '~' | '+' | '-';

export class UnaryExpr {
  static create(operator: UnaryOperator, expr: Expr): UnaryExpr {
    return new UnaryExpr({ operator, expr });
  }

  static not(expr: Expr): UnaryExpr {
    return UnaryExpr.create('NOT', expr);
  }

  readonly [PRIV]: UnaryExprInteral;

  private constructor(internal: UnaryExprInteral) {
    this[PRIV] = internal;
  }
}
