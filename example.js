var fs = require('fs');
var marshal = require('./marshal.js');

fs.readFile(process.argv[2] || 'dump.bin', function (err, data) {
  if (err) throw err;
  console.log(data);
  var parser = new marshal.MarshalParser(data);
  var result = parser.parse(function(status) { console.dir(status);});
  console.dir(result);
  console.dir(result.object);
});
