var assert = require('assert');
var fs = require('fs');
var path = require('path');


var memModule = fs.readFileSync(path.resolve(__dirname, '../../../../src/compiler/static/asmjs/memory.js')).toString();

function getInstance() {
    var setup = [
        'var stdlib = this;',
        'var HEAP_SIZE = 1024 * 1024;',
        'var LOWEST_ORDER = 16;',
        'var LOWEST_ORDER_POWER = 4;',
        'var BUDDY_SPACE = HEAP_SIZE / LOWEST_ORDER / 4;',
        'var heap = new ArrayBuffer(HEAP_SIZE + BUDDY_SPACE);',
    ].join('\n');

    var returns = [
        'malloc: malloc',
        '_malloc_lookup: _malloc_lookup',
        '_malloc_search: _malloc_search',
        '_malloc_toggle: _malloc_toggle',
        'free: free',
        'view: memheap',
    ].join(',');

    return eval('(function() {' + setup + memModule + '\nreturn {' + returns + '}}())');
}

describe('Memory special module', function() {

    var mod;
    beforeEach(function() {
        mod = getInstance();
    });

    describe('malloc', function() {
        //
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
        //
    });
});
