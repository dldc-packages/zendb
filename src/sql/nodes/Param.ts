import { PRIV } from '../../Utils';

type ParamInternal =
  | Readonly<{
      kind: 'Anonymous';
    }>
  | Readonly<{
      kind: 'Named';
      name: string;
    }>;

export class Param {
  static createAnonymous(): Param {
    return new Param({ kind: 'Anonymous' });
  }

  static createNamed(name: string): Param {
    return new Param({ kind: 'Named', name });
  }

  readonly [PRIV]: ParamInternal;

  constructor(internal: ParamInternal) {
    this[PRIV] = internal;
  }
}
