import { join, mapMaybe, PRIV, sqlQuote } from '../Utils';
import { Column } from './Column';

type AggregateFnName = 'Count' | 'Sum' | 'Min' | 'Max';

type AggregateInternal = Readonly<{
  distinct: boolean;
  fn: AggregateFnName;
  column: Column;
  alias: null | { original: Aggregate; alias: string };
}>;

export class Aggregate {
  static create(fn: AggregateFnName, column: Column): Aggregate {
    return new Aggregate({ fn, column, distinct: false, alias: null });
  }

  static count(column: Column): Aggregate {
    return Aggregate.create('Count', column);
  }

  static sum(column: Column): Aggregate {
    return Aggregate.create('Sum', column);
  }

  static min(column: Column): Aggregate {
    return Aggregate.create('Min', column);
  }

  static max(column: Column): Aggregate {
    return Aggregate.create('Max', column);
  }

  static printSelect(node: Aggregate): string {
    const { alias, column, fn, distinct } = node[PRIV];
    const fnName = { Count: 'COUNT', Sum: 'SUM', Min: 'MIN', Max: 'MAX' }[fn];
    return join.all(
      fnName,
      '(',
      join.space(distinct ? 'DISTINCT' : null, Column.printRef(column)),
      ')',
      mapMaybe(alias, ({ alias }) => ` AS ${sqlQuote(alias)}`)
    );
  }

  static printRef(node: Aggregate): string {
    const { alias, column, fn } = node[PRIV];
    const fnName = { Count: 'COUNT', Sum: 'SUM', Min: 'MIN', Max: 'MAX' }[fn];
    return alias ? sqlQuote(alias.alias) : `${fnName}(${Column.printRef(column)})`;
  }

  readonly [PRIV]: AggregateInternal;

  private constructor(internal: AggregateInternal) {
    this[PRIV] = internal;
  }

  public as(alias: string) {
    if (this[PRIV].alias) {
      throw new Error('Column already aliased');
    }
    return new Aggregate({
      ...this[PRIV],
      alias: { original: this, alias },
    });
  }

  public distinct() {
    return new Aggregate({
      ...this[PRIV],
      distinct: true,
    });
  }
}
