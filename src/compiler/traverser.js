var nodes = require('./nodes');

var traverse = module.exports.traverse = function traverse(tree, callback, afterCallback) {
    if (tree && tree.type in nodes) {
        tree.traverse.call(tree, function traverseContents(node, member) {
            var ret = callback(node, member);
            if (ret === false) return;
            traverse(node, callback, afterCallback);
            if (afterCallback) afterCallback(node, member);
        });
    }
};

module.exports.traverseWithSelf = function traverseWithSelf(tree, callback, afterCallback) {
    callback(tree);
    traverse(tree, callback, afterCallback);
    if (afterCallback) afterCallback(tree);
}

module.exports.findAll = function(tree, filter) {
    var output = [];
    traverse(tree, function findAllFilter(node) {
        if (filter && !filter(node)) return;
        output.push(node);
    });
    return output;
};

module.exports.iterateBodies = function iterateBodies(tree, cb, filter) {
    if (tree.traverseStatements && (!filter || filter(tree) !== false)) {
        tree.traverseStatements(cb);
    }
    traverse(tree, function iterateBodyFilter(x) {
        if (x.traverseStatements) {
            if (filter && filter(x) === false) return false;
            x.traverseStatements(cb);
        }
    });
};

var findAndReplace = module.exports.findAndReplace = function findAndReplace(tree, filter) {
    tree.traverse.call(tree, function(node, member) {
        if (!node) return;
        var replacer;
        if (filter && (replacer = filter(node, member))) {
            tree.substitute.call(tree, function findAndReplaceFilter(sNode, member) {
                if (node !== sNode) return sNode;
                return replacer(sNode, member);
            });
        }
        findAndReplace(node, filter);
    });
};
