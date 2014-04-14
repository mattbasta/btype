var nodes = require('./nodes');

var traverse = module.exports.traverse = function(tree, callback, afterCallback) {
    if (tree && tree.type in nodes) {
        tree.traverse.call(tree, function(node, member) {
            var ret = callback(node, member);
            if (ret === false) return;
            traverse(node, callback, afterCallback);
            if (afterCallback) afterCallback(node, member);
        });
    }
};

module.exports.findAll = function(tree, filter) {
    var output = [];
    traverse(tree, function(node) {
        if (filter && !filter(node)) return;
        output.push(node);
    });
    return output;
};

var findAndReplace = module.exports.findAndReplace = function(tree, filter) {
    tree.traverse.call(tree, function(node, member) {
        if (!node) return;
        var replacer;
        if (filter && (replacer = filter(node, member))) {
            tree.substitute.call(tree, function(sNode, member) {
                if (node !== sNode) return sNode;
                return replacer(sNode, member);
            });
        }
        findAndReplace(node, filter, replacer);
    });
};
