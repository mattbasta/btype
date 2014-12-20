var assert = require('assert');
var fs = require('fs');
var path = require('path');

var compiler = require('../../src/compiler/compiler');
var parser = require('../../src/parser');
var lexer = require('../../src/lexer');


function globEach(path_, ext, callback, doneCallback) {
    var wildcard = ext === '*';
    if (!doneCallback) {
        doneCallback = function() {};
    }

    var list = fs.readdirSync(path_);
    var pending = list.length;
    if (!pending) return doneCallback(null);
    list.forEach(function(file) {
        file = path_ + '/' + file;
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            globEach(file, ext, callback, function(err) {
                if (!--pending) doneCallback(err);
            });
        } else {
            // If it's got the right extension, add it to the list.
            if(wildcard || file.substr(file.length - ext.length) === ext)
                callback(path.normalize(file));
            if (!--pending) doneCallback(null);
        }
    });
};


describe('Parity tests', function() {

    function run(code, format, expectation) {
        var parsed = parser(lexer(code));
        var compiled = compiler('test', parsed, format);

        var mod = (new Function('return ' + compiled))();
        try {
            assert.equal(mod.main(), expectation);
        } catch (e) {
            console.error(compiled);
            throw e;
        }
    }

    globEach(
        path.resolve(__dirname, 'tests'),
        '.bt',
        function(btPath) {
            var read = fs.readFileSync(btPath).toString();
            var readExpectation = fs.readFileSync(btPath + '.txt').toString().trim();

            describe(btPath, function() {

                it('in JS', function() {
                    run(read, 'js', readExpectation);
                });

                it('in Asm.js', function() {
                    run(read, 'asmjs', readExpectation);
                });

            });

        }
    );

});

describe('Compile tests', function() {

    globEach(
        path.resolve(__dirname, 'compiletests'),
        '.bt',
        function(btPath) {
            var read = fs.readFileSync(btPath).toString();

            it(btPath, function() {
                var parsed = parser(lexer(read));
                var compiled = compiler('test', parsed);
                assert.ok(compiled);

            });

        }
    );

});

describe('Failure tests', function() {

    globEach(
        path.resolve(__dirname, 'failtests'),
        '.bt',
        function(btPath) {
            var read = fs.readFileSync(btPath).toString();

            it(btPath, function() {
                assert.throws(function() {
                    compiler('test', parser(lexer(read)));
                });

            });

        }
    );

});
