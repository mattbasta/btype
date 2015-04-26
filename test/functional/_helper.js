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
        var compiled = compiler({
            filename: 'test',
            tree: parsed,
            format: format,
        });

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

    var succeededLLI = 0;
    var failedLLI = 0;

    globEach(
        path.resolve(__dirname, 'tests'),
        '.bt',
        function globEachReader(btPath) {
            var read = fs.readFileSync(btPath).toString();
            var readExpectation = fs.readFileSync(btPath + '.txt').toString().trim();

            describe(btPath, function() {

                it('in JS', function jsFunctionalTestBody() {
                    run(read, 'js', readExpectation);
                });

                it('in Asm.js', function asmjsFunctionalTestBody() {
                    run(read, 'asmjs', readExpectation);
                });

                it('in LLVM IR', function llvmirFunctionalTestBody(done) {
                    this.slow(500);

                    var parsed;
                    var compiled;
                    try {
                        parsed = parser(lexer(read));
                        compiled = compiler({
                            filename: 'test',
                            tree: parsed,
                            format: 'llvmir'
                        });
                    } catch (e) {
                        done(e);
                        return;
                    }

                    child_process.exec(
                        path.resolve(process.cwd(), 'bin', 'btype') + ' ' + btPath + ' --target=llvmir | opt -S',
                        function(err, stdout, stderr) {
                            if (err) {
                                done(err);
                            } else if (stderr) {
                                done(new Error(stderr.toString()));
                            } else {
                                runLLI();
                            }
                        }
                    );

                    function runLLI() {
                        var cp = child_process.exec(
                            path.resolve(process.cwd(), 'bin', 'btype') + ' --target=llvmir --runtime --runtime-entry=testmain | opt -S | lli',
                            function(err, stdout, stderr) {
                                if (err) {
                                    failedLLI++;
                                    done(err);
                                } else if (stderr) {
                                    failedLLI++;
                                    done(stderr);
                                } else {
                                    succeededLLI++;
                                    assert.ok(JSON.parse(stdout) == JSON.parse(readExpectation), stdout + ' != ' + readExpectation);
                                    done();
                                }
                            }
                        );


                        var parsed = parser(lexer(read));
                        var env = compiler.buildEnv({filename: 'test', tree: parsed});
                        var mainFunc = env.requested.exports.main;
                        var mainFuncDef = env.requested.functionDeclarations[mainFunc];

                        var raw = 'import debug;\n';
                        raw += read + '\n';
                        switch (mainFuncDef.getType(env.requested).getReturnType().typeName) {
                            case 'int':
                                raw += 'func testmain() {\n    debug.printint(main());\n}\nexport testmain;';
                                break;
                            case 'float':
                                raw += 'func testmain() {\n    debug.printfloat(main());\n}\nexport testmain;';
                                break;
                            case 'bool':
                                raw += 'func testmain() {\n    debug.printbool(main());\n}\nexport testmain;';
                                break;
                        }

                        cp.stdin.write(raw);
                        cp.stdin.end();

                    }

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
                    var compiled = compiler({
                        filename: 'test',
                        tree: parsed,
                        format: 'js'
                    });
                    assert.ok(compiled);
                });
                it('compiles to Asm.js', function compileTestBody() {
                    var parsed = parser(lexer(read));
                    var compiled = compiler({
                        filename: 'test',
                        tree: parsed,
                        format: 'asmjs'
                    });
                    assert.ok(compiled);
                });
                it('compiles to LLVM IR', function compileTestBody() {
                    var parsed = parser(lexer(read));
                    var compiled = compiler({
                        filename: 'test',
                        tree: parsed,
                        format: 'llvmir'
                    });
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

            var expectedExceptionPath = path.dirname(btPath);
            expectedExceptionPath += path.sep;
            expectedExceptionPath += path.basename(btPath, '.bt') + '.txt';

            it(btPath, function failTestBody() {
                assert.throws(
                    function() {
                        compiler({
                            filename: 'test',
                            tree: parser(lexer(read)),
                            format: 'debug-tree',
                        });
                    },
                    function(err) {
                        if (fs.existsSync(expectedExceptionPath)) {
                            var exceptionText = fs.readFileSync(expectedExceptionPath).toString();
                            return exceptionText === err.toString();
                        } else {
                            fs.writeFileSync(expectedExceptionPath, err.toString());
                            return true;
                        }
                    }
                );

            });

        }
    );

});

describe('String tests', function() {

    function run(code, format, expectation) {
        var parsed = parser(lexer(code));
        var compiled = compiler({
            filename: 'test',
            tree: parsed,
            format: format
        });

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
