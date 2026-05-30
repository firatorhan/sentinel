import fs from "node:fs";
import path from "node:path";

import type { Plugin } from "vite";
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

export function sentinelPlugin(options: SentinelPluginOptions = {}): Plugin {
  const filter = createFilter(
    options.include ?? ["**/*.tsx"],
    options.exclude ?? [],
  );

  return {
    name: "sentinel-vite-plugin",

    transform(code, id) {
      if (id.includes("node_modules")) return null;
      if (!filter(id)) return null;
      if (!id.endsWith(".tsx")) return null;
      // @sentinel-ignore etiketi varsa, bu dosyayı tamamen atla
      if (code.includes("@sentinel-ignore")) return null;

      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
      });

      // Hangi bileşenlere ne tür bir MD import'u ekleyeceğimizi takip etmek için harita
      const componentsToWrap = new Map<
        string,
        { mdIdentifier: string | null }
      >();

      // 1. Aşama: Bileşenleri tespit et ve MD dosyası var mı kontrol et
      traverse(ast, {
        VariableDeclarator(pathNode: NodePath<t.VariableDeclarator>) {
          const idNode = pathNode.node.id;
          if (t.isIdentifier(idNode) && /^[A-Z]/.test(idNode.name)) {
            const init = pathNode.node.init;
            // Arrow function veya normal fonksiyon atamalarını yakala
            if (
              t.isArrowFunctionExpression(init) ||
              t.isFunctionExpression(init)
            ) {
              const componentName = idNode.name;

              const mdPath = path.join(path.dirname(id), `${componentName}.md`);
              const mdExists = fs.existsSync(mdPath);
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
            const mdIdentifier = mdExists ? `${componentName}Md` : null;

            componentsToWrap.set(componentName, { mdIdentifier });
          }
        },
      });

      if (componentsToWrap.size === 0) return null;

      // 2. Aşama: Gerekli Global Importları Hazırla
      const importsToInject: t.ImportDeclaration[] = [];
      let sentinelImported = false;
      let reactImported = false;

      traverse(ast, {
        ImportDeclaration(pathNode: NodePath<t.ImportDeclaration>) {
          if (pathNode.node.source.value === "sentinel")
            sentinelImported = true;
          if (pathNode.node.source.value === "react") reactImported = true;
        },
      });

      if (!sentinelImported) {
        importsToInject.push(
          t.importDeclaration(
            [
              t.importSpecifier(
                t.identifier("Sentinel"),
                t.identifier("Sentinel"),
              ),
            ],
            t.stringLiteral("sentinel"),
          ),
        );
      }
      if (!reactImported) {
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

      // 3. Aşama: SİHİRLİ AST DÖNÜŞÜMÜ (Bileşen Gövdesini Doğrudan Değiştirme)
      // Fonksiyonların return ifadesini doğrudan React.createElement(Sentinel, ...) ile sarmalıyoruz.
      traverse(ast, {
        ArrowFunctionExpression(pathNode: NodePath<t.ArrowFunctionExpression>) {
          const parent = pathNode.parentPath.node;
          if (
            t.isVariableDeclarator(parent) &&
            t.isIdentifier(parent.id) &&
            componentsToWrap.has(parent.id.name)
          ) {
            const info = componentsToWrap.get(parent.id.name)!;
            wrapFunctionBody(pathNode, info.mdIdentifier);
          }
        },
        FunctionExpression(pathNode: NodePath<t.FunctionExpression>) {
          const parent = pathNode.parentPath.node;
          if (
            t.isVariableDeclarator(parent) &&
            t.isIdentifier(parent.id) &&
            componentsToWrap.has(parent.id.name)
          ) {
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
}

/**
 * Bir fonksiyonun dönüş (return) mantığını AST düzeyinde Sentinel ile sarmalayan yardımcı fonksiyon
 */
function wrapFunctionBody(
  pathNode: NodePath<any>,
  mdIdentifier: string | null,
) {
  const node = pathNode.node;
  const mdValue = mdIdentifier
    ? t.identifier(mdIdentifier)
    : t.identifier("undefined");

  // 1. ADIM: Benzersiz bir ara props değişken ismi oluşturuyoruz
  const uniquePropsIdent =
    pathNode.scope.generateUidIdentifier("sentinel_props");

  // 2. ADIM: Fonksiyonun mevcut parametrelerini (örneğin { p }) saklıyoruz
  const originalParams = [...node.params];

  // 3. ADIM: Orijinal parametreleri fonksiyonun en başından kaldırıp,
  // yerine bizim tekil safe props tanımımızı koyuyoruz: (_sentinel_props)
  node.params = [uniquePropsIdent];

  if (t.isBlockStatement(node.body)) {
    // 4. ADIM: Orijinal fonksiyon mantığını çalıştıracak alt fonksiyon (kapsül)
    // Orijinal parametreleri ({ p }) bu iç fonksiyona devrediyoruz.
    const originalInnerFunction = t.arrowFunctionExpression(
      originalParams,
      node.body,
    );

    // İç fonksiyonu çağırırken bizim yakaladığımız props'u paslıyoruz
    const callOriginal = t.callExpression(originalInnerFunction, [
      uniquePropsIdent,
    ]);

    // <Sentinel componentProps={_sentinel_props}>...</Sentinel> yapısını kuruyoruz
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

    // Fonksiyon gövdesini tek bir sarmalanmış return ifadesiyle güncelliyoruz
    node.body = t.blockStatement([t.returnStatement(sentinelElement)]);
  } else {
    // Fonksiyon gövdesi süslü parantezsiz tek satırlık arrow ise: () => JSX
    const originalExpression = node.body;

    // Parametreleri destructuring ile açabilmek için anlık bir IIFE kuruyoruz
    const originalInnerFunction = t.arrowFunctionExpression(
      originalParams,
      originalExpression,
    );
    const callOriginal = t.callExpression(originalInnerFunction, [
      uniquePropsIdent,
    ]);

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
