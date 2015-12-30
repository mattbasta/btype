import * as assert from 'assert';

import NamerFactory from '../../src/compiler/namer';


describe('namer', function() {

    it('should generate unique names always', function() {
        var n = NamerFactory();
        var data = new Set();
        for (var i = 0; i < 10000; i++) {
            let name = n();
            assert.ok(!data.has(name));
            data.add(name);
        }
    });

});
