var fs = require('fs');
var marshal = require('./marshal.js');

fs.readFile(process.argv[2] || './test/dump.bin', function (err, data) {
  if (err) throw err;
  var parser = new marshal.MarshalParser(data);
  var result = parser.parse(function(result) {
    console.dir(result.object);
  });
});
