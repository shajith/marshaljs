var MarshalParser = function(data){
  this.data = data;
  this.position = 0;
  this.talky = false;
  this.symbolTable = {};
  this.table = {};
  this.count = 0;
};

MarshalParser.prototype = {
  log: function(str) {
    if(this.talky)
      console.log(str);
  },

  dir: function(str) {
    if(this.talky)
      console.dir(str);
  },

  parse: function(callback) {
    this.callback = callback;
    this.parseResult = {};

    try {
      var majorVersion = this.consumeByte();
      var minorVersion = this.consumeByte();
      if(majorVersion != 4 || minorVersion != 8) {
        throw {marshalParseError: 'Invalid version'};
      }

      this.parseResult.majorVersion = majorVersion;
      this.parseResult.minorVersion = minorVersion;
      this.parseResult.object = this.consumeObject({objectTable: {}});

      return this.parseResult;
    } catch(error) {
      if(error.marshalParseError) {
        this.parseResult.error = error.marshalParseError;
        return this.parseResult;
      } else {
        throw error;
      }
    }
  },

  consumeObject: function() {
    var nextByte = this.consumeByte();
    if(!nextByte) {
      throw {marshalParseError: 'Input ran out'};
    }

    lookingFor = this.type(nextByte);
    this.log("type: " + lookingFor);

    if(!lookingFor) {
      throw {marshalParseError: "Unknown type: " + nextByte};
    }

    var obj = (function() {
      switch(lookingFor) {
      case 'true':
        return true;
      case 'false':
        return false;
      case 'nil':
        return null;
      case 'Symbol':
        return this.consumeSymbol();
      case 'String':
        return this.consumeString();
      case 'Array':
        return this.consumeArray();
      case 'Hash':
        return this.consumeHash();
      case 'Fixnum':
        return this.consumeLong();
      case 'UClass':
        return this.consumeUClass();
      case 'Float':
      return this.consumeFloat();
      case 'Regexp':
        return this.consumeRegexp();
      case 'SymLink':
        return this.consumeSymLink();
      case 'Link':
        return this.consumeLink();
      case 'Struct':
        return this.consumeStructInstance();
      case 'Object':
        return this.consumeKlassInstance();
      case 'WithIvars':
        return this.consumeWithIvars();
      case 'Class':
        return this.consumeClass();
      case 'Module':
        return this.consumeModule();
      case 'Bignum':
        return this.consumeBignum();

      }
    }).apply(this);

    return obj;
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
    case 67: //c
      return 'UClass';
    case 102: //f
      return 'Float';
    case 47: ///
      return 'Regexp';
    case 59: //;
      return 'SymLink';
    case 64: //@
      return 'Link';
    case 83: //S
      return 'Struct';
    case 111: //o
      return 'Object';
    case 73: //I
      return 'WithIvars';
    case 99: //c
      return 'Class';
    case 109: //m
      return 'Module';
    case 108: //l
      return 'Bignum';

    }
  },

  _add: function(obj) {
    this.table[this.count] = obj;
    this.count++;
    return obj;
  },

  consumeByte: function() {
    var byte = this.data[this.position] | 0;
    this.position++;
    this.log("consuming byte: " + byte);
    return byte;
  },

  consumeUClass: function() {
    var symbolKey = this.consumeByte();
    var className = this.consumeString();
    var obj = this.consumeObject();
    obj.__ruby_class__ = {type: 'Class', name: className};
    return obj;
  },

  consumeStructInstance: function() {
    var structName = this.consumeObject();
    var len = this.consumeLong();
    this.log("Struct len: " + len);
    var obj = {};
    obj.__ruby_class__ = {type: 'Struct', name: structName};

    this._add(obj);

    var k, v;
    for(var i=0; i<len; i++) {
      k = this.consumeObject();
      v = this.consumeObject();
      if(v === undefined) { v = null;}
      obj[k] = v;
    }

    return obj;
  },

  consumeKlassInstance: function() {
    var className = this.consumeObject();
    var ivarCount = this.consumeLong();
    var obj = {};
    obj.__ruby_class__ = {type: 'Class', name: className};

    this._add(obj);

    var k, v;
    for(var i=0; i<ivarCount; i++) {
      k = this.consumeObject();
      v = this.consumeObject();
      obj[k]=v;
    }

    return obj;
  },

  consumeWithIvars: function() {
    var obj = this.consumeObject();
    var ivars = this.consumeIvars();
    obj.__ruby_ivars__ = ivars;
    return obj;
  },

  consumeIvars: function() {
    var len = this.consumeLong();
    var ivars = {}, k, v;
    for(var i=0; i<len; i++) {
      k = this.consumeObject();
      v = this.consumeObject();
      ivars[k] = v;
    }
    return ivars;
  },

  consumeClass: function() {
    var obj = {};
    var className = this._consumeStr();
    obj.__ruby_class__ = {type: 'Class', name: 'Class'};
    obj.name = className;

    return this._add(obj);
  },

  consumeModule: function() {
    var obj = {};
    var moduleName = this._consumeStr();
    obj.__ruby_class__ = {type: 'Module', name: 'Module'};
    obj.name = moduleName;

    return this._add(obj);
  },

  consumeRegexp: function() {
    var pattern = this._consumeStr();
    var _bytes = this.consumeByte();
    return this._add(new RegExp(pattern));
  },

  consumeFloat: function() {
    var length = this.consumeLong();
    var bytes = this.consumeBytes(length);
    var str = new Buffer(bytes).toString();

    switch(str) {
    case "nan":
      return NaN;
    case "inf":
      return Infinity;
    case "-inf":
      return -Infinity;
    default:
      return parseFloat(str);
    }
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
    var c = this.consumeByte();
    var num, b, i;

    if(c === 0)
      return 0;

    if (4 < c && c < 128) {
      return c - 5;
    }

    if (c <= 4) {
      num = 0;
      for(i = 0; i < c; i++) {
        b = this.consumeByte();
        num = num + b * Math.pow(2, i*8);
      }
      return num;
    }

    //number is negative if we get here
    c = (0xff - c + 1) * -1; //convert to signed integer

    if (-129 < c && c < -4) {
      return c + 5;
    }
    c = -c;
    num = -1;
    for(i=0;i<c;i++) {
      num &= ~(0xff << (8*i));
      num |= (this.consumeByte() << (8*i));
    }
    return num;
  },

  consumeBignum: function() {
    var sign = this.consumeByte();
    if(sign == 45)
      sign = -1;
    else
      sign = +1;

    var len = this.consumeLong() * 2;
    var bytes = this.consumeBytes(len);
    var num = 0, shift = 0;
    for(var i=0; i<len; i++) {
      num |= (bytes[i] << shift);
      shift += 8;
    }

    return sign * num;
  },

  _consumeStr: function() {
    var len = this.consumeLong();
    var str = this.data.toString('utf8', this.position, this.position + len);
    this.position = this.position + len;
    this.log("consuming string: " + str);
    return str;
  },

  consumeString: function() {
    var str = this._consumeStr();
    return this._add(str);
  },

  consumeSymbol: function() {
    var sym = this._consumeStr();
    this.addToSymbolTable(sym);
    return sym;
  },

  addToSymbolTable: function(val) {
    var count = 0;
    var table = this.symbolTable;
    for(var key in table) {
      var curVal = table[key];
      if(curVal == val) { return; }
      count++;
    }

    table[count] = val;
  },

  consumeSymLink: function() {
    var key = this.consumeLong();
    return this.symbolTable[key || 0];
  },

  consumeLink: function() {
    var key = this.consumeLong();
    this.log("Fetching key: " + key);
    return this.table[key];
  },

  consumeArray: function(level) {
    var length = this.consumeLong();
    this.log("Array length: " + length);
    var arr = [];

    this._add(arr);

    for(var i = 0; i < length; i++) {
      var obj = this.consumeObject();
      arr.push(obj);
    }

    return arr;
  },

  consumeHash: function() {
    var length = this.consumeLong();
    var hash = {};

    this._add(hash);

    for(var i = 0; i < length; i++) {
      var key = this.consumeObject();
      var value = this.consumeObject();
      hash[key] = value;
    }
    return hash;
  }
};

exports.MarshalParser = MarshalParser;

