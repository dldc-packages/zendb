import { IColumnRef, IExpr, IJson } from './Expr';
import { ITableQuery } from './TableQuery';
import { TYPES } from './utils/constants';
import { ColumnsRef } from './utils/types';

export const Populate = (() => {
  return {
    all: populateAll,
    one: populateOne,
    first: populateFirst,
    maybeOne: populateMaybeOne,
    maybeFirst: populateMaybeFirst,
  };

  function populateAll<RT extends ITableQuery<any>, ResultColumn>(
    _leftCol: IExpr<any>,
    _table: RT,
    _rightCol: keyof RT[TYPES],
    _select: (cols: ColumnsRef<RT[TYPES]>) => IExpr<ResultColumn>
  ): IColumnRef<IJson<Array<ResultColumn>>> {
    throw new Error('Not implemented');
  }

  function populateOne<RT extends ITableQuery<any>, ResultColumn>(
    _leftCol: IExpr<any>,
    _table: RT,
    _rightCol: keyof RT[TYPES],
    _select: (cols: ColumnsRef<RT[TYPES]>) => IExpr<ResultColumn>
  ): IColumnRef<IJson<ResultColumn>> {
    throw new Error('Not implemented');
  }

  function populateFirst<RT extends ITableQuery<any>, ResultColumn>(
    _leftCol: IExpr<any>,
    _table: RT,
    _rightCol: keyof RT[TYPES],
    _select: (cols: ColumnsRef<RT[TYPES]>) => IExpr<ResultColumn>
  ): IColumnRef<IJson<ResultColumn>> {
    throw new Error('Not implemented');
  }

  function populateMaybeOne<RT extends ITableQuery<any>, ResultColumn>(
    _leftCol: IExpr<any>,
    _table: RT,
    _rightCol: keyof RT[TYPES],
    _select: (cols: ColumnsRef<RT[TYPES]>) => IExpr<ResultColumn>
  ): IColumnRef<IJson<ResultColumn | null>> {
    throw new Error('Not implemented');
  }

  function populateMaybeFirst<RT extends ITableQuery<any>, ResultColumn>(
    _leftCol: IExpr<any>,
    _table: RT,
    _rightCol: keyof RT[TYPES],
    _select: (cols: ColumnsRef<RT[TYPES]>) => IExpr<ResultColumn>
  ): IColumnRef<IJson<ResultColumn | null>> {
    throw new Error('Not implemented');
  }
})();
