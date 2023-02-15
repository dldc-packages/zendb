import { Expr } from '../src/mod';

test('Expr', () => {
  const expr = Expr.equal(Expr.literal(1), Expr.literal(2));

  expect(expr).toMatchObject({});
});
