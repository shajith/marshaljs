var fs = require('fs');
var marshal = require('./marshal.js');

function parseData(data) {
    var parser = new marshal.MarshalParser(data);
    var result = parser.parse(function(result) {
      console.dir(result.error || result.object);
    });
}

if(process.argv[2]) {
  fs.readFile(process.argv[2], function (err, data) {
    if (err) throw err;
    parseData(data);
  });
} else {
  var stdin = process.openStdin();
  stdin.setEncoding('utf8');
  stdin.on('data', function (chunk) {
    parseData(new Buffer(chunk));
  });
}
