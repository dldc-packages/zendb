import { UnaryExpr } from './UnaryExpr';
import { Column } from './Column';
import { LiteralExpr } from './LiteralExpr';
import { Param } from './Param';
import { Aggregate } from './Aggregate';
import { BinaryExpr } from './BinaryExpr';
import { expectNever } from '../Utils';

export type Expr = Aggregate | Column | BinaryExpr | UnaryExpr | LiteralExpr | Param;

export const Expr = {
  print,
  extractParams,
  extractColumns,
  // shortcuts
  eq: BinaryExpr.equal,
  neq: BinaryExpr.notEqual,
  gt: BinaryExpr.greaterThan,
  gte: BinaryExpr.greaterThanOrEqual,
  lt: BinaryExpr.lessThan,
  lte: BinaryExpr.lessThanOrEqual,
  and: BinaryExpr.and,
  or: BinaryExpr.or,
  literal: LiteralExpr.create,
};

function print(node: Expr): string {
  if (node instanceof Column) {
    return Column.printRef(node);
  }
  if (node instanceof Aggregate) {
    return Aggregate.printRef(node);
  }
  if (node instanceof BinaryExpr) {
    return BinaryExpr.print(node);
  }
  if (node instanceof UnaryExpr) {
    return UnaryExpr.print(node);
  }
  if (node instanceof LiteralExpr) {
    return LiteralExpr.print(node);
  }
  if (node instanceof Param) {
    return Param.print(node);
  }
  return expectNever(node);
}

function extractParams(_node: Expr): Set<Param> {
  throw new Error('Not implemented');
}

function extractColumns(_node: Expr): Set<Column> {
  throw new Error('Not implemented');
}
