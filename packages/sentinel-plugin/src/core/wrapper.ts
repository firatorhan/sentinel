import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export function wrapClassRenderMethod(pathNode: NodePath<t.ClassDeclaration>, mdIdentifier: string | null) {
  const renderMethod = pathNode.node.body.body.find(
    (member): member is t.ClassMethod =>
      t.isClassMethod(member) &&
      t.isIdentifier(member.key) &&
      member.key.name === "render",
  );
  if (!renderMethod) return;

  const mdValue = mdIdentifier ? t.identifier(mdIdentifier) : t.identifier("undefined");
  const thisProps = t.memberExpression(t.thisExpression(), t.identifier("props"));

  const iife = t.callExpression(t.arrowFunctionExpression([], renderMethod.body), []);

  const sentinelElement = t.callExpression(
    t.memberExpression(t.identifier("React"), t.identifier("createElement")),
    [
      t.identifier("Sentinel"),
      t.objectExpression([
        t.objectProperty(t.identifier("dialogMd"), mdValue),
        t.objectProperty(t.identifier("componentProps"), thisProps),
      ]),
      iife,
    ],
  );

  renderMethod.body = t.blockStatement([t.returnStatement(sentinelElement)]);
}

export function wrapFunctionBody(pathNode: NodePath<any>, mdIdentifier: string | null) {
  const node = pathNode.node;
  const mdValue = mdIdentifier ? t.identifier(mdIdentifier) : t.identifier("undefined");
  const uniquePropsIdent = pathNode.scope.generateUidIdentifier("sentinel_props");
  const originalParams = [...node.params];
  node.params = [uniquePropsIdent];

  // İç fonksiyonu (orijinal render mantığı) oluşturup props'u paslıyoruz
  const originalInnerFunction = t.arrowFunctionExpression(originalParams, node.body, node.async);
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

  if (t.isBlockStatement(node.body)) {
    node.body = t.blockStatement([t.returnStatement(sentinelElement)]);
  } else {
    node.body = sentinelElement;
  }
}