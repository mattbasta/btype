import assert from 'assert';
import child_process from 'child_process';
import fs from 'fs';
import path from 'path';

import bitstring from 'bitstring';

import compiler from '../../src/compiler/compiler';
import {buildEnv} from '../../src/compiler/compiler';
import ErrorFormatter from '../../src/errorFormatter';
import lexer from '../../src/lexer';
import parser from '../../src/parser';
import {processData} from '../../src/cli/main';


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
    var compiled = compiler({
        filename: 'test',
        format: format,
        sourceCode: code,
    });

    return compiled;
}


describe('Parity tests', () => {

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

            describe(btPath, () => {

                describe('source transformations', () => {
                    var parsed;
                    try {
                        parsed = parser(lexer(read));
                    } catch (e) {
                        e.message += `\n${btPath}\n`;
                        throw e;
                    }

                    it('should be able to use toString()', () => {
                        assert.ok(parsed.toString());
                    });
                    it('should be packable', () => {
                        var bitstr = new bitstring();
                        parsed.pack(bitstr);
                        assert.ok(bitstr.hex());
                    });
                });

                it('formats with debug-tree', () => {
                    var output = compile(read, 'debug-tree');
                    assert.ok(output);
                });

                it('in JS', () => {
                    run(read, 'js', readExpectation);
                });

                it('in asm.js', () => {
                    run(read, 'asmjs', readExpectation);
                });

                it('in LLVM IR', function llvmirFunctionalTestBody(done) {
                    this.timeout(5000);
                    this.slow(1000);

                    function runAndPipe(command, stdin, cb) {
                        var cp = child_process.exec(command, cb);
                        cp.stdin.write(stdin);
                        cp.stdin.end();
                    }

                    processData(
                        getRunnable(read),
                        {
                            _: [btPath],
                            target: 'llvmir',
                            runtime: true,
                            'runtime-entry': 'testmain',
                        },
                        result => {
                            if (!result) {
                                failedLLI++;
                                console.error('No output from CLI main');
                                done(new Error('no output'));
                            }

                            // console.log(result);
                            // return;

                            runAndPipe(
                                'opt -S -O1 | lli',
                                result,
                                (err, stdout, stderr) => {
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
                        }
                    );

                    function getRunnable() {
                        var env = buildEnv({
                            'filename': btPath,
                            format: 'llvmir',
                            sourceCode: read,
                        });
                        var mainFunc = env.requested.exports.get('main');
                        var mainFuncDef = env.requested.functionDeclarations.get(mainFunc);

                        var raw = 'import debug;\n';
                        raw += read + '\n';
                        switch (mainFuncDef.resolveType(env.requested).getReturnType().typeName) {
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

describe('Compile tests', () => {

    globEach(
        path.resolve(__dirname, 'compiletests'),
        '.bt',
        btPath => {
            var read = fs.readFileSync(btPath).toString();


            describe(btPath, () => {
                var parsed = parser(lexer(read));

                describe('source transformations', () => {
                    it('should be able to use toString()', () => {
                        assert.ok(parsed.toString());
                    });
                    it('should be packable', () => {
                        var bitstr = new bitstring();
                        parsed.pack(bitstr);
                        assert.ok(bitstr.hex());
                    });
                });
                it('compiles to JS', () => {
                    var compiled = compiler({
                        filename: btPath,
                        tree: parsed,
                        format: 'js',
                        sourceCode: read,
                    });
                    assert.ok(compiled);
                });
                it('compiles to asm.js', function() {
                    this.slow(250);
                    this.timeout(500);
                    var compiled = compiler({
                        filename: btPath,
                        tree: parsed,
                        format: 'asmjs',
                        sourceCode: read,
                    });
                    assert.ok(compiled);
                });
                it('compiles to LLVM IR', function() {
                    this.slow(500);
                    this.timeout(1000);
                    var compiled = compiler({
                        filename: btPath,
                        tree: parsed,
                        format: 'llvmir',
                        sourceCode: read,
                    });
                    assert.ok(compiled);
                });
                it('formats with debug-tree', () => {
                    var compiled = compiler({
                        filename: btPath,
                        tree: parsed,
                        format: 'debug-tree',
                        sourceCode: read,
                    });
                    assert.ok(compiled);
                });

            });
        }
    );

});

describe('Failure tests', () => {

    globEach(
        path.resolve(__dirname, 'failtests'),
        '.bt',
        btPath => {
            var read = fs.readFileSync(btPath).toString();

            var expectedExceptionPath = path.dirname(btPath);
            expectedExceptionPath += path.sep;
            expectedExceptionPath += path.basename(btPath, '.bt') + '.txt';

            it(btPath, () => {
                assert.throws(
                    () => {
                        compiler({
                            filename: btPath,
                            sourceCode: read,
                            format: 'debug-tree',
                        });
                    },
                    err => {
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

describe('String tests', () => {

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
        btPath => {
            var read = fs.readFileSync(btPath).toString();
            var readExpectation = fs.readFileSync(btPath + '.txt').toString().trim();

            describe(btPath, () => {

                it('runs in JS', () => {
                    run(read, 'js', readExpectation);
                });

                it('runs in Asm.js', () => {
                    run(read, 'asmjs', readExpectation);
                });

                it('formats in debug-tree', () => {
                    assert.ok(compile(read, 'debug-tree'));
                });

            });

        }
    );

});
