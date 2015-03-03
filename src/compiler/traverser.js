var nodes = require('./nodes');

var traverse = module.exports.traverse = function traverse(tree, callback, afterCallback) {
    if (tree && tree.type in nodes) {
        tree.traverse.call(tree, function traverseContents(node, member) {
            if (!node) return;
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
};

module.exports.findAll = function(tree, filter) {
    var output = [];
    traverse(tree, function findAllFilter(node) {
        if (!node) return;
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
        if (!x || !x.traverseStatements) return;
        if (filter && filter(x) === false) return false;
        x.traverseStatements(cb);
    });
};

var findAndReplace = module.exports.findAndReplace = function findAndReplace(tree, filter, preTraverse, beforeCallback, afterCallback) {
    tree.traverse.call(tree, function findAndReplaceIterator(node, member) {
        if (!node) return;
        if (beforeCallback) beforeCallback(node, member);
        if (preTraverse) findAndReplace(node, filter, preTraverse, beforeCallback, afterCallback);
        var replacer;
        if (filter && (replacer = filter(node, member))) {
            tree.substitute.call(tree, function findAndReplaceFilter(sNode, member) {
                if (node !== sNode) return sNode;
                var replacement = replacer(sNode, member);
                return replacement;
            });
        }
        if (!preTraverse) findAndReplace(node, filter, preTraverse, beforeCallback, afterCallback);
        if (afterCallback) afterCallback(node, member);
    });
};
