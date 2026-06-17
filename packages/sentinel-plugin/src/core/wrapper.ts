import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export function wrapClassRenderMethod(pathNode: NodePath<t.ClassDeclaration>, componentName: string, sourceFile: string, mdIdentifier: string | null) {
  const renderMethod = pathNode.node.body.body.find(
    (member): member is t.ClassMethod =>
      t.isClassMethod(member) &&
      t.isIdentifier(member.key) &&
      member.key.name === "render",
  );
  if (!renderMethod) return;

  const mdValue = mdIdentifier ? t.identifier(mdIdentifier) : t.identifier("undefined");
  const thisProps = t.memberExpression(t.thisExpression(), t.identifier("props"));

  // Class component'lerde hook kullanamayız, instance property kullanıyoruz
  // this._sentinel_rc = (this._sentinel_rc || 0) + 1;
  const incrementStatement = t.expressionStatement(
    t.assignmentExpression(
      "=",
      t.memberExpression(t.thisExpression(), t.identifier("_sentinel_rc")),
      t.binaryExpression(
        "+",
        t.logicalExpression(
          "||",
          t.memberExpression(t.thisExpression(), t.identifier("_sentinel_rc")),
          t.numericLiteral(0),
        ),
        t.numericLiteral(1),
      ),
    ),
  );

  const iife = t.callExpression(t.arrowFunctionExpression([], renderMethod.body), []);

  const sentinelElement = t.callExpression(
    t.memberExpression(t.identifier("React"), t.identifier("createElement")),
    [
      t.identifier("Sentinel"),
      t.objectExpression([
        t.objectProperty(t.identifier("componentName"), t.stringLiteral(componentName)),
        t.objectProperty(t.identifier("sourceFile"), t.stringLiteral(sourceFile)),
        t.objectProperty(t.identifier("renderCount"), t.memberExpression(t.thisExpression(), t.identifier("_sentinel_rc"))),
        t.objectProperty(t.identifier("dialogMd"), mdValue),
        t.objectProperty(t.identifier("componentProps"), thisProps),
      ]),
      iife,
    ],
  );

  renderMethod.body = t.blockStatement([
    incrementStatement,
    t.returnStatement(sentinelElement),
  ]);
}

export function wrapFunctionBody(pathNode: NodePath<any>, componentName: string, sourceFile: string, mdIdentifier: string | null) {
  const node = pathNode.node;
  const mdValue = mdIdentifier ? t.identifier(mdIdentifier) : t.identifier("undefined");
  const uniquePropsIdent = pathNode.scope.generateUidIdentifier("sentinel_props");
  const renderCountIdent = pathNode.scope.generateUidIdentifier("sentinel_rc");
  const originalParams = [...node.params];
  node.params = [uniquePropsIdent];

  const originalInnerFunction = t.arrowFunctionExpression(originalParams, node.body, node.async);
  const callOriginal = t.callExpression(originalInnerFunction, [uniquePropsIdent]);

  // const _sentinel_rc = React.useRef(0);
  const refDeclaration = t.variableDeclaration("const", [
    t.variableDeclarator(
      renderCountIdent,
      t.callExpression(
        t.memberExpression(t.identifier("React"), t.identifier("useRef")),
        [t.numericLiteral(0)],
      ),
    ),
  ]);

  // _sentinel_rc.current += 1;
  const incrementStatement = t.expressionStatement(
    t.assignmentExpression(
      "+=",
      t.memberExpression(renderCountIdent, t.identifier("current")),
      t.numericLiteral(1),
    ),
  );

  const sentinelElement = t.callExpression(
    t.memberExpression(t.identifier("React"), t.identifier("createElement")),
    [
      t.identifier("Sentinel"),
      t.objectExpression([
        t.objectProperty(t.identifier("componentName"), t.stringLiteral(componentName)),
        t.objectProperty(t.identifier("sourceFile"), t.stringLiteral(sourceFile)),
        t.objectProperty(t.identifier("renderCount"), t.memberExpression(renderCountIdent, t.identifier("current"))),
        t.objectProperty(t.identifier("dialogMd"), mdValue),
        t.objectProperty(t.identifier("componentProps"), uniquePropsIdent),
      ]),
      callOriginal,
    ],
  );

  node.body = t.blockStatement([
    refDeclaration,
    incrementStatement,
    t.returnStatement(sentinelElement),
  ]);
}
