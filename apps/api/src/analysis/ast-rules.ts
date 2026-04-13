import { parse } from "@typescript-eslint/typescript-estree";
import type { ReviewIssue, ReviewSeverity } from "@ai-review/types";

type RuleFinding = {
  rule: string;
  severity: ReviewSeverity;
  line: number | null;
};

type Scope = Map<string, { line: number | null; references: number }>;

const IGNORED_IDENTIFIERS = new Set(["undefined", "console"]);

function isNode(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && "type" in (value as Record<string, unknown>);
}

function toIssue(finding: RuleFinding): ReviewIssue {
  return {
    issue: finding.rule,
    severity: finding.severity,
    suggestion: "Address this static-analysis finding before shipping.",
    line: finding.line,
    source: "ast"
  };
}

export function runAstRules(code: string, sourcePath?: string): ReviewIssue[] {
  const findings: RuleFinding[] = [];

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(code, {
      loc: true,
      comment: false,
      jsx: true,
      errorOnUnknownASTType: false
    });
  } catch {
    return [];
  }

  const isTestFile = Boolean(sourcePath && /\.(test|spec)\.[jt]sx?$/.test(sourcePath));

  const scopes: Scope[] = [new Map()];

  function currentScope(): Scope {
    return scopes[scopes.length - 1];
  }

  function declare(name: string, line: number | null): void {
    currentScope().set(name, { line, references: 0 });
  }

  function reference(name: string): void {
    if (IGNORED_IDENTIFIERS.has(name)) {
      return;
    }

    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      const record = scopes[index].get(name);
      if (record) {
        record.references += 1;
        return;
      }
    }
  }

  function closeScope(): void {
    const scope = scopes.pop();
    if (!scope) {
      return;
    }

    for (const [name, record] of scope.entries()) {
      if (record.references === 0 && !name.startsWith("_")) {
        findings.push({
          rule: `Unused variable: ${name}`,
          severity: "low",
          line: record.line
        });
      }
    }
  }

  function isDeclarationIdentifier(node: Record<string, unknown>, parent: Record<string, unknown> | null): boolean {
    if (!parent) {
      return false;
    }

    const parentType = parent.type;

    if (
      (parentType === "VariableDeclarator" && parent.id === node) ||
      (parentType === "FunctionDeclaration" && parent.id === node) ||
      (parentType === "FunctionExpression" && parent.id === node) ||
      (parentType === "ClassDeclaration" && parent.id === node)
    ) {
      return true;
    }

    if (
      (parentType === "FunctionDeclaration" || parentType === "FunctionExpression" || parentType === "ArrowFunctionExpression") &&
      Array.isArray(parent.params) &&
      parent.params.includes(node)
    ) {
      return true;
    }

    return false;
  }

  function walk(node: Record<string, unknown>, parent: Record<string, unknown> | null, nestedForDepth: number): void {
    const type = node.type;
    let childForDepth = nestedForDepth;

    if (type === "ForStatement") {
      if (nestedForDepth > 0) {
        findings.push({
          rule: "Nested loops detected",
          severity: "medium",
          line: typeof node.loc === "object" && node.loc ? ((node.loc as { start?: { line?: number } }).start?.line ?? null) : null
        });
      }

      childForDepth = nestedForDepth + 1;
    }

    if (type === "CallExpression") {
      const callee = node.callee;
      if (
        !isTestFile &&
        isNode(callee) &&
        callee.type === "MemberExpression" &&
        isNode(callee.object) &&
        callee.object.type === "Identifier" &&
        (callee.object as { name?: string }).name === "console" &&
        isNode(callee.property) &&
        callee.property.type === "Identifier" &&
        (callee.property as { name?: string }).name === "log"
      ) {
        findings.push({
          rule: "console.log call found in non-test file",
          severity: "low",
          line: typeof node.loc === "object" && node.loc ? ((node.loc as { start?: { line?: number } }).start?.line ?? null) : null
        });
      }
    }

    if (type === "FunctionDeclaration" || type === "FunctionExpression" || type === "ArrowFunctionExpression") {
      scopes.push(new Map());

      const functionNode = node as { body?: { loc?: { start: { line: number }; end: { line: number } } }; params?: Array<Record<string, unknown>> };

      for (const param of functionNode.params ?? []) {
        if (isNode(param) && param.type === "Identifier") {
          declare((param as { name: string }).name, (param.loc as { start?: { line?: number } } | undefined)?.start?.line ?? null);
        }
      }

      const startLine = functionNode.body?.loc?.start.line;
      const endLine = functionNode.body?.loc?.end.line;
      if (typeof startLine === "number" && typeof endLine === "number" && endLine - startLine + 1 > 100) {
        findings.push({
          rule: "Function exceeds 100 lines",
          severity: "medium",
          line: startLine
        });
      }
    }

    if (type === "VariableDeclarator") {
      const declarator = node as { id?: Record<string, unknown> };
      if (isNode(declarator.id) && declarator.id.type === "Identifier") {
        declare((declarator.id as { name: string }).name, (declarator.id.loc as { start?: { line?: number } } | undefined)?.start?.line ?? null);
      }
    }

    if (type === "Identifier" && !isDeclarationIdentifier(node, parent)) {
      const identifier = node as { name: string };
      reference(identifier.name);
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isNode(item)) {
            walk(item, node, childForDepth);
          }
        }
      } else if (isNode(value)) {
        walk(value, node, childForDepth);
      }
    }

    if (type === "FunctionDeclaration" || type === "FunctionExpression" || type === "ArrowFunctionExpression") {
      closeScope();
    }
  }

  walk(ast as unknown as Record<string, unknown>, null, 0);
  while (scopes.length > 0) {
    closeScope();
  }

  return findings.map(toIssue);
}
