(function(scope) {

var testit = function() {
    /**
     * group class, which will contain tests
     * In addition, it will be used for wrapping some wrong code from falling.
     * @constructor
     * @private
     * @attribute {String} type         type of object ('group' or 'test')
     * @attribute {String} name         name of group
     * @attribute {String} status       indicate results of all test in group ('pass','fail','error')
     * @attribute {String} comment      text specified by user
     * @attribute {Error}  error        contain error object if some of tests throw it
     * @attribute {Number} time         time in ms spend on code in group
     * @attribute {Object} result       counters for tests and groups
     * @attribute {array}  stack        array of tests and groups
     */
    var group = function() {
        this.type = 'group';
        this.name = undefined;
        this.status = undefined;
        this.comment = undefined;
        this.error = undefined;
        this.time = 0;
        this.result = {
            pass: 0,
            fail: 0,
            error: 0,
            total: 0
        };
        this.stack = [];
    }

    /**
     * test class, which will contain result and some more info about one test
     * @constructor
     * @private
     * @attribute {String} type         type of object ('group' or 'test')
     * @attribute {String} status       indicate results of test ('pass','fail','error')
     * @attribute {String} comment      text specified by user
     * @attribute {String} description  text generated by script
     * @attribute {Error}  error        contain error object if test can throw it without falling
     * @attribute {Number} time         time in ms spend on test
     * @attribute {Array}  argument     all received arguments
     */
    var test = function() {
        this.type = 'test';
        this.status = undefined;
        this.comment = undefined;
        this.description = undefined;
        this.error = undefined;
        // this.time = new Date().getTime();
        this.argument = [];
    }

    /**
     * main group
     * @public
     * @type {group}
     */
    var root = new group();
    this.root = root;
    root.name = 'root';
    root.time = new Date().getTime();

    /**
     * make new instace of group, fill it, add it into previous group.stack, fill some values in previous group
     * It will be called thrue _makeGroup.call(); this - current level group (can be root)
     * @private
     * @chainable
     * @param  {String}   name          name of new group
     * @param  {Function} fun           function witch will be tryed to execute (commonly consist of tests and other groups)
     * @return {Object}                     test with link
     */
    var _makeGroup = function(name,fun) {
        /** get timestamp */
        var time = new Date().getTime();
        
        /** var for the new instance of group */
        var newgroup;
        /** identify new group */
        var groupAlreadyExist = false;
        /** find group in current-level stack */
        for (var i in this.stack) {
            if (this.stack[i].type !== 'group') continue;
            if (this.stack[i].name === name) {
                newgroup = this.stack[i];
                groupAlreadyExist = true;
                break;
            }
        }
        if (!groupAlreadyExist) newgroup = new group();
        newgroup.name = name;

        /** add backlink to provide trek back */
        newgroup.linkBack = this;

        /** set to pass as default. it's may be changed in some next lines */
        var oldstatus;
        if (groupAlreadyExist) oldstatus = newgroup.status;
        newgroup.status ='pass';

        /**
         * try to execute code with tests and other groups in it
         * This part provide nesting.
         * for this reason there are redefinition of root
         */
        try {
            var oldRoot = root;
            root = newgroup;
            fun();
            root = oldRoot;
        } catch(e) {
            newgroup.status = 'error';
            newgroup.error = generateError(e);
        }

        /** update time */
        newgroup.time += new Date().getTime() - time;

        /** finally place this group into previous level stack (if it's a new group) */
        if (!groupAlreadyExist) this.stack.push(newgroup);

        /** update counters */
        updateCounters(newgroup);

        /** return testit with link to this group to provide chaining */
        return newgroup;
    }
    /**
     * return group by it's name in current level group stack
     * It will be called thrue _getGroup.call(); this - current level group (can be root)
     * @private
     * @param  {String} name    name of group which will be searched for
     * @return {Object}         group
     */
    var _getGroup = function (name) {
        var stack = this.stack;
        for (var i in stack) {
            if (stack[i].type !== 'group') continue;
            if (stack[i].name === name) {
                return stack[i];
            }
        }
        throw new ReferenceError('there are no group with name: '+name);
    }
    /**
     * Define wich group() method must be called.
     * Produce chaining
     * @private
     * @param  {String}   name      name of group
     * @param  {Function} fun       function contains tests and other groups
     * @return {Object}             testit object with link to specified group (produce chaining)
     */
    var _group = function(name,fun) {
        /**
         * There may be 3 situation:
         *     this.link is root && root is root                - test.group() called in root scope
         *     this.link is root && root is some group          - test.group() called in some other group scope
         *     this.link is some group && root is root          - .group() called in chain
         *     this.link is some group && root is some group    - .group() called in chain in some other group scope
         * look at it with:
         *     console.log(name,'\nlink: ',this.link,'\nroot: ',root);
         */
        var currentLevel = (this.link.name!=='root')?this.link:root;
        var returnedValue;

        switch (arguments.length) {
            case 0 : throw new RangeError("test.group expect at least 1 argument");
            case 1 : {
                    returnedValue = _getGroup.call(currentLevel,name);
                } break;
            case 2 : {
                    returnedValue = _makeGroup.call(currentLevel,name,fun);
                } break;
            default : throw new RangeError("test.group expect maximum of 2 arguments");
        }

        return Object.create(this,{link:{value:returnedValue}});
    }
    /**
     * public interface for _makeGroup
     * @public
     * @example
     *  test.group('name of group',function(){
     *      test.it('nested test');
     *      test.group('nested group',function(){
     *          test.it('deep nested test');
     *      });
     *  });
     */
    this.group = _group;


    var _doTest = function (type,args) {
        /**
         * making a new instance of test
         * Most of code in this function will manipulate whis it.
         */
        var newtest = new test();

        /** fill test.agrument from method arguments */
        newtest.argument = Array(args);



        /** finally place this test into container stack */
        root.stack.push(newtest);

        /** update counters of contained object */
        updateCounters(root);

        /** return testit with link to this test to provide chaining */
        return Object.create(this,{link:{value:newtest}});
    }
    this.doit = function(){return _doTest.call(this,'it',arguments)};

    /**
     * basic test. Make new instance of test, fill it, add it to previous group.stack, fill some values in previous group
     * @private
     * @chainable
     * @param  {Multiple} a @required       first argument, which will check for truth it only transmitted
     * @param  {Multiple} b                 second argument which will compared with a if transmitted 
     * @return {Object}                     test with link
     */
    var _it = function(a,b) {
        /**
         * making a new instance of test
         * Most of code in this function will manipulate whis it.
         */
        var newtest = new test();

        /**
         * fill newtest.argument with arguments
         * (arguments is array-like object, but not array. So i can't just  newtest.argument = newtest.argument.concat(arguments); or newtest.argument = arguments)
         */
        for (var i in arguments) {
            newtest.argument.push(arguments[i]);
        }
        /** try to figure out what kind of test expected */
        switch (arguments.length) {
            /** in case of no arguments - throw Reference error */
            case 0 : {
                newtest.status = 'error';
                newtest.error = generateError(new RangeError("at least one argument expected"));
            } break;
            /** if there only one argument - test it for truth */
            case 1 : {
                testNonFalse(newtest,[a]);
            } break;
            /** if there are two arguments - test equalence between them */
            case 2 : {
                testEquivalence(newtest,[a,b]);
            } break;
            /** otherwise throw Range error */
            default : {
                newtest.status = 'error';
                newtest.error = generateError(new RangeError("too much arguments"));
            }
        }
        // console.log(2, root);
        /** finally place this test into container stack */
        root.stack.push(newtest);

        /** update counters of contained object */
        updateCounters(root);

        /** return testit with link to this test to provide chaining */
        return Object.create(this,{link:{value:newtest}});
    }
    /**
     * public interface for _it()
     * @public
     * @example
     *   test.it(someThing);
     *   test.it(myFunction());
     *   test.it(myVar>5);
     *   test.it(myVar,mySecondVar);
     */
    this.it = _it;

    /**
     * test array of values for non-false
     * @private
     * @chainable
     * @param  {Array} args     array of values which will be tested
     * @return {Object}         test with link
     */
    var _them = function(args) {
        /**
         * making a new instance of test
         * Most of code in this function will manipulate whis it.
         */
        var newtest = new test();
        
        for (var i in arguments) {
            newtest.argument.push(arguments[i]);
        }

        /** throw error if argument is not array */
        if (arguments.length === 0 || arguments.length > 1) {
            newtest.status = 'error';
            newtest.error = generateError(new RangeError("test.them expects exactly 1 argument"));
        } else if (_typeof(args) !== 'Array') {
            newtest.status = 'error';
            newtest.error = generateError(new TypeError("test.them expects to receive an array"));
        } else {
            testNonFalse(newtest,args);
        }

        /** finally place this test into container stack */
        root.stack.push(newtest);

        /** update counters of contained object */
        updateCounters(root);

        /** return testit with link to this test to provide chaining */
        return Object.create(this,{link:{value:newtest}});
    }
    /**
     * public interface for _them()
     * @public
     * @example
     *   test.them([1,'a',true,window]);
     */
    this.them = _them;

    /**
     * test type of first argument (value) to be equal to secon argument
     * @private
     * @chainable
     * @param  {Multiple} value     will be tested
     * @param  {[type]} type        type to compare with
     */
    var _type = function(value,type) {
        /**
         * making a new instance of test
         * Most of code in this function will manipulate whis it.
         */
        var newtest = new test();
        /**
         * fill newtest.argument with arguments
         * (arguments is array-like object, but not array. So i can't just  newtest.argument = newtest.argument.concat(arguments); or newtest.argument = arguments)
         */
        for (var i in arguments) {
            newtest.argument.push(arguments[i]);
        }
        /** throw error if there are not 2 arguments */
        
        if (arguments.length!==2) {
            newtest.status = 'error';
            newtest.error = generateError(new RangeError("test.type expect two arguments"));
        } else if (_typeof(type) !== 'String') {
            newtest.status = 'error';
            newtest.error = generateError(new TypeError("second argument must be a String"));
        } else if (!arrayConsist(identifiedTypes,type.toLowerCase())) {
            newtest.status = 'error';
            newtest.error = generateError(new TypeError("second argument must be a standart type"));
        } else {
            testType(newtest,[value],type);
        }

        /** finally place this test into container stack */
        root.stack.push(newtest);

        /** update counters of contained object */
        updateCounters(root);

        /** return testit with link to this test to provide chaining */
        return Object.create(this,{link:{value:newtest}});
    }
    /**
     * public interface for _type()
     * @public
     * @example
     *   test.type('asd','String');
     */
    this.type = _type;

    /** 
     * compare types of all values in args between each other and 'type' if defined
     * @private
     * @chainable
     * @param  {Array} args         array of values which will be tested
     * @param  {String} type        type which will be compared whith
     */
    var _types = function(args,type) {
        /**
         * making a new instance of test
         * Most of code in this function will manipulate whis it.
         */
        var newtest = new test();
        /**
         * fill newtest.argument with arguments
         * (arguments is array-like object, but not array. So i can't just  newtest.argument = newtest.argument.concat(arguments); or newtest.argument = arguments)
         */
        for (var i in arguments) {
            newtest.argument.push(arguments[i]);
        }
        /** throw error if there are not 2 arguments */
        if (arguments.length>2) {
            newtest.status = 'error';
            newtest.error = generateError(new RangeError("test.types expect maximum of two arguments"));
        } else if (_typeof(args) !== 'Array') {
            newtest.status = 'error';
            newtest.error = generateError(new TypeError("test.types expect array in first argument"));
        } else if (type) {
            if (_typeof(type) !== 'String') {
                newtest.status = 'error';
                newtest.error = generateError(new TypeError("second argument must be a String"));
             } else if (!arrayConsist(identifiedTypes,type.toLowerCase())) {
                newtest.status = 'error';
                newtest.error = generateError(new TypeError("second argument must be a standart type"));
            } else {
                testType(newtest,args,type);
            }
        } else if (args.length<2) {
            newtest.status = 'error';
            newtest.error = generateError(new RangeError("test.types expect array with minimum 2 values, if second argument not defined"));
        } else {
            testType(newtest,args);
        }

        /** finally place this test into container stack */
        root.stack.push(newtest);

        /** update counters of contained object */
        updateCounters(root);

        /** return testit with link to this test to provide chaining */
        return Object.create(this,{link:{value:newtest}});
    }
    /**
     * public interface for _types
     * @public
     * @example
     *   test.type([1,2,3],'Number');
     */
    this.types = _types;

    /**
     * Test types of all values in args
     * @private
     * @param  {Objcet} test    will be updated
     * @param  {Array}  args    consist values which types will be tested
     * @param  {[type]} type    consist type which will be compared with
     */
    var testType = function(test,args,type) {
        test.description = 'type of argument is ';

        if (!type) type = _typeof(args[0]);

        for (arg in args) {
            if (_typeof(args[arg]).toLowerCase() !== type.toLowerCase()) {
                test.description += 'not '+type;
                test.status = 'fail';
                return
            }
        }

        test.description += type;
        test.status = 'pass';
    }

    /**
     * Test all values in args for non-false
     * @private
     * @param  {Objcet} test    will be updated
     * @param  {Array}  args    consist values which will be tested
     */
    var testNonFalse = function(test,args) {
        /** use different text when one and multiple values are tested */
        test.description = (args.length===1)? 'argument is not ':'arguments is not ';

        /** test every value in args */
        for (arg in args) {
            if (!args[arg]) {
                test.description += 'true';
                test.status = 'fail';
                return;
            }
        }

        /** if code not stopped in previous step, test passed */
        test.description += 'false';
        test.status = 'pass';
    }

    /**
     * Test all values in args for equivalence
     * @private
     * @param  {Objcet} test    will be updated
     * @param  {Array}  args    consist values which will be tested
     */
    var testEquivalence = function(test,args) {
        /** first value will be used as model in comparissons */
        var model = args.shift();

        /** compare all types of values in args with type of model */
        var type = _typeof(model);
        for (arg in args) {
            if (_typeof(args[arg]) !== type) {
                test.status = 'fail';
                test.description = 'arguments has different types';
                return;
            }
        }

        /** compare all values in args with model */
        for (arg in args) {
            if (!deepCompare(model,args[arg])) {
                test.description = 'arguments are not equal';
                test.status = 'fail';
                return;
            }
        }

        /** if code not stopped earlier, test passed */
        test.description = 'arguments are equal';
        test.status = 'pass';
    }

    /**
     * add comment for the linked test or group
     * @private
     * @chainable
     * @type {Function}
     * @param  {String} text        user defined text, which will be used as a comment
     */
    var _comment = function(text) {
        /** add comment, if there are something can be commented */
        if (!this.link) throw new ReferenceError('comment can only be used in testit chain');
        this.link.comment = text;

        return this;
    }
    /**
     * public interface for _comment()
     * @public
     * @example
     *   test.group('group name',function(){
     *      test
     *          .it(someThing)
     *          .comment('comment to test');
     *   }).comment('comment to group');
     */
    this.comment = _comment;

    /**
     * try to execute functions in arguments, depend on test|group result
     * @private
     * @chainable
     * @param  {Function} pass  function to execute if test|group passed
     * @param  {Function} fail  function to execute if test|group failed
     * @param  {Function} error function to execute if test|group cause error
     */
    var _callback = function(pass,fail,error) {
        if (!this.link) throw new ReferenceError('callback can only be used in testit chain');
        if (this.link.status === 'pass' && _typeof(pass) === 'Function' ) try {pass();} catch(e) {throw e;}
        if (this.link.status === 'fail' && _typeof(fail) === 'Function' ) try {fail();} catch(e) {throw e;}
        if (this.link.status === 'error' && _typeof(error) === 'Function' ) try {error();} catch(e) {throw e;}

        return this;
    }
    /**
     * public interface for _callback()
     * @public
     * @example
     *   test.it(someThing).callback(
     *       function() {...} // - will be execute if test passed
     *      ,function() {...} // - will be execute if test failed
     *      ,function() {...} // - will be execute if test error
     *   );
     */
    this.callback = _callback;

    /**
     * Final chain-link: will return result of test or group
     * @private
     * @return {boolean}            true - if test or group passed, false - otherwise.
     */
    var _result = function() {
        if (this.link) {
            return (this.link.status == 'pass')? true : false;
        }
        return undefined;
    }
    /**
     * public interface for _result()
     * @public
     * @example
     *   var testResult = test.it(undefined).comment('comment to test').result(); // testResult === false
     */
    this.result = _result;

    /**
     * Final chain-link: will return arguments of test (not of group!)
     * @private
     * @return                      single argument or array of arguments
     */
    var _arguments = function() {
        if (this.link) {
            if (this.link.type!=='test') return TypeError('groups does not return arguments');
            switch (this.link.argument.length) {
                case 0 : return undefined
                case 1 : return this.link.argument[0];
                default : return this.link.argument;
            }
        }
        return undefined;
    }
    /**
     * public interface for _arguments()
     * @public
     * @example
     *   var testArguments = test.it('single').comment('comment to test').arguments(); // testArguments === 'single'
     *   testArguments = test.it('first','second').comment('comment to test').arguments(); // testArguments === ['first','second']
     */
    this.arguments = _arguments;


    /** 
     * apply last stuff and display results
     * type {Function}
     * @private
     */
    var _done = function() {
        /** update time in root */
        root.time = new Date().getTime() - root.time;

        /** made _done() chain-closer */
        var currentLevel = (this.link.type==='group')?this.link:root;

        /** display root */
        _printConsole(currentLevel);
    }
    /**
     * public interface for _done()
     * @type {Function}
     * @public
     * @example
     *   test.it(1);
     *   test.it(2);
     *   test.it(3);
     *   
     *   test.done();
     */
    this.done = _done;


    /** update counters of contained object */
    var updateCounters = function(link) {
        link.result = {
            pass: 0,
            fail: 0,
            error: 0,
            total: 0
        };
        for (var i in link.stack) {
            link.result.total++;
            switch (link.stack[i].status) {
                case 'pass' : {
                    link.result.pass++;
                } break;
                case 'fail' : {
                    link.result.fail++;
                } break;
                case 'error' : {
                    link.result.error++;
                } break;
            };
        };
        
        if (link.result.error || link.error) {link.status='error'}
        else if (link.result.fail) {link.status='fail'}
        else {link.status='pass'}

        if (link.linkBack) {
            updateCounters(link.linkBack);
        }
    }


    /**
     * pritty display group or test in browser dev console
     * @private
     * @param  {Object} obj     group or test to display
     */
    var _printConsole = function(obj) {

        /** colors for console.log %c */
        var green = "color: green",
            red = "color: red;",
            orange = "color: orange",
            blue = "color: blue",
            normal = "color: normal; font-weight:normal;";

        /** Try to figure out what type of object display and open group */
        switch (obj.type) {
            case 'group' : {
                /** some difference depends on status */
                switch (obj.status) {
                    /** if object passed - make collapsed group*/
                    case 'pass' : {
                        console.groupCollapsed("%s - %c%s%c - %c%d%c/%c%d%c/%c%d%c (%c%d%c ms) %s"
                                     ,obj.name,green,obj.status,normal
                                     ,green,obj.result.pass,normal
                                     ,red,obj.result.fail,normal
                                     ,orange,obj.result.error,normal
                                     ,blue,obj.time,normal,((obj.comment)?obj.comment:''));
                    } break;
                    case 'fail' : {
                        console.group("%s - %c%s%c - %c%d%c/%c%d%c/%c%d%c (%c%d%c ms) %s"
                                     ,obj.name,red,obj.status,normal
                                     ,green,obj.result.pass,normal
                                     ,red,obj.result.fail,normal
                                     ,orange,obj.result.error,normal
                                     ,blue,obj.time,normal,((obj.comment)?obj.comment:''));
                    } break;
                    case 'error' : {
                        console.group("%s - %c%s%c - %c%d%c/%c%d%c/%c%d%c (%c%d%c ms) %s"
                                     ,obj.name,orange,obj.status,normal
                                     ,green,obj.result.pass,normal
                                     ,red,obj.result.fail,normal
                                     ,orange,obj.result.error,normal
                                     ,blue,obj.time,normal,((obj.comment)?obj.comment:''));
                    } break;
                    /** if status is not defined - display error; finish displaying */
                    default : {
                        console.error("No status in object %s",obj.name);
                        return false;
                    }
                }

                /** display description if defined */
                if (obj.description) {
                    console.log(obj.description);
                }
                
                /**
                 * display all tests and groups in stack
                 * It will make new levels of group, if there are groups in stack.
                 */
                for (var i in obj.stack) {
                    _printConsole(obj.stack[i]);
                }

                /** display error if defined */
                if (obj.error) {
                    // console.error(obj.error);
                    console.group('%c%s%c: %s',orange,obj.error.type,normal,obj.error.message);
                        if (obj.error.stack) console.log(obj.error.stack);
                        console.dir(obj.error.error);
                    console.groupEnd();
                }

                /** close opened group (current level) */
                console.groupEnd();

            } break;
            case 'test' : {
                /** display different results, depend on status */
                switch (obj.status) {
                    case 'pass' : {
                        /** if pass - collaps group*/
                        console.groupCollapsed("%cpass%c: %s",green,normal,(obj.comment)?obj.comment:'');
                    } break;
                    case 'fail' : {
                        console.group("%cfail%c: %s",red,normal,(obj.comment)?obj.comment:'');
                    } break;
                    case 'error' : {
                        console.group("%cerror%c: %s",orange,normal,(obj.comment)?obj.comment:'');
                    } break;
                }
                if (obj.description) console.log(obj.description);
                /** display error if defined */
                if (obj.error) {
                    // console.error(obj.error);
                    console.group('%c%s%c: %s',orange,obj.error.type,normal,obj.error.message);
                        if (obj.error.stack) console.log(obj.error.stack);
                        console.dir(obj.error.error);
                    console.groupEnd();
                }
                console.log(obj.argument);
                console.groupEnd();
            } break;
        }
    }
    /**
     * public interface for _printConsole
     * @type {Function}
     * @public
     * @example
     *   test.ptint(test.root);
     */
    this.print = _printConsole;

    /**
     * determinate type of argument
     * More powerfull then typeof().
     * @private
     * @return {String}     type name of argument
     *                      undefined, if type was not determinated
     */
    var _typeof = function (argument) {
        var type;
        try {
            switch (argument.constructor) {
                case Array : type='Array';break;
                case Boolean : type='Boolean';break;
                case Date : type='Date';break;
                case Error : type='Error';break;
                case EvalError : type='EvalError';break;
                case Function : type='Function';break;
                // case Math : type='math';break;
                case Number : {type=(isNaN(argument))?'NaN':'Number';}break;
                case Object : type='Object';break;
                case RangeError : type='RangeError';break;
                case ReferenceError : type='ReferenceError';break;
                case RegExp : type='RegExp';break;
                case String : type='String';break;
                case SyntaxError : type='SyntaxError';break;
                case TypeError : type='TypeError';break;
                case URIError : type='URIError';break;
                case Window : type='Window';break;
                case HTMLDocument : type='HTML';break;
                case NodeList : type='NodeList';break;
                default : {
                    if (typeof argument === 'object'
                     && argument.toString().indexOf('HTML') !== -1) {
                        type = 'HTML';
                    } else {
                        type = undefined;
                    }
                }
            }
        } catch (e) {
            type = (argument === null)? 'null' : typeof argument;
        }
        return type;
    }
    /**
     * public interface for _typeof
     * @public
     * @example
     *   test.typeof(myVar);
     */
    this.typeof = _typeof;
    /** list of type, which _typeof can identify */
    var identifiedTypes = ['array', 'boolean', 'date', 'error', 'evalerror', 'function', 'html', 'nan', 'nodelist', 'null', 'number', 'object', 'rangeerror', 'referenceerror', 'regexp', 'string', 'syntaxerror', 'typeerror', 'urierror', 'window'];
    
    /**
     * public interface for getTrace(error)
     * @public
     * @example
     *   test.trace();
     */
    this.trace = getTrace;

    // return this;
    return Object.create(this,{link:{value:root}});
}  

/**
 * figure out what status will be used
 * Depends on significanse:
 * More significant -> less significant.
 * error -> fail -> pass -> undefined
 * @param  {String} oldstatus   first compared status
 * @param  {String} newstatus   second compared status
 * @return {String}             status which will be set
 */
function updateStatus(oldstatus,newstatus) {
    if (oldstatus===undefined) return newstatus;
    if (newstatus===undefined) return oldstatus;
    if (oldstatus==='error' || newstatus==='error') return 'error';
    if (oldstatus==='fail' || newstatus==='fail') return 'fail';
    return 'pass';
}

/**
 * makes and returns more understandable error object
 * @param {Error} error         basic error
 * @return {Object}             new understandable error object
 */
function generateError(error) {
    /**
     * understandable error object
     * @property {Error} error      consist basic error
     * @property {String} type      type of error
     * @property {String} message   message from basic property
     * @property {String} stack     some kind of result of trace()
     */
    var object = {
        error: error,
        type: test.typeof(error),
        message: error.message,
    }
    if (getTrace(error)) object.stack = getTrace(error);

    return object;
}

/**
 * returns a list of functions that have been performed to call the current line
 * @param  {Error} error    if setted, trace will be based on it stack
 * @return {String}         list of functions joined by "\n";
 *                          undefined if error.stack is not supported.
 */
function getTrace(error) {
    if (!error) error = new Error();
    if (!error.stack) return;

    var stack = '';
    error.stack.split(/[\n]/).forEach(function(i,n){
        var addToStack = true;
        /** take off empty strings (FireBug) */
        if (i==='') addToStack = false;
        /** take off Errors (Chrome) */
        if (i.indexOf(test.typeof(error))!==-1) addToStack = false;
        /** take of reference to this function */
        if (i.indexOf('getTrace')!==-1) addToStack = false;
        /** take off any references to testit lines */
        if (i.indexOf('/testit.')!==-1) addToStack = false;
        /** fill the stack */
        if (addToStack) {
            stack += (stack)?'\n':'';
            stack += i.replace(/((\s+at\s+)|(^@))/,'');
        }
    })
    return stack;
}

/**
 * Compare any type of variables
 * @return {Boolean}            result of comparison
 * {@link http://stackoverflow.com/a/1144249/1771942}
 */
function deepCompare(){function c(d,e){var f;if(isNaN(d)&&isNaN(e)&&"number"==typeof d&&"number"==typeof e)return!0;if(d===e)return!0;if("function"==typeof d&&"function"==typeof e||d instanceof Date&&e instanceof Date||d instanceof RegExp&&e instanceof RegExp||d instanceof String&&e instanceof String||d instanceof Number&&e instanceof Number)return d.toString()===e.toString();if(!(d instanceof Object&&e instanceof Object))return!1;if(d.isPrototypeOf(e)||e.isPrototypeOf(d))return!1;if(d.constructor!==e.constructor)return!1;if(d.prototype!==e.prototype)return!1;if(a.indexOf(d)>-1||b.indexOf(e)>-1)return!1;for(f in e){if(e.hasOwnProperty(f)!==d.hasOwnProperty(f))return!1;if(typeof e[f]!=typeof d[f])return!1}for(f in d){if(e.hasOwnProperty(f)!==d.hasOwnProperty(f))return!1;if(typeof e[f]!=typeof d[f])return!1;switch(typeof d[f]){case"object":case"function":if(a.push(d),b.push(e),!c(d[f],e[f]))return!1;a.pop(),b.pop();break;default:if(d[f]!==e[f])return!1}}return!0}var a,b;if(arguments.length<1)return!0;for(var d=1,e=arguments.length;e>d;d++)if(a=[],b=[],!c(arguments[0],arguments[d]))return!1;return!0}

/**
 * find val in array
 * @param  {Array} array  will be searched
 * @param          val    will be searched for
 * @return {Boolean}      true if found, false otherwise
 */
arrayConsist = function(array, val) {
    for (var i in array) if (array[i] === val) return true;
    return false;
}
/** 
 * make new instance of testit
 * Make it availible from outside.
 */
scope.test = new testit();

})(this);