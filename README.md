# JavaScript Tasks

Promises are currently very popular in the JavaScript world. ES2015 includes native Promises and uses them for module resolution.  Standards bodies and library authors are increasingly using Promises because they are there, and are more easily composed then callback API. Unfortunately _Promises are too primitive for many asynchronous APIs_, because Promises do not expose an API to cancel the asynchronous actions which have been initiated to resolve them.  

Promise are too simple for most asynchronous APIs in user interfaces, and that creates considerable incidental complexity. Developers and library authors want to use Promises because they are part of the web platform and well-understood. However these developers often find themselves clumsily exposing cancellation APIs alongside Promise-returning APIs and relying on error handling to manage normal program control flow.

**Rather than try and use Promises to model asynchronous APIs which require cancellation, why not use a more appropriate abstraction?"**

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

When a Task is run, it returns a Subscription object. If a consumer is no longer interested in observing the eventual result of a Task, it can dispose of the Subscription object return by the run method.  This is just like removing an event listener from an event.  Once a consumer disposes of the subscription object, the Task frees their event handlers and will never call them again. Once a task has no more observers, the Task can _optionally_ cancel any pending actions that were started to compute its result.

To understand how Tasks can cancel asynchronous operations let's contrast two implementations of an timeout function: one which returns a Promise, and another which returns a Task.  

The following function creates a Promise which resolves after a certain amount of time using setTimeout. 

```JavaScript
function timeoutPromise(time) {
    return new Promise(function(resolve, reject) {
        setTimeout(function() { resolve(); }, time);
    });
};
```

Creating a task which resolves after a certain period of time is nearly identical. The only difference is that when a Task is run, it returns a Subscription object. When  there are no more consumers observing the result of a task, the subscription is disposed of and the timeout is cleared.

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

In contrast the timeout Task will clear the timeout as soon as all consumers stop listening for the result of the task.

```JavaScript
var task = timeoutTask(2000);

var timeoutSubscription = task.when(() => alert('timeout')).run();
    
form.addEventListener('close' function handler(e) {
  //  if the user closes the current form, we will never show the dialog.
  timeoutSubscription.dispose();
  form.removeEventListener('close', handler);
});
```

## Like Promises, but better

Tasks are designed to be as close as possible to a drop-in replacement for promises in the event that you discover that your asynchronous API needs cancellation semantics.

```JavaScript
let modelTask = 
  getJSONTask('/model.json');

let customerTask = 
  modelTask.
    when(model => authorize(model.customer)). // authorize returns another Task
    when(
      customer => console.log(customer.name, customer.address),
      error => console.error('Something went wrong.')).

let recommendedTitlesTask =
  modelTask.
    when(model => model.recommendedTitles).
    when(displayTitlesOnScreen, function(error) { alert('titles can't be displayed now.'); });
    
// running both these tasks will only cause one network request to be made for model.json
customerTask.run();
recommendedTitlesTask.run();
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
