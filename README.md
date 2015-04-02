# JavaScript Tasks

Promises are currently very popular in the JavaScript world. ES2015 (JavaScript vNext) includes native Promises and uses them for module resolution.  Standards bodies and library authors are increasingly using Promises because they are now part of the web platform, and are more composable than callback APIs. Unfortunately _Promises are too primitive for many asynchronous APIs_, because Promises do not expose an API to cancel the asynchronous actions which have been initiated to resolve them.  

**The fact that promises are part of the web platform and have been adopted by JavaScript does not mean they are appropriate for every asynchronous API.** In fact, Promises are not optimal abstractions for most asynchronous operations in user interfaces. Unfortunately the ubiquity of Promises encourages standards bodies and library authors to use them - even where they don't fit. This can create a large amount of incidental complexity for both API writers and consumers.

The problem is simiple: **Promises do not expose a cancellation semantic, and most asynchronous operations in user-interfaces need to be cancelled.** It is very common for user interface actions to start with an event, be followed by asynchronous request, and finish with an animation. All three of these interactions are asynchronous, and all three of them may need to be interrupted.  If a user suddenly chooses to close a form, many event handlers may need to be removed, outgoing network requests will ideally be aborted, and in-flight animations may need to be interrupted. If you have structured your program to expose these interactions as promises, your options are both limited and unnattractive. Developers must often resort to adding sibling cancellation APIs alongside promise returning APIs. As the cancellation API is not part of the promise, it needs to be passed alongside the Promise to any consumer that needs the ability to cancel. This complicates method signatures and introduces additional coupling. Furthermore in the event of cancellation, the only way to avoid leaked callbacks is to **reject the promise.** This effectively forces developers must use error handling for program flow in common and expected situations, such as when a user closes a form, or types another character into an autocomplete box while a network request for the current text is in flight.

Clearly we need a better approach. We need an abstraction that is just as convenient and composable as Promises, but is semantically rich enough to model the asynchronous actions that user interfaces deal in all the time.

## Introducing Task

A Task models an asynchronous unit of work which will eventually result to a value. Tasks can be composed in exactly the same manner as Promises, but a Task can optionally cancel any scheduled asynchronous actions in the event that all of its consumers stop observing its eventual value.

**Tasks are a more appropriate abstraction than Promises for most asynchronous APIs used in user-interfaces.** A Task models both an asynchronous unit of work as well as its eventual result. Tasks have _nearly the same API as Promises_, but there are two primary differences: 

1.  Tasks are lazy, and do not cause side effects until they are explicitly run.
2.  Tasks allow you to stop observing their eventual value by unsubscribing, just like a DOM event or setTimeout.

Here's an example of retrieving a JSON model from the server as a Promise, and then printing the eventual result.

```JavaScript
var customerModelPromise = 
  getJSON('/model.json'). // returns a Promise
    // authorize resolves to a Promise<Customer> if authorization is successful, and rejects otherwise  
    then(model => authorize(model.customer)). 
    then(
      customer => console.log(customer.name, customer.address),
      error => console.error('Something went wrong.'));
```

Here's the equivalent example using a Task. Note the only difference is that a Task must be explicitly run in order to kick off the network request.

```JavaScript
let customerModelTask = 
  getJSONTask('/model.json'). // returns a Task
  // authorize resolves to a Task<Customer> if authorization is successful, and rejects otherwise
    when(model => authorize(model.customer)). 
    when(
      customer => console.log(customer.name, customer.address),
      error => console.error('Something went wrong.'));

// no network request is sent until the task is run
let subscription = customerModelTask.run();
      
// stop observing the result of a task and abort the outgoing network request
subscription.dispose();
```

When a Task is run, it returns a Subscription object. If a consumer is no longer interested in acting on the eventual result of a Task, it can dispose of the Subscription object returned by the run method.  This is just like removing an event listener from an event or clearing a timeout scheduled with settimeout. Once a task has no more observers, the Task can _optionally_ cancel any pending actions that were started to compute its result.

To understand how Tasks can cancel asynchronous operations let's contrast two implementations of an timeout function: one which returns a Promise, and another which returns a Task.  

The following function creates a Promise which resolves after a certain amount of time using setTimeout. 

```JavaScript
function timeoutPromise(time) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() { resolve(); }, time);
    });
};
```

Creating a task which resolves after a certain period of time is nearly identical. The only difference is that when a Task is run, it returns a Subscription object. When  there are no more consumers observing the result of a task, the subscription is disposed and the timeout is cleared.

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

Both the Promise and Task constructors accept function which is passed a result and reject method. The difference is that the Task function can optionally return a cancellation action to perform in the event that all of its consumers stop listening for its eventual result.

Once the promise API has been invoked, it cannot be canceled. 

```JavaScript
// Now there is no way to clear the timeout
var promise = timeoutPromise(2000);
// this callback will definitely be called
promise.then(() => alert('timeout'));
```

In contrast the timeout Task will clear the timeout as soon as all consumers stop listening for the result of the task. In the example below, the timeout task is cancelled when the user closes the currently-opened form.

```JavaScript
var task = timeoutTask(2000);

var timeoutSubscription = task.when(() => alert('timeout')).run();
    
form.addEventListener('close' function handler(e) {
  //  if the user closes the current form, we will never show the dialog.
  timeoutSubscription.dispose();
  form.removeEventListener('close', handler);
});
```

## Like Promises, but better for UIs

Tasks are designed to be as close as possible to a drop-in replacement for Promises. In the event that you discover that you need cancellation semantics, you should be able to relatively easily refactor your code to use Tasks instead of Promises.

Tasks share the following attributes with Promises:

* Auto-flattening
* Resolved result broadcasted to multiple listeners
* Resolved or Rejected value is cached for future consumers
* All Handlers always fire asychronously, don't release Zalgo
* Equivalent implementation (where possible) of all ES2015 (JavaScript vNext) Promise methods (race, all, etc)
* Can be composed together using ES2015 generators! (yield)

## Converting between Tasks and Promises

Ideally you should use Tasks wherever possible, because Tasks are more semantically rich than Promises.  If you come across an API which accepts a Promise, you can easily conver it to . 

```JavaScript
var task = Task.resolve(fetch('http://salon.com'));
var subscription = task.run(value => console.log(value), error => console.error(error));

// 
```

It is possible to stop observing tasks created from a promise, but for obvious reasons any  underlying asynchronous actions scheduled to resolve the promise will not be canceled. Note that it is still useful and convenient to be able to simply stop observing the result of a promise without relying on exception handling.
Furthermore it is possible to convert Tasks into Promises and vice-versa.

```JavaScript

```

Tasks are more appropriate for asynchronous actions that may need to be canceled. Rather than providing an  explicit cancellation API, Tasks allow consumers to indicate that they are no longer interested in receiving the Task's result.

Opting to no longer observe the result of a pending task is similar to unsubscribing from an event. Once a task determines that there are no more consumers for its eventual value, it may cancel or otherwise interrupt any actions currently people being performed to generate a result. 


in other words, you don't explicitly canceling task, You just stop listening. if the task determines that no one is listening for the result, it may interrupt the process of retrieving the result.  the ability to cancel outgoing network requests, or unhook from event handlers without burdening consumers with errors can make programs more efficient without unnecessarily complicating


set of asynchronous actions being performed as well as the eventual value. tasks have nearly the same API as promises,  but allow canceling of the underlying series of operations
The three most common asynchronous operations in a user-interface are event listening, asynchronous requests, and animations.  Nearly all of these asynchronous operations may need to be _canceled_ in certain circumstances.  Promises are too primitive an abstraction for these operations, because Promises model the eventual result of asynchronous operation,not the asynchronous operation itself.  In other words you cannot cancel a promise anymore than you can "cancel" a normal function:

```JavaScript
function addAsync(x,y) {
  return new Promise((accept, reject) => accept(x,y));
}
```

```JavaScript
function add(x,y) {
  return x + y;
}
```

Task
A Task implementation for JavaScript
