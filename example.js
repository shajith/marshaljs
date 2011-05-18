require('buffertools');
var fs = require('fs');
var marshal = require('./marshal.js');


function parseData(data) {
  var parser = new marshal.MarshalParser(data);
  parser.talky = false;
  var result = parser.parse();
  console.dir(result.error || result.object);
}


if(process.argv[2]) {
  fs.readFile(process.argv[2], function (err, data) {
    if (err) throw err;
    parseData(data);
  });
} else {
  var stdin = process.openStdin();
  stdin.setEncoding('utf8');
  var buf = new Buffer([]);
  stdin.on('data', function (chunk) {
    buf = buf.concat(chunk);
  });

  stdin.on("end", function() {
    parseData(buf);
  });
}
