import { parse } from "@babel/parser";
import { default as traverseModule, NodePath } from "@babel/traverse";
import { default as generateModule } from "@babel/generator";
import * as t from "@babel/types";

import { scanFile } from "./scanner";
import { wrapFunctionBody } from "./wrapper";

const traverse = (traverseModule as any).default || traverseModule;
const generate = (generateModule as any).default || generateModule;

export function transformCode(code: string, id: string, addWatchFile?: (path: string) => void) {
  if (code.includes("@sentinel-ignore")) return null;

  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  // 1 & 2. Aşama: Dosyayı tara ve analiz et
  const { componentsToWrap, sentinelImported, reactImportedAsGlobal } = scanFile(ast, id, addWatchFile);

  if (componentsToWrap.size === 0) return null;

  // Global Import'ların Hazırlanması ve Enjekte Edilmesi
  const importsToInject: t.ImportDeclaration[] = [];

  if (!sentinelImported) {
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
        const info = componentsToWrap.get(parent.id.name)!;
        wrapFunctionBody(pathNode, info.mdIdentifier);
      }
    },
    FunctionExpression(pathNode: NodePath<t.FunctionExpression>) {
      const parent = pathNode.parentPath.node;
      if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id) && componentsToWrap.has(parent.id.name)) {
        const info = componentsToWrap.get(parent.id.name)!;
        wrapFunctionBody(pathNode, info.mdIdentifier);
      }
    },
    FunctionDeclaration(pathNode: NodePath<t.FunctionDeclaration>) {
      const idNode = pathNode.node.id;
      if (idNode && componentsToWrap.has(idNode.name)) {
        const info = componentsToWrap.get(idNode.name)!;
        wrapFunctionBody(pathNode, info.mdIdentifier);
      }
    },
  });

  const output = generate(ast, { retainLines: true });

  return {
    code: output.code,
    map: null,
  };
}