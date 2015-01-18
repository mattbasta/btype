// var esprima = require('esprima');
// var escodegen = require('escodegen');


// function traverse(node, cb, after, parent, member) {
//     var res = cb(node, parent, member);
//     if (res === false) return;
//     for (var key in node) {
//         if (node.hasOwnProperty(key)) {
//             var child = node[key];
//             if (typeof child === 'object' && child !== null) {
//                 if (Array.isArray(child)) {
//                     child.forEach(function(childNode) {
//                         traverse(childNode, cb, after, node, key);
//                     });
//                 } else {
//                     traverse(child, cb, after, node, key);
//                 }
//             }
//         }
//     }
//     if (after) after(node);
// }


// function upliftDeclarations(body) {
//     var stack = [];
//     traverse(body, function(node, parent, member) {
//         if (node.type === 'FunctionDeclaration') {
//             stack.unshift(node);
//             return;
//         }

//         if (!stack.length) return;

//         // Ignore everything that isn't a declaration
//         if (node.type !== 'VariableDeclaration') {
//             return;
//         }

//         // Ignore declarations that are already in the right place
//         if (parent === stack[0]) {
//             return;
//         }

//         stack[0].body.body.splice(0, 0, node);
//         if (parent[member] === node) {
//             parent[member] = null;
//         } else {
//             parent[member].splice(parent[member].indexOf(node), 1);
//         }


//     }, function(node) {
//         if (node.type === 'FunctionDeclaration') {
//             stack.shift();
//         }
//     });
// }

// function trimBody(body) {
//     var accessorToAccessed = {};
//     var accessedToAccessor = {};

//     function mark(accessor, accessed) {
//         if (!(accessor in accessorToAccessed)) accessorToAccessed[accessor] = [];
//         if (!(accessed in accessedToAccessor)) accessedToAccessor[accessed] = [];
//         accessorToAccessed[accessor].push(accessed);
//         accessedToAccessor[accessed].push(accessor);
//     }

//     var stack = [];

//     function getAccessorName() {
//         for (var i = stack.length - 1; i >= 0; i--) {
//             if (stack[i].type === 'FunctionDeclaration') return stack[i].id.name;
//             if (stack[i].type === 'VariableDeclarator') return stack[i].id.name;
//             if (stack[i].type === 'AssignmentExpression') return stack[i].left.name;
//             if (stack[i].type === 'ReturnStatement') return 'root';
//         }
//         console.error(stack);
//         throw new Error('Unknown accessor name');
//     }

//     traverse(body, function(node) {
//         if (stack.length === 1 && node.type === 'ReturnStatement') {
//             node.argument.properties.forEach(function(prop) {
//                 mark('root', prop.value.name);
//             });
//             return false;
//         }
//         stack.unshift(node);

//         // Ignore non-identifiers
//         if (node.type !== 'Identifier') return;
//         // Ignore the name of functions
//         if (stack[1].type === 'FunctionDeclaration') return;
//         // Ignore the name of declarations
//         if (stack[1].type === 'VariableDeclarator' && node === stack[1].id) return;

//         var accessor = getAccessorName();
//         if (stack.length === 3 && node.type === 'ArrayExpression') {
//             node.elements.forEach(function(elem) {
//                 mark(accessor, elem.name);
//             });
//             return false;
//         } else if (node.type === 'Identifier') {
//             mark(accessor, node.name);
//         }


//     }, function() {
//         stack.shift();
//     });

//     var unexploredNames = accessorToAccessed['root'];
//     var exploredNames = [];
//     var encounteredIdentifiers = {};

//     var current;
//     var currentBody;
//     while (unexploredNames.length) {
//         current = unexploredNames.pop();

//         currentBody = accessorToAccessed[current];
//         if (currentBody) {
//             currentBody.forEach(function(name) {
//                 if (exploredNames.indexOf(name) !== -1) return;
//                 if (unexploredNames.indexOf(name) !== -1) return;
//                 unexploredNames.push(name);
//             });
//         }

//         encounteredIdentifiers[current] = true;
//         exploredNames.push(current);
//     }

//     var anyRemoved = false;
//     body.body = body.body.filter(function(node) {
//         var kept = true;
//         if (node.type === 'FunctionDeclaration') {
//             kept = node.id.name in encounteredIdentifiers;
//             anyRemoved = anyRemoved || !kept;
//         } else if (node.type === 'VariableDeclaration') {
//             node.declarations = node.declarations.filter(function(decl) {
//                 return decl.id.name in encounteredIdentifiers;
//             });
//             kept = !!node.declarations.length;
//             anyRemoved = anyRemoved || !kept;
//         }
//         return kept;
//     });

//     if (anyRemoved) trimBody(body);
// }

// function orderCode(body) {
//     function getType(node) {
//         if (node.type === 'VariableDeclaration') {
//             var decl = node.declarations[0];
//             if (decl.init.type === 'MemberExpression') {
//                 return 0;
//             }
//             if (decl.init.type === 'NewExpression') {
//                 return 1;
//             }
//             if (decl.init.type === 'ArrayExpression') {
//                 return 3;
//             }
//             return 0;
//         }
//         if (node.type === 'FunctionDeclaration') {
//             return 2;
//         }
//         if (node.type === 'ReturnStatement') {
//             return 4;
//         }
//         return -1;
//     }
//     body.body.sort(function(a, b) {
//         return getType(a) - getType(b);
//     });

//     // Sort function bodies
//     traverse(body, function(node) {
//         if (node.type !== 'FunctionDeclaration') return;

//         var params = node.params.map(function(p) {
//             return p.name;
//         });

//         function isParamAnnotation(node) {
//             if (node.type !== 'ExpressionStatement' ||
//                 node.expression.type !== 'AssignmentExpression' ||
//                 node.expression.left.type !== 'Identifier' ||
//                 params.indexOf(node.expression.left.name) === -1) {
//                 return false;
//             }

//             if (node.expression.right.type === 'UnaryExpression' &&
//                 node.expression.right.argument.type === 'Identifier' &&
//                 node.expression.right.argument.name === node.expression.left.name) {
//                 return true;
//             }
//             if (node.expression.right.type === 'BinaryExpression' &&
//                 node.expression.right.left.type === 'Identifier' &&
//                 node.expression.right.left.name === node.expression.left.name) {
//                 return true;
//             }

//             return false;
//         }

//         function getInnerType(node) {
//             // Identify param type annotations
//             var paramIdx;
//             if (node.type === 'ExpressionStatement' &&
//                 node.expression.type === 'AssignmentExpression' &&
//                 node.expression.left.type === 'Identifier' &&
//                 (paramIdx = params.indexOf(node.expression.left.name)) !== -1) {

//                 if (node.expression.right.type === 'UnaryExpression' &&
//                     node.expression.right.argument.type === 'Identifier' &&
//                     node.expression.right.argument.name === node.expression.left.name) {
//                     return paramIdx;
//                 }
//                 if (node.expression.right.type === 'BinaryExpression' &&
//                     node.expression.right.left.type === 'Identifier' &&
//                     node.expression.right.left.name === node.expression.left.name) {
//                     return paramIdx;
//                 }

//             }
//             if (node.type === 'VariableDeclaration') return params.length;
//             return params.length + 1;
//         }
//         var origBody = node.body.body;
//         var bodyPrefix = [];
//         for (var i = 0; i < origBody.length; i++) {
//             if (!isParamAnnotation(origBody[i])) {
//                 continue;
//             }
//             bodyPrefix.push(origBody[i]);
//             origBody.splice(i, 1);
//             i--;
//         }

//         bodyPrefix = bodyPrefix.concat(origBody.filter(function(x) {
//             return x.type === 'VariableDeclaration';
//         }));
//         origBody = origBody.filter(function(x) {
//             return x.type !== 'VariableDeclaration';
//         });

//         node.body.body = bodyPrefix.concat(origBody);
//     });
// }

// function cleanUpTypecasting(body) {
//     function iterator(node) {
//         if (node.type === 'UnaryExpression') {
//             if (node.operator !== '+') return;
//             if (node.argument.type !== 'UnaryExpression') return;
//             if (node.argument.operator !== '+') return;
//             node.argument = node.argument.argument;
//             return iterator(node);
//         }
//         if (node.type === 'BinaryExpression') {
//             if (node.operator !== '|') return;
//             if (node.right.type !== 'Literal' || node.right.value !== 0) return;
//             if (node.left.type !== 'BinaryExpression') return;
//             if (node.left.operator !== '|') return;
//             if (node.left.right.type !== 'Literal' || node.left.right.value !== 0) return;
//             node.left = node.left.left;
//             return iterator(node);
//         }
//     }
//     traverse(body, iterator);
// }

// exports.optimize = function(body) {
//     var parsed;
//     try {
//         parsed = esprima.parse('(function() {' + body + '})', {raw: true});
//     } catch (e) {
//         console.error(body);
//         throw e;
//     }
//     var parsedBody = parsed.body[0].expression.body;

//     upliftDeclarations(parsedBody);
//     trimBody(parsedBody);
//     orderCode(parsedBody);
//     cleanUpTypecasting(parsedBody);

//     parsedBody.type = 'Program';

//     return escodegen.generate(
//         parsedBody,
//         {
//             directive: true,
//             parse: esprima.parse,
//             raw: true,
//         }
//     );

// };
