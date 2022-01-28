import { PRIV } from '../../Utils';
import { Column } from './Column';
import { Expr } from './index';
import { Table } from './Table';

type UpdateStmtInternal = Readonly<{
  table: Table;
  set: ReadonlyArray<readonly [Column, Expr]>;
  where: Expr | null;
}>;

type UpdateStmtOptions = {
  table: Table;
  set?: ReadonlyArray<readonly [Column, Expr]>;
  where?: Expr | null;
};

export class UpdateStmt {
  static create({ table, set = [], where = null }: UpdateStmtOptions): UpdateStmt {
    return new UpdateStmt({ table, set, where });
  }

  readonly [PRIV]: UpdateStmtInternal;

  private constructor(internale: UpdateStmtInternal) {
    this[PRIV] = internale;
  }

  public set(col: Column, value: Expr): UpdateStmt {
    return new UpdateStmt({
      ...this[PRIV],
      set: [...this[PRIV].set, [col, value]],
    });
  }

  public where(where: Expr | null): UpdateStmt {
    return new UpdateStmt({
      ...this[PRIV],
      where,
    });
  }
}
