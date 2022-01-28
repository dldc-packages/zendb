import { PRIV } from '../../Utils';
import { Column } from './Column';
import { Expr } from './index';
import { Table } from './Table';

type InsertStmtInternal = Readonly<{
  into: Table;
  columns: Array<Column> | null;
  values: Array<Array<Expr>>;
}>;

type InsertStmtOptions = {
  into: Table;
  columns?: Array<Column> | null;
  values: Array<Array<Expr>>;
};

export class InsertStmt {
  static create({ into, columns = null, values }: InsertStmtOptions): InsertStmt {
    return new InsertStmt({ into, columns, values });
  }

  readonly [PRIV]: InsertStmtInternal;

  private constructor(internale: InsertStmtInternal) {
    this[PRIV] = internale;
  }

  public columns(...columns: Array<Column>): InsertStmt {
    if (this[PRIV].columns !== null) {
      throw new Error('Columns already set');
    }
    return new InsertStmt({
      ...this[PRIV],
      columns,
    });
  }
}
