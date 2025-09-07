import { builder } from "@dldc/sqlite";
import * as Datatype from "../Datatype.ts";
import { PRIV, type TYPES } from "../utils/constants.ts";
import { create, type TExpr, type TExprUnknow } from "./Expr.ts";

export const count = <Expr extends TExprUnknow>(
  expr: Expr,
): TExpr<number, false> => {
  // count always returns a number
  return create(
    builder.Aggregate.count({ params: expr.ast }),
    {
      parse: Datatype.number.parse,
      nullable: false,
      dependencies: expr[PRIV].dependencies,
    },
  );
};

export const countStar = (): TExpr<number, false> => {
  // count always returns a number
  return create(
    builder.Aggregate.aggregateFunctionInvocation("count", "*"),
    {
      parse: Datatype.number.parse,
      nullable: false,
    },
  );
};

// Note: for the following functions, the result is always nullable because the result is null when the input is empty
export const avg = <Expr extends TExpr<number, boolean>>(
  expr: Expr,
): TExpr<number, true> => {
  return create(
    builder.Aggregate.avg({ params: expr.ast }),
    {
      parse: Datatype.number.parse,
      nullable: true,
      dependencies: expr[PRIV].dependencies,
    },
  );
};

export const sum = <Expr extends TExpr<number, boolean>>(
  expr: Expr,
): TExpr<number, true> => {
  return create(
    builder.Aggregate.sum({ params: expr.ast }),
    {
      parse: Datatype.number.parse,
      nullable: true,
      dependencies: expr[PRIV].dependencies,
    },
  );
};

export const min = <Expr extends TExprUnknow>(
  expr: Expr,
): TExpr<Expr[TYPES]["val"], true> => {
  return create(
    builder.Aggregate.min({ params: expr.ast }),
    {
      parse: expr[PRIV].parse,
      nullable: true,
      dependencies: expr[PRIV].dependencies,
    },
  );
};

export const max = <Expr extends TExprUnknow>(
  expr: Expr,
): TExpr<Expr[TYPES]["val"], true> => {
  return create(
    builder.Aggregate.max({ params: expr.ast }),
    {
      parse: expr[PRIV].parse,
      nullable: true,
      dependencies: expr[PRIV].dependencies,
    },
  );
};
