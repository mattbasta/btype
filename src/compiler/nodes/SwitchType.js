var indentEach = require('./_utils').indentEach;


exports.traverse = function traverse(cb) {
    cb(this.expr, 'expr');
    this.cases.forEach(function traverseSwitchTypeCases(c) {
        cb(c, 'cases');
    });
};

exports.substitute = function substitute() {
    this.cases = this.cases.map(function(stmt) {
        return cb(stmt, 'cases');
    }).filter(ident);
};

exports.validateTypes = function validateTypes(ctx) {
    this.expr.validateTypes(ctx);

    var temp;
    var types = [];
    for (var i = 0; i < this.cases.length; i++) {
        temp = this.cases[i].getType(ctx);
        if (types.some(function(t) {return t.equals(temp);})) {
            throw new TypeError('Cannot include type (' + temp.toString() + ') in switchtype more than once');
        }
        types.push(temp);
    }

    var type = this.expr.getType(ctx);
    for (i = 0; i < this.cases.length; i++) {
        if (!this.cases[i].getType(ctx).equals(type)) {
            continue;
        }
        this.cases[i].validateTypes(ctx);
        return;
    }
    throw new TypeError('No type provided to switchtype matches inferred type: ' + type.toString());
};

exports.toString = function toString() {
    return 'SwitchType:\n' +
           '    Expr:\n' +
           indentEach(this.expr.toString(), 2) + '\n' +
           '    Cases:\n' +
           indentEach(this.cases.map(function(stmt) {return stmt.toString();}).join('\n'), 2) + '\n';
};

exports.translate = function translate(ctx) {
    var exprType = this.expr.getType(ctx);
    for (var i = 0; i < this.cases.length; i++) {
        if (!this.cases[i].caseType.getType(ctx).equals(exprType)) continue;
        return new (require('../nodes').Block)(
            this.cases[i].start,
            this.cases[i].end,
            {
                body: this.cases[i].body,
            }
        );
    }

    throw new Error('No switchtype cases matched during translation');
};
