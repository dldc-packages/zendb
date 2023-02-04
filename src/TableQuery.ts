import { Ast, builder, printNode, Utils } from 'zensqlite';
import { Expr, IExpr } from './Expr';
import { IQueryOperation } from './Operation';
import { Random } from './Random';
import { PRIV, TYPES } from './utils/constants';
import { extractParams } from './utils/params';
import { ColsBase, ColsFromSelect, ColumnsRef, FilterEqual, QueryResult, SelectBase } from './utils/types';
import { mapObject } from './utils/utils';

export interface ITableQueryInternalParent {
  name: string;
  cte: Ast.Node<'CommonTableExpression'>;
  parents: Array<ITableQueryInternalParent>;
}

export interface ITableQueryInternal<Cols extends ColsBase> {
  readonly columnsRef: ColumnsRef<Cols>;
  readonly from: Ast.Identifier; // table or cte name
  readonly parents: Array<ITableQueryInternalParent>;

  readonly columns?: Array<Ast.Node<'ResultColumn'>>;
  readonly join?: Ast.Node<'JoinClause'>;
  readonly where?: Ast.Expr;
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

  function createFromTable<Cols extends ColsBase>(table: Ast.Identifier, columns: ColumnsRef<Cols>): ITableQuery<Cols> {
    return create({
      parents: [],
      from: table,
      columnsRef: columns,
    });
  }

  function create<Cols extends ColsBase>(internal: Omit<ITableQueryInternal<any>, 'cteName'>): ITableQuery<any> {
    const cteFrom = builder.Expr.identifier(`cte_${Random.createId()}`);

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

    function select<NewCols extends SelectBase>(fn: (cols: ColumnsRef<Cols>) => NewCols): ITableQuery<ColsFromSelect<NewCols>> {
      if (internal.columns) {
        // already have a select, create a cte
        return asCte().select(fn);
      }
      const table = internal.from;
      const columns: Array<Ast.Node<'ResultColumn'>> = [];
      const columnsRef: ColumnsRef<any> = {};
      Object.entries(fn(internal.columnsRef)).forEach(([key, expr]) => {
        columns.push(builder.ResultColumn.Expr(expr, key));
        columnsRef[key] = Expr.column(table, key);
      });
      return create({
        ...internal,
        columns,
        columnsRef,
      });
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
      const node = buildFinalNode(internal);
      const params = extractParams(node);
      const sql = printNode(node);
      return {
        kind: 'Query',
        sql,
        params,
        parse: (rows) => {
          console.log('rows', rows);
          throw new Error('Not implemented');
        },
      };
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

    function asCte(): ITableQuery<Cols> {
      const columnsRef = mapObject(internal.columnsRef, (key) => Expr.column(cteFrom, key));
      return create({
        from: cteFrom,
        parents: [
          {
            name: cteFrom.name,
            cte: {
              kind: 'CommonTableExpression',
              tableName: cteFrom,
              select: { kind: 'SelectStmt', select: buildSelectCodeNode(internal) },
            },
            parents: internal.parents,
          },
        ],
        columnsRef,
      });
    }
  }

  function buildFinalNode(internal: ITableQueryInternal<any>): Ast.Node<'SelectStmt'> {
    const ctes = extractCtes(internal.parents);
    const selectCore = buildSelectCodeNode(internal);
    return {
      kind: 'SelectStmt',
      with: ctes.length === 0 ? undefined : { commonTableExpressions: Utils.arrayToNonEmptyArray(ctes) },
      select: selectCore,
    };
  }

  function extractCtes(parents: Array<ITableQueryInternalParent>): Array<Ast.Node<'CommonTableExpression'>> {
    const alreadyIncluded = new Set<string>();
    const ctes: Array<Ast.Node<'CommonTableExpression'>> = [];
    traverse(parents);
    return ctes;

    function traverse(parents: Array<ITableQueryInternalParent>) {
      for (const parent of parents) {
        traverse(parent.parents);
        if (alreadyIncluded.has(parent.name)) {
          continue;
        }
        alreadyIncluded.add(parent.name);
        ctes.push(parent.cte);
      }
    }
  }

  function buildSelectCodeNode(internal: ITableQueryInternal<any>): Ast.Node<'SelectCore'> {
    return {
      kind: 'SelectCore',
      variant: 'Select',
      from: { variant: 'TablesOrSubqueries', tablesOrSubqueries: [{ variant: 'Table', kind: 'TableOrSubquery', table: internal.from }] },
      resultColumns: internal.columns ? Utils.arrayToNonEmptyArray(internal.columns) : [builder.ResultColumn.Star()],
    };
  }
})();
