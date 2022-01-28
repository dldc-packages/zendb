import { UnaryExpr } from './UnaryExpr';
import { Column } from './Column';
import { LiteralExpr } from './LiteralExpr';
import { Param } from './Param';
import { Aggregate } from './Aggregate';
import { BinaryExpr } from './BinaryExpr';
import { expectNever, mergeSets, PRIV } from '../Utils';

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

function extractParams(node: Expr): Set<Param> {
  if (node instanceof Param) {
    return new Set([node]);
  }
  if (node instanceof BinaryExpr) {
    const { left, right } = node[PRIV];
    return mergeSets(extractParams(left), extractParams(right));
  }
  if (node instanceof UnaryExpr) {
    const { expr } = node[PRIV];
    return extractParams(expr);
  }
  if (node instanceof Column) {
    return new Set();
  }
  if (node instanceof Aggregate) {
    return new Set();
  }
  if (node instanceof LiteralExpr) {
    return new Set();
  }
  return expectNever(node);
}

function extractColumns(node: Expr): Set<Column> {
  if (node instanceof Column) {
    return new Set([node]);
  }
  if (node instanceof BinaryExpr) {
    const { left, right } = node[PRIV];
    return mergeSets(extractColumns(left), extractColumns(right));
  }
  if (node instanceof UnaryExpr) {
    const { expr } = node[PRIV];
    return extractColumns(expr);
  }
  if (node instanceof Aggregate) {
    return new Set();
  }
  if (node instanceof LiteralExpr) {
    return new Set();
  }
  if (node instanceof Param) {
    return new Set();
  }
  return expectNever(node);
}
