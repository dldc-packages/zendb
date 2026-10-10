import { expect, test } from "vite-plus/test";
import { Expr } from "../mod.ts";
import { printNode } from "@dldc/sqlite";

test("Expr", () => {
  const expr = Expr.equal(Expr.literal(1), Expr.literal(2));

  expect(expr).toMatchObject({});
});

test("Expr.Functions.random()", () => {
  const expr = Expr.Functions.random();

  expect(printNode(expr.ast)).toEqual(`random()`);
});
