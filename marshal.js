var MarshalParser = function(data){
  this.data = data;
  this.position = 0;
  this.talky = false;
  this.state = {};
};

MarshalParser.prototype = {
  log: function(str) {
    if(this.talky)
      console.log(str);
  },

  parse: function(callback) {
    this.callback = callback;
    this.parseResult = {};
    var majorVersion = this.consumeByte();
    var minorVersion = this.consumeByte();
    if(majorVersion != 4 || minorVersion != 8) {
      this.end({error: 'Invalid version'});
      return false;
    }

    this.parseResult.majorVersion = majorVersion;
    this.parseResult.minorVersion = minorVersion;
    this.parseResult.object = this.consumeObject();
    if(!this.state.error) {
      callback(this.parseResult);
    }

    return true;
  },

  consumeObject: function() {
    var nextByte = this.consumeByte();
    if(!nextByte) {
      this.end({error: 'Input ran out'});
      return false;
    }
    lookingFor = this.type(nextByte);
    this.log("type: " + lookingFor);
    if(!lookingFor) {
      this.end({error: "Unknown type: " + nextByte});
      return null;
    }

    switch(lookingFor) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'nil':
      return null;
    case 'Symbol':
      return this.consumeString();
    case 'String':
      return this.consumeString();
    case 'Array':
      return this.consumeArray();
    case 'Hash':
      return this.consumeHash();
    case 'Fixnum':
      return this.consumeLong();
    }
  },

  type: function(typeKey) {
    switch(typeKey) {
    case 34:
      return 'String';
    case 91: //[
      return 'Array';
    case 123: //{
      return 'Hash';
    case 105: //i
      return 'Fixnum';
    case 84: //T
      return 'true';
    case 70: //F
      return 'false';
    case 48: //0
      return 'nil';
    case 58: //:
      return 'Symbol';
    }
  },

  consumeByte: function() {
    var byte = this.data[this.position];
    this.position++;
    this.log("consuming byte: " + byte);
    return byte;
  },

  consumeBytes: function(num) {
    var bytes = [];
    while(num > 0) {
      bytes.push(this.consumeByte());
      num--;
    }
    this.position = this.position + num;
    return bytes;
  },

  consumeLong: function() {
    var b = this.consumeByte();
    if(b === 0)
      return 0;
    if( (b >=6) && (b <= 127) )
      return b - 5;
    if( (b >= 1) && (b <= 4) ) {
      var bytes = this.consumeBytes(b);
      return this.convertToInteger(bytes);
    }
    if( (b <= -6) && (b >= -128) ) {
      return b + 5;
    }
  },

  consumeString: function() {
    var len = this.consumeLong();
    var str = this.data.toString('utf8', this.position, this.position + len);
    this.position = this.position + len;
    return str;
  },

  consumeArray: function() {
    var length = this.consumeLong();
    this.log("Array length: " + length);
    var arr = [];
    for(var i = 0; i < length; i++) {
      var obj = this.consumeObject();
      arr.push(obj);
    }

    return arr;
  },

  consumeHash: function() {
    var length = this.consumeLong();
    var hash = {};
    for(var i = 0; i < length; i++) {
      var key = this.consumeObject();
      var value = this.consumeObject();
      hash[key] = value;
    }
    return hash;
  },

  convertToInteger: function(bytes) {
    var buf = new Buffer(bytes);
    var vars = Binary.parse(buf)
      .word16lu('len')
      .vars
    ;
    return vars.len;
  },

  end: function(state) {
    this.state.error = state.error;
    this.callback(state);
  }


};

exports.MarshalParser = MarshalParser;

