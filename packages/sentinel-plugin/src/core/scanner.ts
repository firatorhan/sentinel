import fs from "node:fs";
import path from "node:path";
import { default as traverseModule, NodePath } from "@babel/traverse";
import * as t from "@babel/types";

const traverse = (traverseModule as any).default || traverseModule;

export interface ComponentInfo {
  mdIdentifier: string | null;
}

export interface ScanResult {
  componentsToWrap: Map<string, ComponentInfo>;
  sentinelComponentImported: boolean;
  reactImportedAsGlobal: boolean;
}

const getLineAbove = (code: string, node: t.Node): string => {
  if (!node.loc) return "";
  const lines = code.split("\n");
  const idx = node.loc.start.line - 2;
  return idx >= 0 ? lines[idx].trim() : "";
};


export function scanFile(ast: t.File, id: string, code: string, isInInclude: boolean, addWatchFile?: (path: string) => void): ScanResult {
  const componentsToWrap = new Map<string, ComponentInfo>();
  let sentinelComponentImported = false;
  let reactImportedAsGlobal = false;

  const checkAndRegisterComponent = (componentName: string, declarationNode: t.Node) => {
    const lineAbove = getLineAbove(code, declarationNode);
    if (lineAbove === "// @sentinel-ignore") return;

    const hasSentinelWatch = lineAbove === "// @sentinel-watch";

    if (!hasSentinelWatch) {
      if (!isInInclude) return;
      if (!/^[A-Z]/.test(componentName)) return;
    }

    const mdPath = path.join(path.dirname(id), `${componentName}.md`);
    const mdExists = fs.existsSync(mdPath);

    if (mdExists && typeof addWatchFile === "function") {
      addWatchFile(mdPath);
    }

    const mdIdentifier = mdExists ? `${componentName}Md` : null;
    componentsToWrap.set(componentName, { mdIdentifier });
  };

  traverse(ast, {
    VariableDeclarator(pathNode: NodePath<t.VariableDeclarator>) {
      const idNode = pathNode.node.id;
      if (t.isIdentifier(idNode)) {
        const init = pathNode.node.init;
        if ((t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) && !init.async) {
          checkAndRegisterComponent(idNode.name, pathNode.parentPath.node);
        } else if (t.isCallExpression(init)) {
          const callee = init.callee;
          const isKnownHoc =
            (t.isIdentifier(callee) && (callee.name === 'memo' || callee.name === 'forwardRef')) ||
            (t.isMemberExpression(callee) && t.isIdentifier(callee.property) &&
              (callee.property.name === 'memo' || callee.property.name === 'forwardRef'));
          if (isKnownHoc) {
            const firstArg = init.arguments[0];
            if ((t.isArrowFunctionExpression(firstArg) || t.isFunctionExpression(firstArg)) && !firstArg.async) {
              checkAndRegisterComponent(idNode.name, pathNode.parentPath.node);
            }
          }
        }
      }
    },
    FunctionDeclaration(pathNode: NodePath<t.FunctionDeclaration>) {
      const idNode = pathNode.node.id;
      if (idNode && !pathNode.node.async) {
        checkAndRegisterComponent(idNode.name, pathNode.node);
      }
    },
    ClassDeclaration(pathNode: NodePath<t.ClassDeclaration>) {
      const idNode = pathNode.node.id;
      if (!idNode) return;
      const renderMethod = pathNode.node.body.body.find(
        (member): member is t.ClassMethod =>
          t.isClassMethod(member) &&
          t.isIdentifier(member.key) &&
          member.key.name === "render",
      );
      if (!renderMethod) return;
      checkAndRegisterComponent(idNode.name, pathNode.node);
    },

    ImportDeclaration(pathNode: NodePath<t.ImportDeclaration>) {
      if (pathNode.node.source.value === "@sentinel-core/sentinel") {
        const hasSentinelSpecifier = pathNode.node.specifiers.some(
          (s) =>
            t.isImportSpecifier(s) &&
            t.isIdentifier(s.imported) &&
            s.imported.name === "Sentinel",
        );
        if (hasSentinelSpecifier) sentinelComponentImported = true;
      }

      if (pathNode.node.source.value === "react") {
        const hasReactIdentifier = pathNode.node.specifiers.some((specifier) => {
          return (
            (t.isImportNamespaceSpecifier(specifier) && specifier.local.name === "React") ||
            (t.isImportDefaultSpecifier(specifier) && specifier.local.name === "React")
          );
        });
        if (hasReactIdentifier) {
          reactImportedAsGlobal = true;
        }
      }
    },
  });

  return { componentsToWrap, sentinelComponentImported, reactImportedAsGlobal };
}
