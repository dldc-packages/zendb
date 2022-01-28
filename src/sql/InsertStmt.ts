import { join, mapMaybe, parent, PRIV } from '../Utils';
import { Column } from './Column';
import { Expr } from './Expr';
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

  static print(node: InsertStmt): string {
    const { into, columns, values } = node[PRIV];
    return join.space(
      'INSERT INTO',
      Table.printFrom(into),
      // printNode(into, 'full'),
      mapMaybe(columns, (c) => parent(join.comma(...c.map((c) => Column.printName(c))))),
      'VALUES',
      join.comma(...values.map((row) => parent(join.comma(...row.map((cell) => Expr.print(cell))))))
    );
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
