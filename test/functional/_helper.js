
import assert from 'assert';
import child_process from 'child_process';
import fs from 'fs';
import path from 'path';

import bitstring from 'bitstring';

var compiler = require('../../src/compiler/compiler');
import lexer from '../../src/lexer';
import parser from '../../src/parser';


function globEach(path_, ext, callback) {
    fs.readdirSync(path_).forEach(function(file) {
        file = path.resolve(path_, file);
        var stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            globEach(file, ext, callback);
        } else {
            // If it's got the right extension, add it to the list.
            if (path.extname(file) === ext) {
                callback(path.normalize(file));
            }
        }
    });
}

function compile(code, format) {
    var parsed = parser(lexer(code));
    var compiled = compiler({
        filename: 'test',
        tree: parsed,
        format: format,
    });

    return compiled;
}


describe('Parity tests', function() {

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

                describe('source transformations', function() {
                    var parsed = parser(lexer(read));

                    it('should be able to use toString()', function() {
                        assert.ok(parsed.toString());
                    });
                    it('should be packable', function() {
                        var bitstr = new bitstring();
                        parsed.pack(bitstr);
                        assert.ok(bitstr.hex());
                    });
                });

                it('formats with debug-tree', function jsFunctionalTestBody() {
                    var output = compile(read, 'debug-tree');
                    assert.ok(output);
                });

                it('in JS', function jsFunctionalTestBody() {
                    run(read, 'js', readExpectation);
                });

                it('in Asm.js', function asmjsFunctionalTestBody() {
                    run(read, 'asmjs', readExpectation);
                });

                it('in LLVM IR', function llvmirFunctionalTestBody(done) {
                    this.timeout(5000);
                    this.slow(1000);

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

                    var cp = child_process.exec(
                        path.resolve(process.cwd(), 'bin', 'btype') + ' --target=llvmir --runtime --runtime-entry=testmain | opt -S -O1 | lli',
                        function(err, stdout, stderr) {
                            if (err) {
                                failedLLI++;
                                console.error(stderr);
                                done(err);
                            } else if (stderr) {
                                failedLLI++;
                                console.error(stderr);
                                done(stderr);
                            } else {
                                succeededLLI++;
                                assert.ok(JSON.parse(stdout) == JSON.parse(readExpectation), stdout + ' != ' + readExpectation);
                                done();
                            }
                        }
                    );

                    cp.stdin.write(getRunnable(read));
                    cp.stdin.end();

                    function getRunnable(read) {
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

                        return raw;
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
                describe('source transformations', function() {
                    var parsed = parser(lexer(read));

                    it('should be able to use toString()', function() {
                        assert.ok(parsed.toString());
                    });
                    it('should be packable', function() {
                        var bitstr = new bitstring();
                        parsed.pack(bitstr);
                        assert.ok(bitstr.hex());
                    });
                });
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
                it('formats with debug-tree', function compileTestBody() {
                    var parsed = parser(lexer(read));
                    var compiled = compiler({
                        filename: 'test',
                        tree: parsed,
                        format: 'debug-tree'
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

                it('runs in JS', function jsStringTestBody() {
                    run(read, 'js', readExpectation);
                });

                it('runs in Asm.js', function asmjsStringTestBody() {
                    run(read, 'asmjs', readExpectation);
                });

                it('formats in debug-tree', function debugTreeStringTestBody() {
                    assert.ok(compile(read, 'debug-tree'));
                });

            });

        }
    );

});
