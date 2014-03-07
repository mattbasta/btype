var namer = require('./namer')();
var traverser = require('./traverser');


function Context(scope, parent) {
    this.scope = scope || null;
    this.parent = parent || null;
    if (scope) {
        scope.__context = this;
    }
    this.functions = [];
    this.vars = {};
    this.nameMap = {};
    this.accessesGlobalScope = false;
    this.accessesLexicalScope = false;
    this.lexicalLookups = {};
    this.exports = {};
}

Context.prototype.addVar = function(varName, type) {
    if (varName in this.vars) {
        throw new Error('Cannot redeclare variable in context');
    }
    this.vars[varName] = type;
};

Context.prototype.hasVar = function(varName) {
    return this.vars[varName];
};

Context.prototype.lookupVar = function(varName) {
    if (varName in this.vars) {
        console.log('Found ' + varName + ' in this scope');
        return this;
    } else if (this.parent) {
        console.log('Looking for ' + varName + ' in parent scope');
        return this.parent.lookupVar(varName);
    } else {
        throw new ReferenceError('Reference to undefined variable "' + varName + '"');
    }
};

module.exports = function generateContext(tree) {
    var rootContext = new Context();
    var contexts = [rootContext];

    traverser.traverse(tree, function(node) {
        node.__context = contexts[0];
        switch (node.type) {
            case 'Function':
                if (node.name in contexts[0].vars) {
                    throw new Error('Cannot redeclare variable "' + node.name + '"');
                }
                contexts[0].functions.push(node);
                contexts[0].vars[node.name] = node.getType(contexts[0]);
                contexts[0].nameMap[node.name] = node.__assignedName = namer();

                var newContext = new Context(node, contexts[0]);
                node.__definesContext = newContext;
                contexts.unshift(newContext);
                node.params.forEach(function(param) {
                    newContext.addVar(param.name, param.getType(newContext));
                    newContext.nameMap[param.name] = namer();
                });
                return;
            case 'Declaration':
                contexts[0].addVar(node.identifier, node.value.getType(contexts[0]));
                return;
            case 'Symbol':
                node.__refContext = contexts[0].lookupVar(node.name);
                node.__refName = node.__refContext.nameMap[node.name];
                if (node.__refContext === rootContext && contexts.length > 1) {
                    contexts[0].accessesGlobalScope = true;
                } else if (node.__refContext !== contexts[0] && node.__refContext !== rootContext) {
                    contexts[0].accessesLexicalScope = true;
                    for (var i = 0; i < contexts.length && contexts[i] !== node.__refContext; i++) {
                        contexts[i].lexicalLookups[node.name] = node.__refContext;
                    }
                }
                return;
            case 'Export':
                if (contexts.length > 1) {
                    throw new Error('Unexpected export: all exports must be in the global scope');
                }
                node.__assignedName = rootContext.exports[node.value.name] = rootContext.nameMap[node.value.name] = namer();
                return;
        }
    }, function(node) {
        if (node.type === 'Function') {
            contexts.shift();
        }
    });
    return rootContext;
};
