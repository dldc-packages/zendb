import { join, mapMaybe, PRIV } from '../Utils';
import { Expr } from './Expr';
import { Table } from './Table';

type DeleteStmtInternal = Readonly<{
  from: Table;
  where: Expr | null;
}>;

type DeleteStmtOptions = {
  from: Table;
  where?: Expr | null;
};

export class DeleteStmt {
  static create({ from, where = null }: DeleteStmtOptions): DeleteStmt {
    return new DeleteStmt({ from, where });
  }

  static print(node: DeleteStmt): string {
    const { from, where } = node[PRIV];
    return join.space(
      'DELETE FROM',
      Table.printFrom(from),
      mapMaybe(where, (w) => `WHERE ${Expr.print(w)}`)
    );
  }

  readonly [PRIV]: DeleteStmtInternal;

  private constructor(internale: DeleteStmtInternal) {
    this[PRIV] = internale;
  }

  public where(where: Expr | null): DeleteStmt {
    return new DeleteStmt({
      ...this[PRIV],
      where,
    });
  }
}
