# Task Library for JavaScript

Promises are currently very popular in the JavaScript world. ES2015 includes native Promises and uses them for module resolution. Now that Promises are a core part of the web platform, they are increasingly being used in a variety of different web APIs. Unfortunately Promises too primitive for many different asynchronous APIs,  because it is not possible to cancel a Promise once it has begun.

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
