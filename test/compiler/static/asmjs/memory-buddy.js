var assert = require('assert');
var fs = require('fs');
var path = require('path');


var heapModule = fs.readFileSync(path.resolve(__dirname, '../../../../src/compiler/static/asmjs/heap.js')).toString();
var memModule = fs.readFileSync(path.resolve(__dirname, '../../../../src/compiler/static/asmjs/memory-buddy.js')).toString();


var HEAP_SIZE = 1024 * 1024;
var LOWEST_ORDER = 16;
var BUDDY_SPACE = HEAP_SIZE / LOWEST_ORDER / 4;

function getInstance() {
    var setup = [
        'var stdlib = this;',
        'var HEAP_SIZE = ' + HEAP_SIZE + ';',
        'var LOWEST_ORDER = ' + LOWEST_ORDER + ';',
        'var LOWEST_ORDER_POWER = 4;',
        'var BUDDY_SPACE = ' + BUDDY_SPACE + ';',
        'var heap = new ArrayBuffer(HEAP_SIZE + BUDDY_SPACE);', // We don't need to make this a power of two for tests.
        heapModule, // Include the heap module so we have the appropriate heap views.
    ].join('\n');

    var returns = [
        'malloc: malloc',
        '_malloc_lookup: _malloc_lookup',
        '_malloc_search: _malloc_search',
        '_malloc_toggle: _malloc_toggle',
        'calloc: calloc',
        'free: free',
        'view: memheap',
    ].join(',');

    return eval('(function() {' + setup + memModule + '\nreturn {' + returns + '}}())');
}

describe('Memory (buddy) special module', function() {

    var mod;
    beforeEach(function() {
        mod = getInstance();
    });

    describe('malloc', function() {
        it('should return the null pointer if the requested size is larger than the heap', function() {
            assert.equal(mod.malloc(HEAP_SIZE + 1), 0);
        });

        it('should return the null pointer if there is no space left', function() {
            assert.equal(mod.malloc(HEAP_SIZE), BUDDY_SPACE);
            assert.equal(mod.malloc(1), 0);
        });

        it('should return the null pointer if the requested size is zero', function() {
            assert.equal(mod.malloc(0), 0);
        });

        it('should always return pointers that are multiples of the lowest order', function() {
            for (var i = 0; i < 1024; i += 1) {
                assert.ok(mod.malloc(i) % LOWEST_ORDER === 0);
            }
        });

        it('should return only valid pointers', function() {
            var pointers = [];
            var x;
            var size = LOWEST_ORDER * 128;
            var max_ptr = HEAP_SIZE + BUDDY_SPACE;
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

    describe('_malloc_toggle', function() {
        it('should toggle bit 1 at index 0', function() {
            assert.equal(mod.view[0], 0);
            mod._malloc_toggle(0, 1);
            assert.equal(mod.view[0], 2);
            mod._malloc_toggle(0, 1);
            assert.equal(mod.view[0], 0);
        });

        it('should toggle bit 0 at index 0', function() {
            assert.equal(mod.view[0], 0);
            mod._malloc_toggle(0, 0);
            assert.equal(mod.view[0], 1);
            mod._malloc_toggle(0, 0);
            assert.equal(mod.view[0], 0);
        });

        it('should toggle bit 0 and bit 1 at index 0', function() {
            assert.equal(mod.view[0], 0);
            mod._malloc_toggle(0, 1);
            assert.equal(mod.view[0], 2);
            mod._malloc_toggle(0, 0);
            assert.equal(mod.view[0], 3);
            mod._malloc_toggle(0, 1);
            assert.equal(mod.view[0], 1);
            mod._malloc_toggle(0, 0);
            assert.equal(mod.view[0], 0);
        });

        it('should toggle bit 0 and bit 1 at index 1', function() {
            assert.equal(mod.view[0], 0);
            mod._malloc_toggle(1, 1);
            assert.equal(mod.view[0], 8);
            mod._malloc_toggle(1, 0);
            assert.equal(mod.view[0], 12);
            mod._malloc_toggle(1, 1);
            assert.equal(mod.view[0], 4);
            mod._malloc_toggle(1, 0);
            assert.equal(mod.view[0], 0);
        });

        it('should toggle bit 0 and bit 1 at index 0 and index 1', function() {
            assert.equal(mod.view[0], 0);

            mod._malloc_toggle(0, 0);
            mod._malloc_toggle(0, 1);
            mod._malloc_toggle(1, 0);
            assert.equal(mod.view[0], 7);
            mod._malloc_toggle(1, 1);
            assert.equal(mod.view[0], 15);
        });

        it('should toggle bit 1 at index 2', function() {
            assert.equal(mod.view[0], 0);
            mod._malloc_toggle(2, 1);
            assert.equal(mod.view[0], 32);
            mod._malloc_toggle(2, 1);
            assert.equal(mod.view[0], 0);
        });

        it('should toggle bit 0 at index 2', function() {
            assert.equal(mod.view[0], 0);
            mod._malloc_toggle(2, 0);
            assert.equal(mod.view[0], 16);
            mod._malloc_toggle(2, 0);
            assert.equal(mod.view[0], 0);
        });

        it('should toggle bit 1 at index 3', function() {
            assert.equal(mod.view[0], 0);
            mod._malloc_toggle(3, 1);
            assert.equal(mod.view[0], 128);
            mod._malloc_toggle(3, 1);
            assert.equal(mod.view[0], 0);
        });

        it('should toggle bit 0 at index 3', function() {
            assert.equal(mod.view[0], 0);
            mod._malloc_toggle(3, 0);
            assert.equal(mod.view[0], 64);
            mod._malloc_toggle(3, 0);
            assert.equal(mod.view[0], 0);
        });

        it('should move to the next memory location when crossing power of four thresholds', function() {
            assert.equal(mod.view[0], 0);
            assert.equal(mod.view[1], 0);
            mod._malloc_toggle(4, 0);
            assert.equal(mod.view[0], 0);
            assert.equal(mod.view[1], 1);
        });
    });

    describe('_malloc_lookup', function() {
        it('should retrieve values set with _malloc_toggle', function() {
            mod._malloc_toggle(0, 1);
            mod._malloc_toggle(1, 0);
            mod._malloc_toggle(2, 1);
            mod._malloc_toggle(3, 0);
            mod._malloc_toggle(4, 1);
            mod._malloc_toggle(5, 0);
            mod._malloc_toggle(6, 1);
            mod._malloc_toggle(7, 0);

            assert.equal(mod._malloc_lookup(0, 1), 1);
            assert.equal(mod._malloc_lookup(0, 0), 0);
            assert.equal(mod._malloc_lookup(1, 0), 1);
            assert.equal(mod._malloc_lookup(1, 1), 0);
            assert.equal(mod._malloc_lookup(2, 1), 1);
            assert.equal(mod._malloc_lookup(2, 0), 0);
            assert.equal(mod._malloc_lookup(3, 0), 1);
            assert.equal(mod._malloc_lookup(3, 1), 0);
            assert.equal(mod._malloc_lookup(4, 1), 1);
            assert.equal(mod._malloc_lookup(4, 0), 0);
            assert.equal(mod._malloc_lookup(5, 0), 1);
            assert.equal(mod._malloc_lookup(5, 1), 0);
            assert.equal(mod._malloc_lookup(6, 1), 1);
            assert.equal(mod._malloc_lookup(6, 0), 0);
            assert.equal(mod._malloc_lookup(7, 0), 1);
            assert.equal(mod._malloc_lookup(7, 1), 0);
        });
    });

    describe('free', function() {
        it('should return memory to the application', function() {
            var pointers = [];
            var x;
            var size = LOWEST_ORDER * 128;
            var max_ptr = HEAP_SIZE + BUDDY_SPACE;
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

    });

    describe('calloc', function() {
        it('should set all requested memory to zero', function() {
            var pointers = [];
            var i;
            var x;
            var size = 1024 * 16;
            var max_ptr = HEAP_SIZE + BUDDY_SPACE;
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
