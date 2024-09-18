import { expect } from "@std/expect";
import { Expr } from "../mod.ts";
import { printNode } from "@dldc/sqlite";

Deno.test("Expr", () => {
  const expr = Expr.equal(Expr.literal(1), Expr.literal(2));

  expect(expr).toMatchObject({});
});

Deno.test("Expr.Functions.random()", () => {
  const expr = Expr.Functions.random();

  expect(printNode(expr.ast)).toEqual(`random()`);
});
