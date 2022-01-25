import { BinaryExpr } from './BinaryExpr';
import { UnaryExpr } from './UnaryExpr';
import { Column } from './Column';
import { LiteralExpr } from './LiteralExpr';
import { Param } from './Param';
import { Aggregate } from './Aggregate';

export type Expr = Aggregate | Column | BinaryExpr | UnaryExpr | LiteralExpr | Param;
