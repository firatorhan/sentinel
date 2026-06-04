import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export function wrapFunctionBody(pathNode: NodePath<any>, mdIdentifier: string | null) {
  const node = pathNode.node;
  const mdValue = mdIdentifier ? t.identifier(mdIdentifier) : t.identifier("undefined");
  const uniquePropsIdent = pathNode.scope.generateUidIdentifier("sentinel_props");
  const originalParams = [...node.params];
  node.params = [uniquePropsIdent];

  // İç fonksiyonu (orijinal render mantığı) oluşturup props'u paslıyoruz
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

  if (t.isBlockStatement(node.body)) {
    node.body = t.blockStatement([t.returnStatement(sentinelElement)]);
  } else {
    node.body = sentinelElement;
  }
}