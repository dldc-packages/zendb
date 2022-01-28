import { expectNever, PRIV } from '../Utils';

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

  static print(node: Param) {
    const internal = node[PRIV];
    if (internal.kind === 'Anonymous') {
      return `?`;
    }
    if (internal.kind === 'Named') {
      return `:${internal.name}`;
    }
    return expectNever(internal);
  }

  readonly [PRIV]: ParamInternal;

  constructor(internal: ParamInternal) {
    this[PRIV] = internal;
  }
}
