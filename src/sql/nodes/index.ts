import { UnaryExpr, UnaryOperator } from './UnaryExpr';
import { Column } from './Column';
import { LiteralExpr } from './LiteralExpr';
import { Param } from './Param';
import { Aggregate } from './Aggregate';
import { BinaryOperator, BinaryExpr } from './BinaryExpr';
import { ColumnDef } from './ColumnDef';
import { CreateTableStmt } from './CreateTableStmt';
import { DeleteStmt } from './DeleteStmt';
import { InsertStmt } from './InsertStmt';
import { JsonTable } from './JsonTable';
import { SelectStmt, SelectStmtFrom, SelectStmtLimit, SelectStmtOptions } from './SelectStmt';
import { Table } from './Table';
import { UpdateStmt } from './UpdateStmt';
import { Value, ValueAny, DefaultValueBase, ValueParsed, ValuesAny, ValuesParsed } from './Value';
import { DatatypeAny, DatatypeKind, DatatypeParsed, Datatype, DateValue } from './Datatype';

export const sql = {
  Aggregate,
  BinaryExpr,
  Column,
  JsonTable,
  LiteralExpr,
  Param,
  Table,
  UnaryExpr,
  ColumnDef,
  Value,
  // stmt
  CreateTableStmt,
  InsertStmt,
  SelectStmt,
  UpdateStmt,
  DeleteStmt,
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

export type Expr = Aggregate | Column | BinaryExpr | UnaryExpr | LiteralExpr | Param;

export type Node =
  | Expr
  | Column
  | BinaryExpr
  | UnaryExpr
  | LiteralExpr
  | Param
  | JsonTable
  | Table
  | Aggregate
  | ColumnDef
  | ValueAny
  | Stmt;

export type Stmt = SelectStmt | InsertStmt | UpdateStmt | DeleteStmt | CreateTableStmt;

export type {
  Aggregate,
  BinaryExpr,
  BinaryOperator,
  Column,
  JsonTable,
  LiteralExpr,
  Param,
  Table,
  UnaryExpr,
  ColumnDef,
  UnaryOperator,
  Value,
  ValueAny,
  DefaultValueBase,
  ValueParsed,
  ValuesAny,
  ValuesParsed,
  Datatype,
  DatatypeAny,
  DatatypeKind,
  DatatypeParsed,
  DateValue,
  // stmt
  CreateTableStmt,
  DeleteStmt,
  InsertStmt,
  SelectStmt,
  UpdateStmt,
  // stmt select
  SelectStmtFrom,
  SelectStmtLimit,
  SelectStmtOptions,
};
