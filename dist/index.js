"use strict";

var _slicedToArray = function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { var _arr = []; for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done;) { _arr.push(_step.value); if (i && _arr.length === i) break; } return _arr; } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } };

var _createClass = (function () { function defineProperties(target, props) { for (var key in props) { var prop = props[key]; prop.configurable = true; if (prop.value) prop.writable = true; } Object.defineProperties(target, props); } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var noop = function noop() {};
var identity = function identity(v) {
    return v;
};
var noopSubscription = Object.seal({ dispose: function () {} });
var asap = require("asap");

var Task = (function () {
    function Task(run) {
        _classCallCheck(this, Task);

        this._run = run;
        this._observers = Object.create(null);
        this._uuid = 0;
        this._length = 0;
    }

    _createClass(Task, {
        _addSubscriber: {
            value: function _addSubscriber(resolve, reject) {
                var _this = this;

                var id = this._uuid,
                    subscription;

                this._uuid++;
                this._length++;
                subscription = {
                    dispose: function () {
                        var cbs = _this._observers[id];
                        if (cbs) {
                            delete _this._observers[id];
                            _this._length--;
                            if (_this._length === 0) {
                                _this._subscription.dispose();
                                _this._subscription = undefined;
                            }
                        }
                    }
                };

                this._observers[id] = [resolve, reject, subscription];
                return subscription;
            }
        },
        run: {
            value: function run() {
                var _this = this;

                var resolveFn = arguments[0] === undefined ? noop : arguments[0];
                var rejectFn = arguments[1] === undefined ? noop : arguments[1];

                var self = this,
                    id = this._uuid,
                    observing = true;

                if (self.error) {
                    asap(function () {
                        if (observing) rejectFn(self.error);
                    });
                    return { dispose: function () {
                            return observing = false;
                        } };
                } else if ("value" in self) {
                    asap(function () {
                        if (observing) resolveFn(self.value);
                    });
                    return { dispose: function () {
                            return observing = false;
                        } };
                } else if (this._length > 0) {
                    return this._addSubscriber(resolveFn, rejectFn);
                } else {
                    this._subscription = { dispose: function () {
                            return observing = false;
                        } };

                    asap(function () {
                        if (observing) {
                            _this._subscription = _this._run(function (value) {
                                _this.value = value;
                                Object.keys(_this._observers).forEach(function (key) {
                                    var _observers$key = _slicedToArray(_this._observers[key], 3);

                                    var resolveFn = _observers$key[0];
                                    var _ = _observers$key[1];
                                    var subscription = _observers$key[2];

                                    subscription.dispose();
                                    if (resolveFn) {
                                        resolveFn(value);
                                    }
                                });
                            }, function (error) {
                                _this.error = error;
                                Object.keys(_this._observers).forEach(function (key) {
                                    var _observers$key = _slicedToArray(_this._observers[key], 3);

                                    var _ = _observers$key[0];
                                    var rejectFn = _observers$key[1];
                                    var subscription = _observers$key[2];

                                    subscription.dispose();
                                    if (rejectFn) {
                                        rejectFn(error);
                                    }
                                });
                            }) || noopSubscription;
                        }
                    });

                    return this._addSubscriber(resolveFn, rejectFn);
                }
            }
        },
        when: {
            value: function when(projection, onerror) {
                var self = this;
                return new Task(function (resolve, reject) {
                    var subscription = self.run(function (x) {
                        try {
                            var nextTask = Task.resolve(projection(x));
                            subscription = nextTask.run(resolve, onerror || reject);
                        } catch (e) {
                            onerror && onerror(e) || reject(e);
                        }
                    }, reject);

                    return {
                        dispose: function dispose() {
                            if (subscription) {
                                subscription.dispose();
                                subscription = undefined;
                            }
                        }
                    };
                });
            }
        },
        then: {
            value: function then(resolve, reject) {
                this.run(resolve, reject);
                return this;
            }
        }
    });

    return Task;
})();

Task.all = function (args) {
    return new Task(function (resolve, reject) {
        var tasks = args.map(function (val) {
            return Task.resolve(val);
        }),
            subscription,
            results = [],
            resultCount = 0,
            subscriptions = tasks.map(function (task, index) {
            return task.run(function (val) {
                results[index] = val;
                resultCount++;
                if (resultCount == tasks.length) {
                    resolve(results);
                }
            }, function (error) {
                reject(error);
                subscription.dispose();
            });
        });

        return subscription = {
            dispose: function () {
                if (subscriptions) {
                    subscriptions.forEach(function (sub) {
                        return sub.dispose();
                    });
                    subscriptions = undefined;
                }
            }
        };
    });
};

Task.race = function (args) {
    return new Task(function (resolve, reject) {
        var tasks = args.map(function (val) {
            return Task.resolve(val);
        }),
            subscription,
            results = [],
            resultCount = 0,
            subscriptions = tasks.map(function (task, index) {
            return task.run(function (val) {
                resolve(val);
                subscription.dispose();
            }, function (error) {
                reject(error);
                subscription.dispose();
            });
        });

        return subscription = {
            dispose: function () {
                if (subscriptions) {
                    subscriptions.forEach(function (sub) {
                        return sub.dispose();
                    });
                    subscriptions = undefined;
                }
            }
        };
    });
};

Task.resolve = function (v) {
    var task;
    if (v instanceof Task) {
        return v;
    } else if (v !== null && v.then) {
        task = new Task(function (resolve, reject) {
            var observing = true;
            v.then(function (v) {
                if (observing) resolve(v);
            }, function (e) {
                if (observing) reject(e);
            });

            return { dispose: function () {
                    observing = false;
                } };
        });

        // have to run the task immediately, which means it can never be cancelled
        task.run();

        return task;
    } else {
        return new Task(function (resolve, reject) {
            resolve(v);
        });
    }
};

Task.reject = function (e) {
    return new Task(function (resolve, reject) {
        reject(e);
    });
};

Task.timeout = function (time) {
    return new Task(function run(resolve, reject) {
        var handle = setTimeout(function () {
            resolve();
        }, time);

        return {
            dispose: function dispose() {
                clearTimeout(handle);
            }
        };
    });
};

module.exports = Task;