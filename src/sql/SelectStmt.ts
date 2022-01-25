import { PRIV } from '../Utils';
import { Table } from './Table';
import { JsonTable } from './JsonTable';
import { Expr } from './Expr';
import { Column } from './Column';
import { Aggregate } from './Aggregate';

export type SelectStmtFrom = Table | JsonTable | Array<Table | JsonTable>;
export type SelectStmtLimit = { limit: Expr; offset: Expr | null } | null;

type SelectStmtInternal = Readonly<{
  distinct: boolean;
  select: Array<Column | Aggregate>;
  from: Array<Table | JsonTable>;
  where: Expr | null;
  orderBy: Array<Expr> | null;
  limit: SelectStmtLimit;
  alias: null | { original: SelectStmt; alias: string };
}>;

export type SelectStmtOptions = {
  select: Array<Column | Aggregate>;
  from: SelectStmtFrom;
  where?: Expr | null;
  orderBy?: Array<Expr> | null;
  limit?: SelectStmtLimit;
  distinct?: boolean;
};

export class SelectStmt {
  static create({
    select,
    from,
    limit = null,
    orderBy = null,
    where = null,
    distinct = false,
  }: SelectStmtOptions): SelectStmt {
    return new SelectStmt({
      distinct,
      select,
      from: Array.isArray(from) ? from : [from],
      where,
      orderBy,
      limit,
      alias: null,
    });
  }

  readonly [PRIV]: SelectStmtInternal;

  private constructor(internal: SelectStmtInternal) {
    this[PRIV] = internal;
  }

  public where(where: Expr | null): SelectStmt {
    return new SelectStmt({
      ...this[PRIV],
      where,
    });
  }

  public limit(limit: Expr, offset: Expr | null = null): SelectStmt {
    return new SelectStmt({
      ...this[PRIV],
      limit: { limit, offset },
    });
  }

  public orderBy(orderBy: Array<Expr> | null): SelectStmt {
    return new SelectStmt({
      ...this[PRIV],
      orderBy,
    });
  }

  public as(alias: string): SelectStmt {
    if (this[PRIV].alias) {
      throw new Error('Cannot alias a SelectStmt more than once');
    }
    return new SelectStmt({
      ...this[PRIV],
      alias: { alias, original: this },
    });
  }
}
