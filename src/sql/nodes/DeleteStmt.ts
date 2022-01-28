import { PRIV } from '../../Utils';
import { Expr } from './index';
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
