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

  static equal(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '=', right);
  }

  static notEqual(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '!=', right);
  }

  static lessThanOrEqual(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '<=', right);
  }

  static greaterThanOrEqual(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '>=', right);
  }

  static lessThan(left: Expr, right: Expr): BinaryExpr {
    return BinaryExpr.create(left, '<', right);
  }

  static greaterThan(left: Expr, right: Expr): BinaryExpr {
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
