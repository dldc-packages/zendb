import { expect } from "@std/expect";
import { Expr } from "../mod.ts";

Deno.test("Expr", () => {
  const expr = Expr.equal(Expr.literal(1), Expr.literal(2));

  expect(expr).toMatchObject({});
});
