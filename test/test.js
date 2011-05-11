var assert = require('assert');
var marshal = require('../marshal.js');
var fs = require('fs');

var data, parser, result;

data = fs.readFileSync('./dump1.bin');
parser = new marshal.MarshalParser(data);
parser.parse(function(result) {
  assert.equal("a,a", result.object.join(","));
});

