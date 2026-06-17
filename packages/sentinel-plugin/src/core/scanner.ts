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

export function scanFile(ast: t.File, id: string, addWatchFile?: (path: string) => void): ScanResult {
  const componentsToWrap = new Map<string, ComponentInfo>();
  let sentinelComponentImported = false;
  let reactImportedAsGlobal = false;

  const checkAndRegisterComponent = (componentName: string) => {
    const mdPath = path.join(path.dirname(id), `${componentName}.md`);
    const mdExists = fs.existsSync(mdPath);

    if (mdExists && typeof addWatchFile === "function") {
      addWatchFile(mdPath);
    }

    const mdIdentifier = mdExists ? `${componentName}Md` : null;
    componentsToWrap.set(componentName, { mdIdentifier });
  };

  traverse(ast, {
    // 1. Bileşen Tespiti
    VariableDeclarator(pathNode: NodePath<t.VariableDeclarator>) {
      const idNode = pathNode.node.id;
      if (t.isIdentifier(idNode) && /^[A-Z]/.test(idNode.name)) {
        const init = pathNode.node.init;
        if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
          checkAndRegisterComponent(idNode.name);
        }
      }
    },
    FunctionDeclaration(pathNode: NodePath<t.FunctionDeclaration>) {
      const idNode = pathNode.node.id;
      if (idNode && /^[A-Z]/.test(idNode.name)) {
        checkAndRegisterComponent(idNode.name);
      }
    },

    // 2. Import Durum Kontrolleri
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
        const hasReactIdentifier = pathNode.node.specifiers.some(specifier => {
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