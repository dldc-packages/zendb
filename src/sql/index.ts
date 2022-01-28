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
import { Expr } from './Expr';

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
  Expr,
  // stmt
  CreateTableStmt,
  InsertStmt,
  SelectStmt,
  UpdateStmt,
  DeleteStmt,
};

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
  ColumnDef,
  Datatype,
  DatatypeAny,
  DatatypeKind,
  DatatypeParsed,
  DateValue,
  DefaultValueBase,
  Expr,
  JsonTable,
  LiteralExpr,
  Param,
  Table,
  UnaryExpr,
  UnaryOperator,
  Value,
  ValueAny,
  ValueParsed,
  ValuesAny,
  ValuesParsed,
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
