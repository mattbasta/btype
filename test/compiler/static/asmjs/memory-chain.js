'use strict';
require('babel/register');


var assert = require('assert');
var fs = require('fs');
var path = require('path');


var heapModule = fs.readFileSync(path.resolve(__dirname, '../../../../src/compiler/static/asmjs/heap.js')).toString();
var memModule = fs.readFileSync(path.resolve(__dirname, '../../../../src/compiler/static/asmjs/memory-chain.js')).toString();


var HEAP_SIZE = 1024 * 1024;
var LOWEST_ORDER = 8;

function getInstance() {
    var setup = [
        'var stdlib = this;',
        'var HEAP_SIZE = ' + HEAP_SIZE + ';',
        'var heap = new ArrayBuffer(HEAP_SIZE);', // We don't need to make this a power of two for tests.
        heapModule, // Include the heap module so we have the appropriate heap views.
    ].join('\n');

    var returns = [
        'malloc: malloc',
        'calloc: calloc',
        'free: free',
        'view: memheap',
    ].join(',');

    var code = '(function() {' + setup + memModule + '\nreturn {' + returns + '}}.call(global))';
    try {
        return eval(code);
    } catch (e) {
        console.log(code);
        throw e;
    }
}

describe('Memory (chain) special module', function() {

    var mod;
    beforeEach(function() {
        mod = getInstance();
    });

    describe('malloc', function() {
        it('should return the null pointer if the requested size is larger than the heap', function() {
            assert.equal(mod.malloc(HEAP_SIZE + 1), 0);
        });

        it('should return the null pointer if there is no space left', function() {
            // Subtract 16 for heap overhead
            // Resulting pointer should be 16 because the pointer is for the
            // body of the block (8 for global heap overhead, 8 for block overhead)
            assert.equal(mod.malloc(HEAP_SIZE - 16), 16);
            assert.equal(mod.malloc(1), 0);
        });

        it('should return the null pointer if the requested size is zero', function() {
            assert.equal(mod.malloc(0), 0);
        });

        it('should always return pointers that are multiples of the lowest order', function() {
            for (var i = 0; i < 1024; i += 1) {
                assert.equal(mod.malloc(i) % LOWEST_ORDER, 0);
            }
        });

        it('should return only valid pointers', function() {
            var pointers = [];
            var x;
            var size = LOWEST_ORDER * 128;
            var max_ptr = HEAP_SIZE;
            while (1) {
                x = mod.malloc(size);
                if (x === 0) break;
                assert.ok(x > 0);
                assert.ok(x < max_ptr);
                assert.equal(pointers.indexOf(x), -1);
                pointers.push(x | 0);
            }

            pointers = pointers.sort(function(a, b) {
                if (a < b) {
                    return -1;
                }
                if (a > b) {
                    return 1;
                }
                return 0;
            });

            // Test that the pointers do not overlap
            pointers.forEach(function(ptr, i) {
                if (pointers[i + 1]) {
                    assert.ok(pointers[i + 1] - size >= ptr);
                }
            });

        });

    });

    describe('free', function() {
        it('should return memory to the application', function() {
            var pointers = [];
            var x;
            var size = LOWEST_ORDER * 128;
            var max_ptr = HEAP_SIZE;
            while (1) {
                x = mod.malloc(size);
                if (x === 0) break;
                pointers.push(x | 0);
            }

            var freeable = pointers.shift();
            mod.free(freeable);
            assert.notEqual(x = mod.malloc(size), 0);
            assert.equal(mod.malloc(size), 0);
            assert.equal(freeable, x);

        });

        it('should compact freed memory', function() {
            var pointers = [];
            var x;
            var size = LOWEST_ORDER * 128;
            var max_ptr = HEAP_SIZE;
            while (1) {
                x = mod.malloc(size);
                if (x === 0) break;
                pointers.push(x | 0);
            }

            var freeable = pointers.shift();
            var freeable2 = pointers.shift();
            var freeable3 = pointers.shift();
            // Freeing in this order ensures that adjacency from both
            // directions will be tested.
            mod.free(freeable2);
            mod.free(freeable);
            mod.free(freeable3);

            assert.notEqual(mod.malloc(size * 3), 0);

        });

        it('should compact freed memory at the end of the free list', function() {
            // Unlike the previous test, there is no allocated memory after the
            // last freed block of memory.
            var freeable = mod.malloc(128);
            var freeable2 = mod.malloc(128);
            var freeable3 = mod.malloc(128);
            // Freeing in this order ensures that adjacency from both
            // directions will be tested.
            mod.free(freeable2);
            mod.free(freeable);
            mod.free(freeable3);

            assert.equal(mod.malloc(128), freeable);
            assert.equal(mod.malloc(128), freeable2);
            assert.equal(mod.malloc(128), freeable3);

        });

    });

    describe('calloc', function() {
        it('should set all requested memory to zero', function() {
            var pointers = [];
            var i;
            var x;
            var size = 1024 * 16;
            var max_ptr = HEAP_SIZE;
            while (1) {
                x = mod.malloc(size);
                if (x === 0) break;
                pointers.push(x | 0);

                for (i = x; i < size + x; i++) {
                    mod.view[i] = 1;
                }
            }

            pointers.forEach(function(ptr) {
                // Free the memory that was allocated.
                mod.free(ptr);
            });

            var calloced = mod.calloc(size);
            for (i = calloced; i < calloced + size; i++) {
                assert.equal(mod.view[i], 0, 'Invalid at address ' + i + ' with ' + mod.view[i]);
            }

        });

    });
});
