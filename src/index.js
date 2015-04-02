var Promise = require('promise');
var noop = function() {};
var identity = function(v) { return v; };
var noopSubscription = Object.seal({ dispose: () => {} });
var asap = require('asap');

class Task {
    constructor(run) {
        this._run = run;
        this._observers = Object.create(null);
        this._uuid = 0;
        this._length = 0;
    }

    _addSubscriber(resolve, reject) {
        var id = this._uuid,
            subscription;
        
        this._uuid++;
        this._length++;
        subscription = { 
            dispose: () => {
                var cbs = this._observers[id];
                if (cbs) {
                    delete this._observers[id];
                    this._length--;
                    if (this._length === 0) {
                        this._subscription.dispose();
                        this._subscription = undefined;
                    }
                }
            }
        };

        this._observers[id] = [resolve, reject, subscription];
        return subscription;
    }

    run(resolveFn = noop, rejectFn = noop) {
        var self = this,
            id = this._uuid,
            observing = true;

        if (self.error) {
            asap(() => { if (observing) rejectFn(self.error); });
            return { dispose: () => observing = false };
        }
        else if ('value' in self) {
            asap(() => { if (observing) resolveFn(self.value); });
            return { dispose: () => observing = false };
        }
        else if (this._length > 0) {
            return this._addSubscriber(resolveFn, rejectFn);
        }
        else {
            this._subscription = { dispose: () => observing = false };

            asap(() => {
                if (observing) {
                    this._subscription = 
                        this._run(
                            value => {
                                this.value = value;
                                Object.
                                    keys(this._observers).
                                    forEach(key => {
                                        var [resolveFn, _, subscription] = this._observers[key];
                                        subscription.dispose();                            
                                        if (resolveFn) {
                                            resolveFn(value);
                                        }
                                    });
                            }, 
                            error => {
                                this.error = error;
                                Object.
                                    keys(this._observers).
                                    forEach(key => {
                                        var [_, rejectFn, subscription] = this._observers[key];
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

    when(projection) {
        var self = this;
        return new Task(function(resolve, reject) {
            var subscription = 
                self.run(
                    x => {
                        try {
                            var nextTask = Task.resolve(projection(x));
                            subscription = nextTask.run(resolve, reject);
                        }
                        catch(e) {
                            reject(e);
                        }
                    },
                    reject);

            return {
                dispose: function() {
                    if (subscription) {
                        subscription.dispose();
                        subscription = undefined;
                    }
                }
            };
        });
    }

    toPromise() {
        return new Promise((resolve, reject) => {            
            this.run(resolve, reject);
        });
    }
}

Task.all = function(args) {
    return new Task((resolve, reject) => {
        var tasks = args.map(val => Task.resolve(val)),
            subscription,
            results = [],
            resultCount = 0,
            subscriptions = 
                tasks.map((task, index) => 
                    task.run(
                        val => {
                            results[index] = val;
                            resultCount++;
                            if (resultCount == tasks.length) {
                                resolve(results);
                            }
                        },
                        error => {
                            reject(error);
                            subscription.dispose();
                        }));

        return subscription = {
            dispose: () => {
                if (subscriptions) {
                    subscriptions.forEach(sub => sub.dispose());
                    subscriptions = undefined;
                }
            }
        };
    });
};

Task.race = function(args) {
    return new Task((resolve, reject) => {
        var tasks = args.map(val => Task.resolve(val)),
            subscription,
            results = [],
            resultCount = 0,
            subscriptions = 
                tasks.map((task, index) => 
                    task.run(
                        val => {
                            resolve(val);
                            subscription.dispose();
                        },
                        error => {
                            reject(error);
                            subscription.dispose();
                        }));

        return subscription = {
            dispose: () => {
                if (subscriptions) {
                    subscriptions.forEach(sub => sub.dispose());
                    subscriptions = undefined;
                }
            }
        };
    });
};

Task.resolve = function(v) {
    if (v instanceof Task) {
        return v;
    }
    else if (v !== null && v.then) {
        return new Task((resolve, reject) => {
            var observing = true;
            v.then(
                v => {
                    if (observing) resolve(v);
                }, 
                e => {
                    if (observing) reject(e);
                });

            return { dispose:() => { observing = false; }};
        });
    }
    else {
        return new Task((resolve, reject) => {
            resolve(v);
        });
    }
};

Task.reject = function(e) {
    return new Task((resolve, reject) => {
        reject(e);
    });
};

Task.timeout = function(time) {
    return new Task(function run(resolve, reject) {
        var handle = setTimeout(function() { resolve(); }, time);

        return { 
            dispose: function() {
                clearTimeout(handle);
            }
        };
    });
};
 
module.exports = Task;
