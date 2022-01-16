import { expectNever, PRIV } from './Utils';

export const expr = {
  eq(left: Expr, right: Expr): Expr {
    return { kind: 'BinaryOp', op: '=', left, right };
  },
  neq(left: Expr, right: Expr): Expr {
    return { kind: 'BinaryOp', op: '!=', left, right };
  },
  lte(left: Expr, right: Expr): Expr {
    return { kind: 'BinaryOp', op: '<=', left, right };
  },
  gte(left: Expr, right: Expr): Expr {
    return { kind: 'BinaryOp', op: '>=', left, right };
  },
  lt(left: Expr, right: Expr): Expr {
    return { kind: 'BinaryOp', op: '<', left, right };
  },
  gt(left: Expr, right: Expr): Expr {
    return { kind: 'BinaryOp', op: '>', left, right };
  },
  and(left: Expr, right: Expr): Expr {
    return { kind: 'BinaryOp', op: 'AND', left, right };
  },
  or(left: Expr, right: Expr): Expr {
    return { kind: 'BinaryOp', op: 'OR', left, right };
  },
};

export function printExpression(expr: Expr): string {
  if (expr === null) {
    return 'NULL';
  }
  if (typeof expr === 'string') {
    return `'${expr.replace(`'`, `''`)}'`;
  }
  if (typeof expr === 'number') {
    return expr.toString();
  }
  if (typeof expr === 'boolean') {
    // SQLite does not support boolean, use 0 or 1 instead
    return expr ? '1' : '0';
  }
  if (expr.kind === 'BinaryOp') {
    return `(${printExpression(expr.left)} ${expr.op} ${printExpression(expr.right)})`;
  }
  if (expr.kind === 'ParamRef') {
    return `:${expr[PRIV]}`;
  }
  if (expr.kind === 'IndexRef') {
    return `${expr[PRIV]}`;
  }
  return expectNever(expr);
}

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

export type ExpressionNode = {
  kind: 'BinaryOp';
  left: Expr;
  op: BinaryOperator;
  right: Expr;
};

export type Expr = ExpressionNode | ParamRef | IndexRef | number | string | boolean | null;

export type ParamRef = {
  kind: 'ParamRef';
  [PRIV]: string;
};

export type IndexRef = {
  kind: 'IndexRef';
  [PRIV]: string;
};
