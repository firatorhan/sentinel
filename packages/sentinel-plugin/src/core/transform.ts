import { parse } from "@babel/parser";
import { default as traverseModule, NodePath } from "@babel/traverse";
import { default as generateModule } from "@babel/generator";
import * as t from "@babel/types";

import { scanFile, isKnownHocCall } from "./scanner";
import { wrapFunctionBody, wrapClassRenderMethod } from "./wrapper";

const traverse = (traverseModule as any).default || traverseModule;
const generate = (generateModule as any).default || generateModule;

// Replaced by tsup `define` at build time with the package version
declare const __SENTINEL_PLUGIN_VERSION__: string;
const PLUGIN_VERSION =
  typeof __SENTINEL_PLUGIN_VERSION__ !== "undefined" ? __SENTINEL_PLUGIN_VERSION__ : "0.0.0";

// globalThis.__SENTINEL_PLUGIN_VERSION__ = "<version>" — lets the sentinel
// toolbar display which plugin version transformed the app
const buildVersionStatement = (): t.ExpressionStatement =>
  t.expressionStatement(
    t.logicalExpression(
      "&&",
      t.binaryExpression(
        "!==",
        t.unaryExpression("typeof", t.identifier("globalThis")),
        t.stringLiteral("undefined"),
      ),
      t.assignmentExpression(
        "=",
        t.memberExpression(t.identifier("globalThis"), t.identifier("__SENTINEL_PLUGIN_VERSION__")),
        t.stringLiteral(PLUGIN_VERSION),
      ),
    ),
  );

export function transformCode(code: string, id: string, isInInclude: boolean, addWatchFile?: (path: string) => void) {
  const firstNonEmptyLine = code.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  if (firstNonEmptyLine === "// @sentinel-ignore") return null;

  const isTS = id.endsWith(".ts") || id.endsWith(".tsx");
  const babelPlugins: ("jsx" | "typescript")[] = ["jsx"];
  if (isTS) babelPlugins.push("typescript");

  const ast = parse(code, {
    sourceType: "module",
    plugins: babelPlugins,
  });

  const { componentsToWrap, sentinelComponentImported, reactImportedAsGlobal } = scanFile(ast, id, code, isInInclude, addWatchFile);

  if (componentsToWrap.size === 0) return null;

  // Global Import'ların Hazırlanması ve Enjekte Edilmesi
  const importsToInject: t.ImportDeclaration[] = [];

  if (!sentinelComponentImported) {
    importsToInject.push(
      t.importDeclaration(
        [t.importSpecifier(t.identifier("Sentinel"), t.identifier("Sentinel"))],
        t.stringLiteral("@sentinel-core/sentinel"),
      ),
    );
  }

  if (!reactImportedAsGlobal) {
    importsToInject.push(
      t.importDeclaration(
        [t.importNamespaceSpecifier(t.identifier("React"))],
        t.stringLiteral("react"),
      ),
    );
  }

  for (const [componentName, info] of componentsToWrap.entries()) {
    if (info.mdIdentifier) {
      importsToInject.push(
        t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier(info.mdIdentifier))],
          t.stringLiteral(`./${componentName}.md?raw`),
        ),
      );
    }
  }

  ast.program.body.unshift(...importsToInject, buildVersionStatement());

  const wrapNamed = (pathNode: NodePath<any>, name: string) => {
    const info = componentsToWrap.get(name)!;
    const line = pathNode.node.loc?.start.line ?? 1;
    wrapFunctionBody(pathNode, name, `${id}:${line}`, info.mdIdentifier);
  };

  // Handles both `const Foo = () => …` and `const Foo = memo/forwardRef(() => …)`
  const visitComponentFunction = (
    pathNode: NodePath<t.ArrowFunctionExpression | t.FunctionExpression>,
  ) => {
    const parent = pathNode.parentPath.node;
    if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id) && componentsToWrap.has(parent.id.name)) {
      wrapNamed(pathNode, parent.id.name);
    } else if (
      t.isCallExpression(parent) &&
      isKnownHocCall(parent.callee) &&
      parent.arguments[0] === pathNode.node
    ) {
      const grandParent = pathNode.parentPath.parentPath?.node;
      if (t.isVariableDeclarator(grandParent) && t.isIdentifier(grandParent.id) && componentsToWrap.has(grandParent.id.name)) {
        wrapNamed(pathNode, grandParent.id.name);
      }
    }
  };

  // 3. Aşama: Sihirli AST Dönüşümü (Sarmalama)
  traverse(ast, {
    ArrowFunctionExpression: visitComponentFunction,
    FunctionExpression: visitComponentFunction,
    FunctionDeclaration(pathNode: NodePath<t.FunctionDeclaration>) {
      const idNode = pathNode.node.id;
      if (idNode && componentsToWrap.has(idNode.name)) wrapNamed(pathNode, idNode.name);
    },
    ClassDeclaration(pathNode: NodePath<t.ClassDeclaration>) {
      const idNode = pathNode.node.id;
      if (idNode && componentsToWrap.has(idNode.name)) {
        const info = componentsToWrap.get(idNode.name)!;
        const line = pathNode.node.loc?.start.line ?? 1;
        wrapClassRenderMethod(pathNode, idNode.name, `${id}:${line}`, info.mdIdentifier);
      }
    },
  });

  const output = generate(ast, { retainLines: true });

  return {
    code: output.code,
    map: null,
  };
}