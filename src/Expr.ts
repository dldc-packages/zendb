import { PRIV } from './Utils';

export type CompareExpr<Val> = {
  [PRIV]: Val;
  kind: 'LowerThan' | 'GreaterThan' | 'LowerThanOrEqual' | 'GreaterThanOrEqual' | 'Equal' | 'Different';
  val: Val;
};

export type CombineExpr<Val> = {
  [PRIV]: Val;
  kind: 'And' | 'Or';
  left: Expr<Val>;
  right: Expr<Val>;
};

export type SpecialExpr<Val> = {
  [PRIV]: Val;
  kind: 'IsNull' | 'IsNotNull';
};

export type InExpr<Val> = {
  [PRIV]: Val;
  kind: 'In' | 'NotIn';
  values: Array<Val>;
};

export type Expr<Val> = CombineExpr<Val> | CompareExpr<Val> | SpecialExpr<Val> | InExpr<Val>;

function createExpr<E extends Expr<any>>(data: Omit<E, PRIV>): E {
  return {
    [PRIV]: 'Expr',
    ...data,
  } as any;
}

export function isExpr(maybe: unknown): maybe is Expr<any> {
  return Boolean(maybe && (maybe as any)[PRIV] === 'Expr');
}

function equal<Val>(val: Val) {
  return createExpr<CompareExpr<Val>>({ kind: 'Equal', val });
}

function lowerThan<Val>(val: Val) {
  return createExpr<CompareExpr<Val>>({ kind: 'LowerThan', val });
}

function greaterThan<Val>(val: Val) {
  return createExpr<CompareExpr<Val>>({ kind: 'GreaterThan', val });
}

function lowerThanOrEqual<Val>(val: Val) {
  return createExpr<CompareExpr<Val>>({ kind: 'LowerThanOrEqual', val });
}

function greaterThanOrEqual<Val>(val: Val) {
  return createExpr<CompareExpr<Val>>({ kind: 'GreaterThanOrEqual', val });
}

export const Expr = {
  equal,
  eq: equal,
  different: <Val>(val: Val) => createExpr<CompareExpr<Val>>({ kind: 'Different', val }),
  lowerThan,
  lt: lowerThan,
  greaterThan,
  gt: greaterThan,
  lowerThanOrEqual,
  lte: lowerThanOrEqual,
  greaterThanOrEqual,
  gte: greaterThanOrEqual,
  isNull: <Val>() => createExpr<SpecialExpr<Val>>({ kind: 'IsNull' }),
  isNotNull: <Val>() => createExpr<SpecialExpr<Val>>({ kind: 'IsNotNull' }),
  and: <Val>(left: Expr<Val>, right: Expr<Val>) => createExpr<CombineExpr<Val>>({ kind: 'And', left, right }),
  or: <Val>(left: Expr<Val>, right: Expr<Val>) => createExpr<CombineExpr<Val>>({ kind: 'Or', left, right }),
  in: <Val>(values: Array<Val>) => createExpr<InExpr<Val>>({ kind: 'In', values }),
  notIn: <Val>(values: Array<Val>) => createExpr<InExpr<Val>>({ kind: 'NotIn', values }),
};
