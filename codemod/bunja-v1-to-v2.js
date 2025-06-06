module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let modified = false;

  root.find(j.CallExpression, { callee: { name: "bunja" } }).forEach((path) => {
    const { node } = path;
    const args = node.arguments;
    if (args.length !== 2) return;

    const [depsArray, initFn] = args;
    if (depsArray.type !== "ArrayExpression") return;
    if (
      initFn.type !== "ArrowFunctionExpression" &&
      initFn.type !== "FunctionExpression"
    ) return;
    const params = initFn.params;

    const bodyStatements = initFn.body.type === "BlockStatement"
      ? [...initFn.body.body]
      : [{ type: "ReturnStatement", argument: initFn.body }];

    const useStatements = depsArray.elements.map((dep, index) => {
      if (index < params.length) {
        return {
          type: "VariableDeclaration",
          kind: "const",
          declarations: [{
            type: "VariableDeclarator",
            id: params[index],
            init: {
              type: "CallExpression",
              callee: {
                type: "MemberExpression",
                object: { type: "Identifier", name: "bunja" },
                property: { type: "Identifier", name: "use" },
                computed: false,
              },
              arguments: [dep],
            },
          }],
        };
      } else {
        return {
          type: "ExpressionStatement",
          expression: {
            type: "CallExpression",
            callee: {
              type: "MemberExpression",
              object: { type: "Identifier", name: "bunja" },
              property: { type: "Identifier", name: "use" },
              computed: false,
            },
            arguments: [dep],
          },
        };
      }
    });

    for (let i = 0; i < bodyStatements.length; ++i) {
      const statement = bodyStatements[i];
      if (!statement || statement.type !== "ReturnStatement") continue;
      if (statement.argument?.type !== "ObjectExpression") continue;
      const returnObj = statement.argument;
      const props = returnObj.properties;

      const effectPropIndex = props.findIndex((prop) =>
        prop?.computed &&
        prop.key?.type === "MemberExpression" &&
        prop.key?.object?.name === "bunja" &&
        prop.key?.property?.name === "effect"
      );
      if (effectPropIndex === -1) continue;

      const prop = props[effectPropIndex];
      let effectFn = prop.value;

      if (effectFn.type === "FunctionExpression") {
        effectFn = {
          type: "ArrowFunctionExpression",
          params: effectFn.params,
          body: effectFn.body,
        };
      }

      const effectStatement = {
        type: "ExpressionStatement",
        expression: {
          type: "CallExpression",
          callee: {
            type: "MemberExpression",
            object: { type: "Identifier", name: "bunja" },
            property: { type: "Identifier", name: "effect" },
            computed: false,
          },
          arguments: [effectFn],
        },
      };

      props.splice(effectPropIndex, 1);
      bodyStatements.splice(i, 0, effectStatement);
      ++i;
    }

    node.arguments = [{
      type: "ArrowFunctionExpression",
      params: [],
      body: {
        type: "BlockStatement",
        body: [...useStatements, ...bodyStatements],
      },
    }];

    modified = true;
  });

  return modified ? root.toSource() : fileInfo.source;
};
