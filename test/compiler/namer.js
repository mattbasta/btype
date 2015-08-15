'use strict';
require('babel/register')({stage: 0});


var assert = require('assert');

var namer = require('../../src/compiler/namer');


describe('namer', function() {

    it('should generate unique names always', function() {
        var n = namer();
        var data = {};
        var name;
        for (var i = 0; i < 10000; i++) {
            name = n();
            assert.ok(!(name in data));
            data[name] = true;
        }
    });

});
