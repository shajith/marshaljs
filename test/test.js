var assert = require('assert');
var marshal = require('../marshal.js');
var fs = require('fs');

var data, parser, result;

data = fs.readFileSync('./dump1.bin');
parser = new marshal.MarshalParser(data);
result = parser.parse(function(status) { console.dir(status);});
assert.equal("a,a", result.object.join(","));
