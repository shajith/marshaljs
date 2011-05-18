var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var marshal = require('../marshal.js');
require('buffertools');

var TestQueue = function() {
  this.tests = [];
};

TestQueue.prototype = {
  addTest: function(testFunc) {
    this.tests.push(testFunc);
  },

  runNextTest: function() {
    var test = this.tests.shift();
    if(test) {
      test(this.runNextTest.bind(this));
    } else {
      asyncSpecDone();
    }
    return ;
  },

  run: function() {
    this.runNextTest();
    asyncSpecWait();
  }
};

function parserTest(rubyObj, expected, tester) {
  return function(callback) {
    var proc = spawn("ruby", ["-e", "STDOUT.write(Marshal.dump(" + rubyObj + "))"]);
    var buf = new Buffer([]);
    proc.stdout.on("data", function(chunk) {
      buf = buf.concat(chunk);
    });

    proc.on("exit", function() {
      var parser = new marshal.MarshalParser(new Buffer(buf));
      var parsed = parser.parse();
      expect(parsed.error).toBeUndefined();
      if(tester) {
        tester(parsed.object, expected);
      } else {
        expect(parsed.object).toEqual(expected);
      }
      callback();
    });
  };
}

describe("basic data types", function() {
  var min, max;
  beforeEach(function() {
    min = -1000;
    max = 1000;
  });

  it("should parse fixnums", function() {
    var queue = new TestQueue();
    for(var i=min; i<=max; i=i+50) {
      queue.addTest(parserTest(i, i));
    }
    queue.run();
  });

  it("should parse bignums", function() {
    var queue = new TestQueue();
    queue.addTest(parserTest(1305595420, 1305595420));

    queue.run();
  });

  it("should parse floats", function() {
    var queue = new TestQueue();
    for(var i=min; i<=max; i=i+50.7) {
      queue.addTest(parserTest(i, i));
    }
    queue.run();
  });

  it("should parse strings", function() {
    var queue = new TestQueue();
    queue.addTest(parserTest("''", ""));
    queue.addTest(parserTest("'foo'", "foo"));
    queue.addTest(parserTest('"foo\nbar"', "foo\nbar"));
    queue.run();
  });

  it("should parse arrays", function() {
    var queue = new TestQueue();
    queue.addTest(parserTest("[]", []));
    queue.addTest(parserTest("[1]", [1]));
    queue.addTest(parserTest("['a']", ['a']));
    queue.addTest(parserTest("[1.5]", [1.5]));
    queue.addTest(parserTest('[[]]', [[]]));

    queue.addTest(parserTest('[[], 1, "a", 1.5]', [[], 1, "a", 1.5]));

    queue.run();
  });

  it("should parse hashes", function() {
    var makeHash = function(k, v) {
      var h = {};
      h[k] = v;
      return h;
    };

    var queue = new TestQueue();
    queue.addTest(parserTest("{}", {}));

    queue.addTest(parserTest("{2 => 1}", makeHash(2, 1)));

    queue.addTest(parserTest("{'a' => 'b'}", {a: 'b'}));

    queue.addTest(parserTest("{'a' => 1}", {a: 1}));
    queue.addTest(parserTest("{1 => 'a'}", makeHash(1, 'a')));

    queue.addTest(parserTest("{'a' => [1]}", {a: [1]}));
    queue.addTest(parserTest("{[1] => 'a'}", makeHash([1], 'a')));


    queue.addTest(parserTest("{'a' => {}}", {a: {}}));
    queue.addTest(parserTest("{{} => {}}", makeHash({}, {})));

    queue.run();
  });

  it("should parse symbols", function() {
    var queue = new TestQueue();
    queue.addTest(parserTest(":a", 'a'));
    queue.addTest(parserTest("[:a, :a, :b]", ['a', 'a', 'b']));

    queue.addTest(parserTest("{:a => 1, :b => :a}", {a: 1, b: 'a'}));

    queue.run();
  });

  it("should parse true, false and nil", function() {
    var queue = new TestQueue();
    queue.addTest(parserTest("true", true));
    queue.addTest(parserTest("false", false));
    queue.addTest(parserTest("nil", null));

    queue.run();

  });

  it("should parse regexps", function() {
    var regexpEquals = function(a, b) {
      return a.source     === b.source &&
             a.global     === b.global &&
             a.ignoreCase === b.ignoreCase &&
             a.multiline  === b.multiline;
    };

    var tester = function(result, expected) {
      expect(regexpEquals(result, expected)).toBe(true);
    };

    var queue = new TestQueue();
    queue.addTest(parserTest("//", new RegExp(""), tester));
    queue.addTest(parserTest("/a.*/", new RegExp("a.*"), tester));

    queue.run();
  });

  it("should parse instances of subclasses of builtins", function() {
    var makeObj = function(obj, className) {
      obj.__ruby_class__ = {type: 'Class', name: className};
      return obj;
    };

    var queue = new TestQueue();
    queue.addTest(parserTest("begin;class A<Array;end;a=A.new;end", makeObj([], 'A')));

    queue.addTest(parserTest("begin;class A<Hash;end;a=A.new;end", makeObj({}, 'A')));

    queue.run();

  });

  it("should parse class and module objects", function() {
    var queue = new TestQueue();
    var makeClass = function(name, className) {
      var obj = {};
      obj.__ruby_class__ = {type: className || name, name: className || name};
      obj.name = name || className;
      return obj;
    };

    queue.addTest(parserTest("Module", makeClass("Module", "Class")));
    queue.addTest(parserTest("Class", makeClass("Class", "Class")));

    queue.addTest(parserTest("Kernel", makeClass("Kernel", "Module")));

    queue.run();

  });

  it("should parse instances of user defined classes", function() {
    var makeObj = function(obj, className) {
      obj.__ruby_class__ = {type: 'Class', name: className};
      return obj;
    };

    var queue = new TestQueue();
    queue.addTest(parserTest("begin;class A;attr_accessor :b, :c;end;a=A.new;a.b=1;a.c=2;a;end", makeObj({'@b': 1, '@c': 2}, 'A')));

    queue.run();

  });

  it("should parse typical rails session cookie", function() {

    var queue = new TestQueue();
    var rubySession = '{:updated_at=>1305595420, :_csrf_token=>"HXsQwCGswXjQMkUjey3ifDuSDxHzK3+QQ7Yo4p1LjVdA=", :source_page=>"/home?", "warden.user.default.key"=>7, :account=>2, :session_id=>"f64fde5a128e119a69d919db77ff12662", "warden.message"=>{}, "flash"=>{:notice=>"Welcome back, Agent Extraordinaire"}, :id=>"cqed473ua-kzv6lw"}';

    var jsSession =  {
      updated_at: 1305595420,
      _csrf_token: "HXsQwCGswXjQMkUjey3ifDuSDxHzK3+QQ7Yo4p1LjVdA=",
      source_page: "/home?",
      "warden.user.default.key": 7,
      account: 2,
      session_id: "f64fde5a128e119a69d919db77ff12662",
      "warden.message": {},
      flash: {
        notice: "Welcome back, Agent Extraordinaire"
      },
      id: "cqed473ua-kzv6lw"
    };

    queue.addTest(parserTest(rubySession, jsSession));

    queue.run();


  });
});