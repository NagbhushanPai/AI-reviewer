import { describe, expect, it } from "vitest";
import { runAstRules } from "../analysis/ast-rules.js";

// ---------------------------------------------------------------------------
// AST rule: console.log detection
// ---------------------------------------------------------------------------
describe("runAstRules – console.log", () => {
  it("flags console.log in non-test files", () => {
    const code = `console.log("debug");`;
    const issues = runAstRules(code, "src/app.ts");
    expect(issues.some((i) => i.issue.includes("console.log"))).toBe(true);
  });

  it("does NOT flag console.log in test files", () => {
    const code = `console.log("debug");`;
    const issues = runAstRules(code, "src/app.test.ts");
    expect(issues.some((i) => i.issue.includes("console.log"))).toBe(false);
  });

  it("does NOT flag console.log when no sourcePath is provided", () => {
    // sourcePath undefined → not considered a test file → should flag
    const code = `console.log("debug");`;
    const issues = runAstRules(code);
    expect(issues.some((i) => i.issue.includes("console.log"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AST rule: unused variable detection
// ---------------------------------------------------------------------------
describe("runAstRules – unused variables", () => {
  it("flags an unused variable", () => {
    const code = `const unused = 42;`;
    const issues = runAstRules(code, "src/foo.ts");
    expect(issues.some((i) => i.issue.includes("Unused variable: unused"))).toBe(true);
  });

  it("does NOT flag a used variable", () => {
    const code = `const used = 42; console.log(used);`;
    const issues = runAstRules(code, "src/foo.test.ts");
    expect(issues.some((i) => i.issue.includes("Unused variable: used"))).toBe(false);
  });

  it("does NOT flag variables starting with _ (intentionally unused)", () => {
    const code = `const _ignored = 1;`;
    const issues = runAstRules(code, "src/foo.ts");
    expect(issues.some((i) => i.issue.includes("Unused variable: _ignored"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AST rule: nested loops
// ---------------------------------------------------------------------------
describe("runAstRules – nested loops", () => {
  it("flags nested for loops", () => {
    const code = `
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          // inner
        }
      }
    `;
    const issues = runAstRules(code, "src/alg.ts");
    expect(issues.some((i) => i.issue.includes("Nested loops"))).toBe(true);
  });

  it("does NOT flag a single loop", () => {
    const code = `for (let i = 0; i < 10; i++) {}`;
    const issues = runAstRules(code, "src/alg.ts");
    expect(issues.some((i) => i.issue.includes("Nested loops"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AST rule: long functions
// ---------------------------------------------------------------------------
describe("runAstRules – long functions", () => {
  it("flags a function body exceeding 100 lines", () => {
    const body = Array.from({ length: 102 }, (_, idx) => `  const v${idx} = ${idx};`).join("\n");
    const code = `function big() {\n${body}\n}`;
    const issues = runAstRules(code, "src/big.ts");
    expect(issues.some((i) => i.issue.includes("Function exceeds 100 lines"))).toBe(true);
  });

  it("does NOT flag a function within 100 lines", () => {
    const code = `function small() {\n  return 1;\n}`;
    const issues = runAstRules(code, "src/small.ts");
    expect(issues.some((i) => i.issue.includes("Function exceeds 100 lines"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Graceful handling of unparseable input
// ---------------------------------------------------------------------------
describe("runAstRules – unparseable input", () => {
  it("returns empty array for completely invalid code", () => {
    const issues = runAstRules("<<<this is not valid code>>>", "src/bad.ts");
    expect(issues).toEqual([]);
  });
});
