import { PRIV } from '../Utils';
import { Expr } from './Expr';

type BinaryExprInteral = Readonly<{
  left: Expr;
  operator: BinaryOperator;
  right: Expr;
}>;

export type BinaryOperator =
  | '>'
  | '<'
  | '>='
  | '<='
  | '='
  | '=='
  | '!='
  | '<>'
  | '+'
  | '-'
  | '*'
  | '/'
  | 'IS'
  | 'IS NOT'
  | 'AND'
  | 'OR';

export class BinaryExpr {
  static create(left: Expr, operator: BinaryOperator, right: Expr): BinaryExpr {
    return new BinaryExpr({ operator, left, right });
  }

  static eq(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '=', right);
  }

  static neq(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '!=', right);
  }

  static lte(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '<=', right);
  }

  static gte(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '>=', right);
  }

  static lt(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '<', right);
  }

  static gt(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '>', right);
  }

  static and(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, 'AND', right);
  }

  static or(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, 'OR', right);
  }

  readonly [PRIV]: BinaryExprInteral;

  private constructor(internal: BinaryExprInteral) {
    this[PRIV] = internal;
  }
}
