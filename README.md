# JavaScript Tasks

A Task models an asynchronous unit of work which will eventually resolve with a value or reject with an error. When a Task is run, it returns a Subscription object which the consumer can use to stop observing the Task's result. Once a Task detects that its result is no longer being observed by any consumers, the Task can opportunistically **cancel** any actions scheduled to resolve its value.

Here's an example of a program which waits for a user to click a button and then issues a network request to retrieve a stock quote. If the button is clicked again while the network request is still pending, the current network request is aborted and a new one is issued. 

```JavaScript
// variable that stores the Subscription to the current stock price network request
var outgoingRequest;
function waitForQuote() {
  // if there's a request in-flight, stop observing the result
  if (outgoingRequest) {
    outgoingRequest.dispose();
    outgoingRequest = undefined;
  }
  
  outgoingRequest = 
    Task.
      // wait for next button click...
  	nextEvent(getQuoteButton, 'click').
      // return a task with the stock quote and auto-unwrap result just like Promise's then
      when(function() { 
        return getQuote('NFLX');
      }).
      // run and await the result  		
      run(function(val) { 
        // display the price
        priceTextBox.value = val;
        outgoingRequest = undefined;
        
        waitForQuote();
      });
}

waitForQuote();
```

Here is the definition of the getQuote function. This function returns a Task which issues a network request for a stock quote when run. Note that when a Task is created it returns a cancellation action to execute once all consumers have stopped observing its result.

```JavaScript
var Task = require('task-lib');

function getQuote(symbol) {
  return new Task((resolve, reject) => {
    var xhr = new XMLHttpRequest(),
      url = 'https://query.yahooapis.com/v1/public/yql?q=select%20LastTradePriceOnly%20from%20yahoo.finance.quote%20where%20symbol%20in%20(%22' + symbol + '%22)&format=json&diagnostics=true&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=';
    
    xhr.open('get', url, true);
    xhr.onreadystatechange = function() {
      var status;
      var data;
      // https://xhr.spec.whatwg.org/#dom-xmlhttprequest-readystate
      if (xhr.readyState == 4) { // `DONE`
        status = xhr.status;
        if (status == 200) {
          data = JSON.parse(xhr.responseText).query.results.quote.LastTradePriceOnly;
          resolve(data);
        } else {
          reject(status);
        }
      }
    };
    
    xhr.send();
    
    // the cancellation action to perform when the Task is no longer observed.
    return { dispose: () => xhr.abort() };
  });
}
```

Try this example live now! http://requirebin.com/?gist=533ad1e9d573ea7e9c5e

## Installing the JavaScript Task Library

```
npm install task-lib
```

## Why not Promises?

Promises are currently very popular in the JavaScript world. ES2015 (JavaScript vNext) includes native Promises and uses them for module resolution. Standards bodies and library authors are increasingly using Promises because they are now part of the web platform, and are more composable than callback APIs. Unfortunately the standardization of Promises has created a hazard: standards bodies and library authors are using Promises instead of more appropriate abstractions, simply *because they are standardized.* The new fetch API is only the latest example (https://github.com/whatwg/fetch/issues/27).

**Promises do not expose a cancellation semantic, and most asynchronous operations in user-interfaces need to be cancelled.** It is very common for UIs to listen for an event, follow an event with an asynchronous request, and finish with an animation. If a user suddenly chooses to close a form, event handlers often need to be removed, enqueued network requests will ideally be aborted, and in-flight animations will ideally be interrupted. If a library author has chosen to expose abstract these operations as promises, their options for cancellation are limited and unnattractive. To enable cancellation, library authors often resort to adding sibling cancellation APIs alongside promise-returning APIs. The cancellation API is not on the promise, which means it needs to be passed alongside the Promise to any consumer that needs the ability to cancel. This complicates method signatures and introduces additional coupling. Furthermore in the event of cancellation, the only way to cause Promises to release attached callbacks is to **reject the promise.** This effectively forces developers to use error handling for program flow in common and expected situations. Such situations include a user closing a form mid-animation, or a user typing another character into an autocomplete box while a network request for the old search is in-flight.

**Promises are not the only asynchronous primitive.** Better types can be designed which enable cancellation, while retaining the composability of Promises.

## Introducing Task

A Task models an asynchronous unit of work which will eventually resolve with a value or reject with an error. In contrast, a Promise only models the eventual result of an asynchronous unit of work, not the work itself. That is why Tasks can be cancelled, and Promises can _not_.

**Tasks are a more appropriate abstraction than Promises for most asynchronous APIs in user-interfaces.** You can use a Task to represent the next occurrence of an event, a network request, or an animation. A Task will make a best effort to clean up after itself as soon as all of its consumers stop observing its completion. When no longer observed, a Task can unhook an event handler, abort a network request, or stop an animation in-flight.

Tasks can be composed in exactly the same way as Promises, but a Task can optionally cancel any scheduled asynchronous actions in the event that all of its observers stop observing its completion. Tasks have _nearly the same API as Promises_, with two important differences: 

1.  **Tasks are lazy.** They do not cause any side effects until they are explicitly run.
2.  Tasks allow you to stop observing their eventual completion by unsubscribing, just like a DOM event or a setTimeout.

Here's an example of retrieving a JSON model from the server as a Promise, and then printing the eventual result.

```JavaScript
var customerModelPromise = 
  getJSON('/model.json'). // returns a Promise
    // authorize returns a Promise<Customer> which resolves if authorization is successful, and rejects otherwise  
    then(model => authorize(model.customer)). 
    then(
      customer => console.log(customer.name, customer.address),
      error => console.error('Something went wrong.'));
```

Here's the equivalent example using a Task. Note the only difference (beyond using `when` instead of `then`) is that a Task must be explicitly run in order to kick off the network request.

```JavaScript
let customerModelTask = 
  getJSONTask('/model.json'). // returns a Task
  // authorizeTask returns a Task<Customer> which resolves if authorization is successful, and rejects otherwise  
    when(model => authorizeTask(model.customer)). 
    when(
      customer => console.log(customer.name, customer.address),
      error => console.error('Something went wrong.'));

// no network request is sent until the task is run
let subscription = customerModelTask.run();
      
// stop observing the result of a task and abort the outgoing network request
subscription.dispose();
```

When a Task is run, it returns a Subscription object. If a consumer is no longer interested in acting on the eventual result of a Task, it can dispose of the Subscription object returned by the run method. This is just like removing an event listener from an event or clearing a timeout scheduled with setTimeout. Once a Task detects that it has no more observers, the Task makes a best effort to cancel any pending operations intended to resolve it.

To understand how Tasks can cancel pending operations let's contrast two implementations of a timeout function: one which returns a Promise, and another which returns a Task.  

The following function creates a Promise which resolves after a certain amount of time using setTimeout. 

```JavaScript
function timeoutPromise(time) {
    return new Promise(function then(resolve, reject) {
        setTimeout(function() { resolve(); }, time);
    });
};
```

The code to create a Task which resolves after a certain period of time is nearly identical to the Promise example. The only difference is that when a Task is run, it returns a Subscription object. When there are no more consumers observing the result of a Task, the subscription is disposed and the timeout is cleared.

```JavaScript
var Task = require('task-lib');

function timeoutTask(time) {
    return new Task(function run(resolve, reject) {
        var handle = setTimeout(function() { resolve(); }, time);

        // return subscription object, which will be disposed of when a Task has no more observers
        return { dispose: () => clearTimeout(handle) };
    });
};
```

Both the Promise and Task constructors accept a function which is passed a resolve and reject method. The difference is that the Task function can optionally return a cancellation action to perform in the event that all of its consumers stop listening for its eventual result. 

Let's look at some code that consumes these APIs. Once a promise API has been invoked, the action cannot be canceled with the Promise alone.

```JavaScript
// Now there is no way to clear the timeout
var promise = timeoutPromise(2000);
// this callback will definitely be called
promise.then(() => alert('timeout'));
```

In contrast the timeout Task will clear the timeout as soon as all consumers stop listening for the result of the task. In the example below, the timeout task is cleared when the user closes the currently-opened form.

```JavaScript
var task = timeoutTask(2000);

var timeoutSubscription = task.when(() => alert('timeout')).run();
    
form.addEventListener('close' function handler(e) {
  //  if the user closes the current form, we will never show the dialog.
  timeoutSubscription.dispose();
  form.removeEventListener('close', handler);
});
```

## Like Promises, but more Powerful

Tasks are designed to be easy to drop-in as a replacement for Promises. In the event that you discover that you need cancellation semantics, you may be able to easily refactor your code to use Tasks instead of Promises.

Tasks share the following attributes with Promises:

* Auto-flattening (`when` function can return T or Task<T>)
* Result broadcasted to all listeners
* Result cached for future consumers
* Handlers always fire asychronously (Zalgo not released)
* Equivalent implementation (where possible) of all ES2015 (JavaScript vNext) Promise methods
* Can be composed together using ES2015 generators! (yield)

## Converting between Tasks and Promises

Ideally you should use Tasks wherever possible, because Tasks are more semantically rich than Promises.  If you come across an API which accepts a Promise, you can easily convert a Task to a Promise. 

```JavaScript
var task = fetchTask('/model.json');

someAPIThatAcceptsAPromise(Promise.resolve(task));
```
Tasks are `thenable` objects, because they have a then method which behaves like a Promise's then method. You should never use this method directly, and use `when` instead because it preserves the Task's cancellation semantic. The `then` method only exists to be used by Promise.resolve to convert a Task into a Promise.

Once converted to a Promise, the Task will never be canceled because there'll always be at least one consumer listening for the Task's result (the Promise).  However choosing to use **Tasks where possible and Promises were necessary** gives you maximum flexibility, because you only need to sacrifice cancellation when you come across an API that requires a Promise. In these circumstances, you are no worse off than you would be had you chosen to use Promises from the start.

Just as you can convert a Task to a Promise, you can also convert a promise to a task.

```JavaScript
let promise = fetch('/model.json');

let task = Task.resolve(promise);
let subscription = task.run(model => console.log(model));

// can stop listening for Promise result with subscription.dispose();
```

When you convert a Promise to a Task using Task.resolve, the Task is already in a running state. While this Task cannot be canceled, it is possible to stop observing it. Converting a Promise to a Task has benefits. Although you cannot cancel the actions that lead to resolving the underlying Promise, **all of the subsequent actions chained off of the Task using `when` can be cancelled if you stop observing the Task!**

```JavaScript
let promise = fetch('/model.json');

let task = Task.resolve(promise);
let subscription = 
  task.
    // get customer returns a Task which accesses the customer object from a web service
    when(model => getCustomerTask(model.id)).
    when(customer => console.log(customer)).
    run();

form.addEventListener('close' function handler(e) {
  // if the user closes the current form before the fetch promise is resolved,
  // the network request to retrieve the customer object will never be issued!
  subscription.dispose();
  form.removeEventListener('close', handler);
});
```

In addition to Promises, you can adapt other async APIs to Tasks, such as DOM events. In this example we create a Task that resolves when the window loads:

```JavaScript
var load = Task.nextEvent(window, 'load');

var subscription = load.run(() => alert('we've loaded');
// we can unhook the event handler by calling subscription.dispose() before load fires.
```

## The Start of a Conversation

**This library is currently nowhere near mature enough for production use.** It is intended to demonstrate that richer asynchronous primitives than Promises exist, and are a better fit for many of the web's APIs.  I'm deeply concerned the convenience brought about by Promise standardization will lead to the proliferation of Promises at the expense of more appropriate asynchronous primitives. It's not that Promises are _never useful_. They are appropriate for async operations that cannot meaningfully be cancelled. However this describes a very small set of async operations used in user interfaces. We need to standardize richer asynchronous primitives so that library authors and web standards bodies can choose the most appropriate type for their APIs, not just the most convenient.
