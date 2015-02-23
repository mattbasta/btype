var assert = require('assert');
var child_process = require('child_process');
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

    function compile(code, format) {
        var parsed = parser(lexer(code));
        var compiled = compiler('test', parsed, format);

        return compiled;
    }

    function run(code, format, expectation) {
        var compiled = compile(code, format);

        var mod;
        try {
            mod = (new Function('return ' + compiled))();
        } catch (e) {
            assert.fail('Error during initialization: ' + e.toString());
        }

        var result;
        try {
            result = mod.main();
        } catch (e) {
            console.error(compiled);
            throw e;
        }
        assert.equal(result, expectation);
    }

    globEach(
        path.resolve(__dirname, 'tests'),
        '.bt',
        function(btPath) {
            var read = fs.readFileSync(btPath).toString();
            var readExpectation = fs.readFileSync(btPath + '.txt').toString().trim();

            describe(btPath, function() {

                it('in JS', function jsFunctionalTestBody() {
                    run(read, 'js', readExpectation);
                });

                it('in Asm.js', function asmjsFunctionalTestBody() {
                    run(read, 'asmjs', readExpectation);
                });

                it('in LLVM IR', function llvmirFunctionalTestBody() {
                    try {
                        var compiled = compile(read, 'llvmir');
                    } catch(e) {
                        // this.skip();
                        throw e;
                    }

                    // var opt = child_process.spawn('opt');

                    // opt.on('error', function() {
                    //     done(new Error('Error processing file'));
                    // });
                    // opt.on('exit', function(code) {
                    //     if (code !== 0) {
                    //         done(new Error('Error processing file'));
                    //     } else {
                    //         done();
                    //     }
                    // });
                    // opt.on('close', function(code) {
                    //     if (code !== 0) {
                    //         done(new Error('Error processing file'));
                    //     } else {
                    //         done();
                    //     }
                    // });

                    // opt.stdin.write(compiled);

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


            describe(btPath, function() {
                it('compiles to JS', function compileTestBody() {
                    var parsed = parser(lexer(read));
                    var compiled = compiler('test', parsed, 'js');
                    assert.ok(compiled);
                });
                it('compiles to Asm.js', function compileTestBody() {
                    var parsed = parser(lexer(read));
                    var compiled = compiler('test', parsed, 'asmjs');
                    assert.ok(compiled);
                });
                it('compiles to LLVM IR', function compileTestBody() {
                    var parsed = parser(lexer(read));
                    var compiled = compiler('test', parsed, 'llvmir');
                    assert.ok(compiled);
                });

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

            it(btPath, function failTestBody() {
                assert.throws(function() {
                    compiler('test', parser(lexer(read)));
                });

            });

        }
    );

});

describe('String tests', function() {

    function run(code, format, expectation) {
        var parsed = parser(lexer(code));
        var compiled = compiler('test', parsed, format);

        var mod;
        try {
            mod = (new Function('return ' + compiled))();
        } catch (e) {
            assert.fail('Error during initialization: ' + e.toString());
        }

        var result;
        try {
            result = mod.main();
        } catch (e) {
            console.error(compiled);
            throw e;
        }

        var converted = mod.$strings.read(result);
        assert.equal(converted, expectation);
    }

    globEach(
        path.resolve(__dirname, 'strings'),
        '.bt',
        function(btPath) {
            var read = fs.readFileSync(btPath).toString();
            var readExpectation = fs.readFileSync(btPath + '.txt').toString().trim();

            describe(btPath, function() {

                it('in JS', function jsStringTestBody() {
                    run(read, 'js', readExpectation);
                });

                it('in Asm.js', function asmjsStringTestBody() {
                    run(read, 'asmjs', readExpectation);
                });

            });

        }
    );

});
