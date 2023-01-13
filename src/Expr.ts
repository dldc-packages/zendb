import { PRIV } from './Utils';

export type CompareExpr<Val> = {
  [PRIV]: Val;
  kind: 'LowerThan' | 'GreaterThan' | 'LowerThanOrEqual' | 'GreaterThanOrEqual' | 'Equal' | 'Different' | 'Like' | 'NotLike';
  val: Val;
};

export type CombineExpr<Val> = {
  [PRIV]: Val;
  kind: 'And' | 'Or';
  left: IExpr<Val>;
  right: IExpr<Val>;
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

export type IExpr<Val> = CombineExpr<Val> | CompareExpr<Val> | SpecialExpr<Val> | InExpr<Val>;

export const Expr = (() => {
  return {
    is: isExpr,

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
    like: <Val>(val: Val) => createExpr<CompareExpr<Val>>({ kind: 'Like', val }),
    notLike: <Val>(val: Val) => createExpr<CompareExpr<Val>>({ kind: 'NotLike', val }),
    isNull: <Val>() => createExpr<SpecialExpr<Val>>({ kind: 'IsNull' }),
    isNotNull: <Val>() => createExpr<SpecialExpr<Val>>({ kind: 'IsNotNull' }),
    and: <Val>(left: IExpr<Val>, right: IExpr<Val>) => createExpr<CombineExpr<Val>>({ kind: 'And', left, right }),
    or: <Val>(left: IExpr<Val>, right: IExpr<Val>) => createExpr<CombineExpr<Val>>({ kind: 'Or', left, right }),
    in: <Val>(values: Array<Val>) => createExpr<InExpr<Val>>({ kind: 'In', values }),
    notIn: <Val>(values: Array<Val>) => createExpr<InExpr<Val>>({ kind: 'NotIn', values }),
  };

  function createExpr<E extends IExpr<any>>(data: Omit<E, PRIV>): E {
    return {
      [PRIV]: 'Expr',
      ...data,
    } as any;
  }

  function isExpr(maybe: unknown): maybe is IExpr<any> {
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
})();
