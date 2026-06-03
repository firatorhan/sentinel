import fs from "node:fs";
import path from "node:path";

import { createUnplugin } from "unplugin";
import { createFilter } from "@rollup/pluginutils";

import { parse } from "@babel/parser";
import { default as traverseModule, NodePath } from "@babel/traverse";
import { default as generateModule } from "@babel/generator";
import * as t from "@babel/types";

const traverse = (traverseModule as any).default || traverseModule;
const generate = (generateModule as any).default || generateModule;

export interface SentinelPluginOptions {
  include?: string | string[];
  exclude?: string | string[];
}

// unplugin tanımını yapıyoruz
export const sentinelUnplugin = createUnplugin<SentinelPluginOptions>((options = {}, meta) => {
  const filter = createFilter(
    options.include ?? ["**/*.tsx"],
    options.exclude ?? [],
  );

  return {
    name: "sentinel-plugin",
    // Çoğu build aracında transform aşamasında çalışması için 'enforce' belirtebiliriz
    enforce: "pre",

    transformInclude(id) {
      if (id.includes("node_modules")) return false;
      if (!id.endsWith(".tsx")) return false;
      return filter(id);
    },

    transform(code, id) {
      // @sentinel-ignore etiketi varsa, bu dosyayı tamamen atla
      if (code.includes("@sentinel-ignore")) return null;

      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
      });

      const componentsToWrap = new Map<string, { mdIdentifier: string | null }>();

      // 1. Aşama: Bileşenleri tespit et ve MD dosyası var mı kontrol et
      traverse(ast, {
        VariableDeclarator(pathNode: NodePath<t.VariableDeclarator>) {
          const idNode = pathNode.node.id;
          if (t.isIdentifier(idNode) && /^[A-Z]/.test(idNode.name)) {
            const init = pathNode.node.init;
            if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
              const componentName = idNode.name;
              const mdPath = path.join(path.dirname(id), `${componentName}.md`);
              const mdExists = fs.existsSync(mdPath);
              
              // Eğer webpack veya vite/rollup altındaysak, MD dosyalarını izleme listesine ekle
              if (mdExists && typeof this?.addWatchFile === "function") {
                this.addWatchFile(mdPath);
              }

              const mdIdentifier = mdExists ? `${componentName}Md` : null;
              componentsToWrap.set(componentName, { mdIdentifier });
            }
          }
        },
        FunctionDeclaration(pathNode: NodePath<t.FunctionDeclaration>) {
          const idNode = pathNode.node.id;
          if (idNode && /^[A-Z]/.test(idNode.name)) {
            const componentName = idNode.name;
            const mdPath = path.join(path.dirname(id), `${componentName}.md`);
            const mdExists = fs.existsSync(mdPath);

            if (mdExists && typeof this?.addWatchFile === "function") {
              this.addWatchFile(mdPath);
            }

            const mdIdentifier = mdExists ? `${componentName}Md` : null;
            componentsToWrap.set(componentName, { mdIdentifier });
          }
        },
      });

      if (componentsToWrap.size === 0) return null;

      // 2. Aşama: Gerekli Global Importları Hazırla
      const importsToInject: t.ImportDeclaration[] = [];
      let sentinelImported = false;
      let reactImportedAsGlobal = false;

      traverse(ast, {
        ImportDeclaration(pathNode: NodePath<t.ImportDeclaration>) {
          if (pathNode.node.source.value === "@sentinel-core/sentinel") {
            sentinelImported = true;
          }
          
          if (pathNode.node.source.value === "react") {
            // Sadece 'react'tan import yapılması yetmez, 'React' adında bir namespace veya default import var mı bakıyoruz
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

      if (!sentinelImported) {
        importsToInject.push(
          t.importDeclaration(
            [t.importSpecifier(t.identifier("Sentinel"), t.identifier("Sentinel"))],
            t.stringLiteral("@sentinel-core/sentinel"),
          ),
        );
      }
      
      // Eğer 'React' objesi dosya başında global olarak import edilmediyse enjekte et
      if (!reactImportedAsGlobal) {
        importsToInject.push(
          t.importDeclaration(
            [t.importNamespaceSpecifier(t.identifier("React"))],
            t.stringLiteral("react"),
          ),
        );
      }

      // Bulunan MD dosyalarının import tanımlarını ekle
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

      // 3. Aşama: SİHİRLİ AST DÖNÜŞÜMÜ
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
    },
  };
});

// Build araçları için özelleştirilmiş export'ları dışarı açıyoruz
export const sentinelVitePlugin = sentinelUnplugin.vite;
export const sentinelWebpackPlugin = sentinelUnplugin.webpack;
export const sentinelRollupPlugin = sentinelUnplugin.rollup;
export const sentinelEsbuildPlugin = sentinelUnplugin.esbuild;

/**
 * AST sarmalama mantığı
 */
function wrapFunctionBody(pathNode: NodePath<any>, mdIdentifier: string | null) {
  const node = pathNode.node;
  const mdValue = mdIdentifier ? t.identifier(mdIdentifier) : t.identifier("undefined");
  const uniquePropsIdent = pathNode.scope.generateUidIdentifier("sentinel_props");
  const originalParams = [...node.params];
  node.params = [uniquePropsIdent];

  if (t.isBlockStatement(node.body)) {
    const originalInnerFunction = t.arrowFunctionExpression(originalParams, node.body);
    const callOriginal = t.callExpression(originalInnerFunction, [uniquePropsIdent]);
    const sentinelElement = t.callExpression(
      t.memberExpression(t.identifier("React"), t.identifier("createElement")),
      [
        t.identifier("Sentinel"),
        t.objectExpression([
          t.objectProperty(t.identifier("dialogMd"), mdValue),
          t.objectProperty(t.identifier("componentProps"), uniquePropsIdent),
        ]),
        callOriginal,
      ],
    );
    node.body = t.blockStatement([t.returnStatement(sentinelElement)]);
  } else {
    const originalExpression = node.body;
    const originalInnerFunction = t.arrowFunctionExpression(originalParams, originalExpression);
    const callOriginal = t.callExpression(originalInnerFunction, [uniquePropsIdent]);
    const sentinelElement = t.callExpression(
      t.memberExpression(t.identifier("React"), t.identifier("createElement")),
      [
        t.identifier("Sentinel"),
        t.objectExpression([
          t.objectProperty(t.identifier("dialogMd"), mdValue),
          t.objectProperty(t.identifier("componentProps"), uniquePropsIdent),
        ]),
        callOriginal,
      ],
    );
    node.body = sentinelElement;
  }
}