import { parse } from "@babel/parser";
import { default as traverseModule, NodePath } from "@babel/traverse";
import { default as generateModule } from "@babel/generator";
import * as t from "@babel/types";

import { scanFile } from "./scanner";
import { wrapFunctionBody, wrapClassRenderMethod } from "./wrapper";

const traverse = (traverseModule as any).default || traverseModule;
const generate = (generateModule as any).default || generateModule;

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

  ast.program.body.unshift(...importsToInject);

  // 3. Aşama: Sihirli AST Dönüşümü (Sarmalama)
  traverse(ast, {
    ArrowFunctionExpression(pathNode: NodePath<t.ArrowFunctionExpression>) {
      const parent = pathNode.parentPath.node;
      if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id) && componentsToWrap.has(parent.id.name)) {
        const name = parent.id.name;
        const info = componentsToWrap.get(name)!;
        const line = pathNode.node.loc?.start.line ?? 1;
        wrapFunctionBody(pathNode, name, `${id}:${line}`, info.mdIdentifier);
      }
    },
    FunctionExpression(pathNode: NodePath<t.FunctionExpression>) {
      const parent = pathNode.parentPath.node;
      if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id) && componentsToWrap.has(parent.id.name)) {
        const name = parent.id.name;
        const info = componentsToWrap.get(name)!;
        const line = pathNode.node.loc?.start.line ?? 1;
        wrapFunctionBody(pathNode, name, `${id}:${line}`, info.mdIdentifier);
      }
    },
    FunctionDeclaration(pathNode: NodePath<t.FunctionDeclaration>) {
      const idNode = pathNode.node.id;
      if (idNode && componentsToWrap.has(idNode.name)) {
        const info = componentsToWrap.get(idNode.name)!;
        const line = pathNode.node.loc?.start.line ?? 1;
        wrapFunctionBody(pathNode, idNode.name, `${id}:${line}`, info.mdIdentifier);
      }
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