import { Expr, IColumnRef, IExpr } from './Expr';
import { IQueryOperation } from './Operation';
import { PRIV, TYPES } from './utils/constants';
import { ColsBase, ColsFromSelect, ColumnsDefsBase, ColumnsRef, FilterEqual, ITableResult, QueryResult, SelectBase } from './utils/types';
import { mapObject } from './utils/utils';

export interface ITableQueryInternal<Cols extends ColsBase> {
  readonly columnsRef: ColumnsRef<Cols>;
  readonly table: string;
}

export interface ITableQuery<Cols extends ColsBase> {
  readonly [TYPES]: Cols;
  readonly [PRIV]: ITableQueryInternal<Cols>;

  filter(fn: (cols: ColumnsRef<Cols>) => IExpr<any>): ITableQuery<Cols>;
  filterEqual(filters: FilterEqual<Cols>): ITableQuery<Cols>;

  select<NewCols extends SelectBase>(fn: (cols: ColumnsRef<Cols>) => NewCols): ITableQuery<ColsFromSelect<NewCols>>;

  join<RTable extends ITableQuery<any>, NewCols extends ColsBase>(
    table: RTable,
    expr: (lCols: ColumnsRef<Cols>, rCols: ColumnsRef<RTable[TYPES]>) => IExpr<any>,
    select: (lCols: ColumnsRef<Cols>, rCols: ColumnsRef<RTable[TYPES]>) => NewCols
  ): ITableQuery<NewCols>;

  groupBy(group: (cols: ColumnsRef<Cols>) => IExpr<any> | Array<IExpr<any>>): ITableQuery<Cols>;

  // Returns an Array
  all(): IQueryOperation<Array<QueryResult<Cols>>>;
  // Throw if result count is not === 1
  one(): IQueryOperation<QueryResult<Cols>>;
  // Throw if result count is > 1
  maybeOne(): IQueryOperation<QueryResult<Cols> | null>;
  // Throw if result count is === 0
  first(): IQueryOperation<QueryResult<Cols>>;
  // Never throws
  maybeFirst(): IQueryOperation<QueryResult<Cols> | null>;
}

export const TableQuery = (() => {
  return { createFromTable };

  function createFromTable<ColumnsDefs extends ColumnsDefsBase>(
    table: string,
    columns: ColumnsDefs
  ): ITableQuery<ITableResult<ColumnsDefs>> {
    return create({
      table,
      columnsRef: mapObject(columns, (key, _colDef): IColumnRef<any> => {
        return Expr.column(table, key);
      }),
    });
  }

  function create<Cols extends ColsBase>(internal: ITableQueryInternal<any>): ITableQuery<any> {
    return {
      [PRIV]: internal,
      [TYPES]: {} as any,
      filter,
      filterEqual,
      select,
      join,
      groupBy,
      all,
      one,
      maybeOne,
      first,
      maybeFirst,
    };

    function filter(_fn: (cols: ColumnsRef<Cols>) => IExpr<any>): ITableQuery<Cols> {
      throw new Error('Not implemented');
    }

    function filterEqual(_filters: FilterEqual<Cols>): ITableQuery<Cols> {
      throw new Error('Not implemented');
    }

    function select<NewCols extends SelectBase>(_fn: (cols: ColumnsRef<Cols>) => NewCols): ITableQuery<ColsFromSelect<NewCols>> {
      throw new Error('Not implemented');
    }

    function join<RTable extends ITableQuery<any>, NewCols extends ColsBase>(
      _table: RTable,
      _expr: (lCols: ColumnsRef<Cols>, rCols: ColumnsRef<RTable[TYPES]>) => IExpr<any>,
      _select: (lCols: ColumnsRef<Cols>, rCols: ColumnsRef<RTable[TYPES]>) => NewCols
    ): ITableQuery<NewCols> {
      throw new Error('Not implemented');
    }

    function groupBy(_group: (cols: ColumnsRef<Cols>) => IExpr<any> | Array<IExpr<any>>): ITableQuery<Cols> {
      throw new Error('Not implemented');
    }

    function all(): IQueryOperation<Array<QueryResult<Cols>>> {
      throw new Error('Not implemented');
    }

    function one(): IQueryOperation<QueryResult<Cols>> {
      throw new Error('Not implemented');
    }

    function maybeOne(): IQueryOperation<QueryResult<Cols> | null> {
      throw new Error('Not implemented');
    }

    function first(): IQueryOperation<QueryResult<Cols>> {
      throw new Error('Not implemented');
    }

    function maybeFirst(): IQueryOperation<QueryResult<Cols> | null> {
      throw new Error('Not implemented');
    }
  }
})();
