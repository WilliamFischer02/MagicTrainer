# Calling Rust from the Frontend

This document includes guides on how to communicate with your Rust code from your application frontend.
To see how to communicate with your frontend from your Rust code, see [Calling the Frontend from Rust](/develop/calling-frontend/).

Tauri provides a [command](#commands) primitive for reaching Rust functions with type safety,
along with an [event system](#event-system) that is more dynamic.

## Commands

[Section titled “Commands”](#commands)

Tauri provides a simple yet powerful `command` system for calling Rust functions from your web app.
Commands can accept arguments and return values. They can also return errors and be `async`.

### Basic Example

[Section titled “Basic Example”](#basic-example)

Commands can be defined in your `src-tauri/src/lib.rs` file.
To create a command, just add a function and annotate it with `#[tauri::command]`:

src-tauri/src/lib.rs

```
#[tauri::command]

fn my_custom_command() {

println!("I was invoked from JavaScript!");

}
```

You will have to provide a list of your commands to the builder function like so:

src-tauri/src/lib.rs

```
#[cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {

tauri::Builder::default()

.invoke_handler(tauri::generate_handler![my_custom_command])

.run(tauri::generate_context!())

.expect("error while running tauri application");

}
```

Now, you can invoke the command from your JavaScript code:

```
// When using the Tauri API npm package:

import { invoke } from '@tauri-apps/api/core';

// When using the Tauri global script (if not using the npm package)

// Be sure to set `app.withGlobalTauri` in `tauri.conf.json` to true

const invoke = window.__TAURI__.core.invoke;

// Invoke the command

invoke('my_custom_command');
```

#### Defining Commands in a Separate Module

[Section titled “Defining Commands in a Separate Module”](#defining-commands-in-a-separate-module)

If your application defines a lot of components or if they can be grouped,
you can define commands in a separate module instead of bloating the `lib.rs` file.

As an example let’s define a command in the `src-tauri/src/commands.rs` file:

src-tauri/src/commands.rs

```
#[tauri::command]

pub fn my_custom_command() {

println!("I was invoked from JavaScript!");

}
```

In the `lib.rs` file, define the module and provide the list of your commands accordingly;

src-tauri/src/lib.rs

```
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {

tauri::Builder::default()

.invoke_handler(tauri::generate_handler![commands::my_custom_command])

.run(tauri::generate_context!())

.expect("error while running tauri application");

}
```

Note the `commands::` prefix in the command list, which denotes the full path to the command function.

The command name in this example is `my_custom_command` so you can still call it by executing `invoke("my_custom_command")`
in your frontend, the `commands::` prefix is ignored.

#### WASM

[Section titled “WASM”](#wasm)

When using a Rust frontend to call `invoke()` without arguments, you will need to adapt your frontend code as below.
The reason is that Rust doesn’t support optional arguments.

```
#[wasm_bindgen]

extern "C" {

// invoke without arguments

#[wasm_bindgen(js_namespace = ["window", "__TAURI__", "core"], js_name = invoke)]

async fn invoke_without_args(cmd: &str) -> JsValue;

// invoke with arguments (default)

#[wasm_bindgen(js_namespace = ["window", "__TAURI__", "core"])]

async fn invoke(cmd: &str, args: JsValue) -> JsValue;

// They need to have different names!

}
```

### Passing Arguments

[Section titled “Passing Arguments”](#passing-arguments)

Your command handlers can take arguments:

```
#[tauri::command]

fn my_custom_command(invoke_message: String) {

println!("I was invoked from JavaScript, with this message: {}", invoke_message);

}
```

Arguments should be passed as a JSON object with camelCase keys:

```
invoke('my_custom_command', { invokeMessage: 'Hello!' });
```

Arguments can be of any type, as long as they implement [`serde::Deserialize`](https://docs.serde.rs/serde/trait.Deserialize.html).

### Returning Data

[Section titled “Returning Data”](#returning-data)

Command handlers can return data as well:

```
#[tauri::command]

fn my_custom_command() -> String {

"Hello from Rust!".into()

}
```

The `invoke` function returns a promise that resolves with the returned value:

```
invoke('my_custom_command').then((message) => console.log(message));
```

Returned data can be of any type, as long as it implements [`serde::Serialize`](https://docs.serde.rs/serde/trait.Serialize.html).

#### Returning Array Buffers

[Section titled “Returning Array Buffers”](#returning-array-buffers)

Return values that implements [`serde::Serialize`](https://docs.serde.rs/serde/trait.Serialize.html) are serialized to JSON when the response is sent to the frontend.
This can slow down your application if you try to return a large data such as a file or a download HTTP response.
To return array buffers in an optimized way, use [`tauri::ipc::Response`](https://docs.rs/tauri/2.0.0/tauri/ipc/struct.Response.html):

```
use tauri::ipc::Response;

#[tauri::command]

fn read_file() -> Response {

let data = std::fs::read("/path/to/file").unwrap();

tauri::ipc::Response::new(data)

}
```

### Error Handling

[Section titled “Error Handling”](#error-handling)

If your handler could fail and needs to be able to return an error, have the function return a `Result`:

```
#[tauri::command]

fn login(user: String, password: String) -> Result<String, String> {

if user == "tauri" && password == "tauri" {

// resolve

Ok("logged_in".to_string())

} else {

// reject

Err("invalid credentials".to_string())

}

}
```

If the command returns an error, the promise will reject, otherwise, it resolves:

```
invoke('login', { user: 'tauri', password: '0j4rijw8=' })

.then((message) => console.log(message))

.catch((error) => console.error(error));
```

As mentioned above, everything returned from commands must implement [`serde::Serialize`](https://docs.serde.rs/serde/trait.Serialize.html), including errors.
This can be problematic if you’re working with error types from Rust’s std library or external crates as most error types do not implement it.
In simple scenarios you can use `map_err` to convert these errors to `String`:

```
#[tauri::command]

fn my_custom_command() -> Result<(), String> {

std::fs::File::open("path/to/file").map_err(|err| err.to_string())?;

// Return `null` on success

Ok(())

}
```

Since this is not very idiomatic you may want to create your own error type which implements `serde::Serialize`.
In the following example, we use the [`thiserror`](https://github.com/dtolnay/thiserror) crate to help create the error type.
It allows you to turn enums into error types by deriving the `thiserror::Error` trait.
You can consult its documentation for more details.

```
// create the error type that represents all errors possible in our program

#[derive(Debug, thiserror::Error)]

enum Error {

#[error(transparent)]

Io(#[from] std::io::Error)

}

// we must manually implement serde::Serialize

impl serde::Serialize for Error {

fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>

where

S: serde::ser::Serializer,

{

serializer.serialize_str(self.to_string().as_ref())

}

}

#[tauri::command]

fn my_custom_command() -> Result<(), Error> {

// This will return an error

std::fs::File::open("path/that/does/not/exist")?;

// Return `null` on success

Ok(())

}
```

A custom error type has the advantage of making all possible errors explicit so readers can quickly identify what errors can happen.
This saves other people (and yourself) enormous amounts of time when reviewing and refactoring code later.  
It also gives you full control over the way your error type gets serialized.
In the above example, we simply returned the error message as a string, but you could assign each error a code
so you could more easily map it to a similar looking TypeScript error enum for example:

```
#[derive(Debug, thiserror::Error)]

enum Error {

#[error(transparent)]

Io(#[from] std::io::Error),

#[error("failed to parse as string: {0}")]

Utf8(#[from] std::str::Utf8Error),

}

#[derive(serde::Serialize)]

#[serde(tag = "kind", content = "message")]

#[serde(rename_all = "camelCase")]

enum ErrorKind {

Io(String),

Utf8(String),

}

impl serde::Serialize for Error {

fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>

where

S: serde::ser::Serializer,

{

let error_message = self.to_string();

let error_kind = match self {

Self::Io(_) => ErrorKind::Io(error_message),

Self::Utf8(_) => ErrorKind::Utf8(error_message),

};

error_kind.serialize(serializer)

}

}

#[tauri::command]

fn read() -> Result<Vec<u8>, Error> {

let data = std::fs::read("/path/to/file")?;

Ok(data)

}
```

In your frontend you now get a `{ kind: 'io' | 'utf8', message: string }` error object:

```
type ErrorKind = {

kind: 'io' | 'utf8';

message: string;

};

invoke('read').catch((e: ErrorKind) => {});
```

### Async Commands

[Section titled “Async Commands”](#async-commands)

Asynchronous commands are preferred in Tauri to perform heavy work in a manner that doesn’t result in UI freezes or slowdowns.

**If your command needs to run asynchronously, simply declare it as `async`.**

When working with borrowed types, you have to make additional changes. These are your two main options:

**Option 1**: Convert the type, such as `&str` to a similar type that is not borrowed, such as `String`.
This may not work for all types, for example `State<'_, Data>`.

*Example:*

```
// Declare the async function using String instead of &str, as &str is borrowed and thus unsupported

#[tauri::command]

async fn my_custom_command(value: String) -> String {

// Call another async function and wait for it to finish

some_async_function().await;

value

}
```

**Option 2**: Wrap the return type in a [`Result`](https://doc.rust-lang.org/std/result/index.html). This one is a bit harder to implement, but works for all types.

Use the return type `Result<a, b>`, replacing `a` with the type you wish to return, or `()` if you wish to return `null`, and replacing `b` with an error type to return if something goes wrong, or `()` if you wish to have no optional error returned. For example:

* `Result<String, ()>` to return a String, and no error.
* `Result<(), ()>` to return `null`.
* `Result<bool, Error>` to return a boolean or an error as shown in the [Error Handling](#error-handling) section above.

*Example:*

```
// Return a Result<String, ()> to bypass the borrowing issue

#[tauri::command]

async fn my_custom_command(value: &str) -> Result<String, ()> {

// Call another async function and wait for it to finish

some_async_function().await;

// Note that the return value must be wrapped in `Ok()` now.

Ok(format!(value))

}
```

##### Invoking from JavaScript

[Section titled “Invoking from JavaScript”](#invoking-from-javascript)

Since invoking the command from JavaScript already returns a promise, it works just like any other command:

```
invoke('my_custom_command', { value: 'Hello, Async!' }).then(() =>

console.log('Completed!')

);
```

### Channels

[Section titled “Channels”](#channels)

The Tauri channel is the recommended mechanism for streaming data such as streamed HTTP responses to the frontend.
The following example reads a file and notifies the frontend of the progress in chunks of 4096 bytes:

```
use tokio::io::AsyncReadExt;

#[tauri::command]

async fn load_image(path: std::path::PathBuf, reader: tauri::ipc::Channel<&[u8]>) {

// for simplicity this example does not include error handling

let mut file = tokio::fs::File::open(path).await.unwrap();

let mut chunk = vec![0; 4096];

loop {

let len = file.read(&mut chunk).await.unwrap();

if len == 0 {

// Length of zero means end of file.

break;

}

reader.send(&chunk).unwrap();

}

}
```

See the [channels documentation](/develop/calling-frontend/#channels) for more information.

### Accessing the WebviewWindow in Commands

[Section titled “Accessing the WebviewWindow in Commands”](#accessing-the-webviewwindow-in-commands)

Commands can access the `WebviewWindow` instance that invoked the message:

src-tauri/src/lib.rs

```
#[tauri::command]

async fn my_custom_command(webview_window: tauri::WebviewWindow) {

println!("WebviewWindow: {}", webview_window.label());

}
```

### Accessing an AppHandle in Commands

[Section titled “Accessing an AppHandle in Commands”](#accessing-an-apphandle-in-commands)

Commands can access an `AppHandle` instance:

src-tauri/src/lib.rs

```
#[tauri::command]

async fn my_custom_command(app_handle: tauri::AppHandle) {

let app_dir = app_handle.path().app_dir();

use tauri::GlobalShortcutManager;

app_handle.global_shortcut_manager().register("CTRL + U", move || {});

}
```

### Accessing Managed State

[Section titled “Accessing Managed State”](#accessing-managed-state)

Tauri can manage state using the `manage` function on `tauri::Builder`.
The state can be accessed on a command using `tauri::State`:

src-tauri/src/lib.rs

```
struct MyState(String);

#[tauri::command]

fn my_custom_command(state: tauri::State<MyState>) {

assert_eq!(state.0 == "some state value", true);

}

#[cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {

tauri::Builder::default()

.manage(MyState("some state value".into()))

.invoke_handler(tauri::generate_handler![my_custom_command])

.run(tauri::generate_context!())

.expect("error while running tauri application");

}
```

### Accessing Raw Request

[Section titled “Accessing Raw Request”](#accessing-raw-request)

Tauri commands can also access the full [`tauri::ipc::Request`](https://docs.rs/tauri/2.0.0/tauri/ipc/struct.Request.html) object which includes the raw body payload and the request headers.

```
#[derive(Debug, thiserror::Error)]

enum Error {

#[error("unexpected request body")]

RequestBodyMustBeRaw,

#[error("missing `{0}` header")]

MissingHeader(&'static str),

}

impl serde::Serialize for Error {

fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>

where

S: serde::ser::Serializer,

{

serializer.serialize_str(self.to_string().as_ref())

}

}

#[tauri::command]

fn upload(request: tauri::ipc::Request) -> Result<(), Error> {

let tauri::ipc::InvokeBody::Raw(upload_data) = request.body() else {

return Err(Error::RequestBodyMustBeRaw);

};

let Some(authorization_header) = request.headers().get("Authorization") else {

return Err(Error::MissingHeader("Authorization"));

};

// upload...

Ok(())

}
```

In the frontend you can call invoke() sending a raw request body by providing an ArrayBuffer or Uint8Array on the payload argument,
and include request headers in the third argument:

```
const data = new Uint8Array([1, 2, 3]);

await __TAURI__.core.invoke('upload', data, {

headers: {

Authorization: 'apikey',

},

});
```

### Creating Multiple Commands

[Section titled “Creating Multiple Commands”](#creating-multiple-commands)

The `tauri::generate_handler!` macro takes an array of commands. To register
multiple commands, you cannot call invoke\_handler multiple times. Only the last
call will be used. You must pass each command to a single call of
`tauri::generate_handler!`.

src-tauri/src/lib.rs

```
#[tauri::command]

fn cmd_a() -> String {

"Command a"

}

#[tauri::command]

fn cmd_b() -> String {

"Command b"

}

#[cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {

tauri::Builder::default()

.invoke_handler(tauri::generate_handler![cmd_a, cmd_b])

.run(tauri::generate_context!())

.expect("error while running tauri application");

}
```

### Complete Example

[Section titled “Complete Example”](#complete-example)

Any or all of the above features can be combined:

src-tauri/src/lib.rs

```
struct Database;

#[derive(serde::Serialize)]

struct CustomResponse {

message: String,

other_val: usize,

}

async fn some_other_function() -> Option<String> {

Some("response".into())

}

#[tauri::command]

async fn my_custom_command(

window: tauri::WebviewWindow,

number: usize,

database: tauri::State<'_, Database>,

) -> Result<CustomResponse, String> {

println!("Called from {}", window.label());

let result: Option<String> = some_other_function().await;

if let Some(message) = result {

Ok(CustomResponse {

message,

other_val: 42 + number,

})

} else {

Err("No result".into())

}

}

#[cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {

tauri::Builder::default()

.manage(Database {})

.invoke_handler(tauri::generate_handler![my_custom_command])

.run(tauri::generate_context!())

.expect("error while running tauri application");

}
```

```
import { invoke } from '@tauri-apps/api/core';

// Invocation from JavaScript

invoke('my_custom_command', {

number: 42,

})

.then((res) =>

console.log(`Message: ${res.message}, Other Val: ${res.other_val}`)

)

.catch((e) => console.error(e));
```

## Event System

[Section titled “Event System”](#event-system)

The event system is a simpler communication mechanism between your frontend and the Rust.
Unlike commands, events are not type safe, are always async, cannot return values and only supports JSON payloads.

### Global Events

[Section titled “Global Events”](#global-events)

To trigger a global event you can use the [event.emit](/reference/javascript/api/namespaceevent/#emit) or the [WebviewWindow#emit](/reference/javascript/api/namespacewebviewwindow/#emit) functions:

```
import { emit } from '@tauri-apps/api/event';

import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

// emit(eventName, payload)

emit('file-selected', '/path/to/file');

const appWebview = getCurrentWebviewWindow();

appWebview.emit('route-changed', { url: window.location.href });
```

### Webview Event

[Section titled “Webview Event”](#webview-event)

To trigger an event to a listener registered by a specific webview you can use the [event.emitTo](/reference/javascript/api/namespaceevent/#emitto) or the [WebviewWindow#emitTo](/reference/javascript/api/namespacewebviewwindow/#emitto) functions:

```
import { emitTo } from '@tauri-apps/api/event';

import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

// emitTo(webviewLabel, eventName, payload)

emitTo('settings', 'settings-update-requested', {

key: 'notification',

value: 'all',

});

const appWebview = getCurrentWebviewWindow();

appWebview.emitTo('editor', 'file-changed', {

path: '/path/to/file',

contents: 'file contents',

});
```

### Listening to Events

[Section titled “Listening to Events”](#listening-to-events)

The `@tauri-apps/api` NPM package offers APIs to listen to both global and webview-specific events.

* Listening to global events

  ```
  import { listen } from '@tauri-apps/api/event';

  type DownloadStarted = {

  url: string;

  downloadId: number;

  contentLength: number;

  };

  listen<DownloadStarted>('download-started', (event) => {

  console.log(

  `downloading ${event.payload.contentLength} bytes from ${event.payload.url}`

  );

  });
  ```
* Listening to webview-specific events

  ```
  import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

  const appWebview = getCurrentWebviewWindow();

  appWebview.listen<string>('logged-in', (event) => {

  localStorage.setItem('session-token', event.payload);

  });
  ```

The `listen` function keeps the event listener registered for the entire lifetime of the application.
To stop listening on an event you can use the `unlisten` function which is returned by the `listen` function:

```
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen('download-started', (event) => {});

unlisten();
```

#### Common Pitfalls

[Section titled “Common Pitfalls”](#common-pitfalls)

##### Don’t call `unlisten()` before the listener resolves

[Section titled “Don’t call unlisten() before the listener resolves”](#dont-call-unlisten-before-the-listener-resolves)

The `listen` function returns a Promise that resolves to the `unlisten` handle.
If you call `unlisten` synchronously before the Promise resolves, the handler
will be removed immediately and you won’t receive any events:

```
// Wrong: unlisten is called before the listener is registered

const unlisten = listen('sync-complete', (event) => {

console.log('sync finished');

});

unlisten(); // unlisten is a Promise here, not a function -- the listener is not cleaned up

// Correct: await the Promise to get the unlisten handle

const unlisten = await listen('sync-complete', (event) => {

console.log('sync finished');

});

// Now you can store and call it later, e.g. in a cleanup function

unlisten();
```

##### Timing in setup hooks

[Section titled “Timing in setup hooks”](#timing-in-setup-hooks)

In frameworks like React, Vue, and Svelte, the setup or mount hook runs
before the component is fully rendered. If you listen for events during setup,
make sure the event handler does not depend on DOM elements that haven’t been
rendered yet, or defer the listener registration to an effect/hook that runs
after mount.

```
// Wrong: DOM ref may not be available yet

function MyComponent() {

const ref = useRef(null);

listen('scroll-to', (event) => {

ref.current.scrollIntoView(); // ref.current may be null during setup

});

return <div ref={ref} />;

}

// Correct: use useEffect which runs after the component mounts

function MyComponent() {

const ref = useRef(null);

useEffect(() => {

const unlisten = listen('scroll-to', (event) => {

ref.current?.scrollIntoView();

});

return () => {

unlisten.then((fn) => fn());

};

}, []);

return <div ref={ref} />;

}
```

##### Event ordering and async listeners

[Section titled “Event ordering and async listeners”](#event-ordering-and-async-listeners)

Event listeners are called in the order they are registered, but if a listener
is async and the event emitter sends multiple events in rapid succession,
the listeners may process events out of order. For ordered, high-throughput
data delivery, consider using [Channels](/develop/calling-frontend/#channels)
instead of the event system.

#### Framework-specific Cleanup Examples

[Section titled “Framework-specific Cleanup Examples”](#framework-specific-cleanup-examples)

When using a frontend framework, you should clean up event listeners when a
component is unmounted to avoid memory leaks and duplicate handlers.

* [React](#tab-panel-0-0)
* [Vue](#tab-panel-0-1)
* [Svelte](#tab-panel-0-2)

```
import { useEffect, useState } from 'react';

import { listen } from '@tauri-apps/api/event';

function DownloadTracker() {

const [progress, setProgress] = useState(0);

useEffect(() => {

const unlisten = listen<number>('download-progress', (event) => {

setProgress(event.payload);

});

return () => {

unlisten.then((fn) => fn());

};

}, []);

return <div>Download progress: {progress}%</div>;

}
```

```
<script setup lang="ts">

import { ref, onMounted, onUnmounted } from 'vue';

import { listen } from '@tauri-apps/api/event';

const progress = ref(0);

let unlistenPromise;

onMounted(() => {

unlistenPromise = listen<number>('download-progress', (event) => {

progress.value = event.payload;

});

});

onUnmounted(() => {

unlistenPromise?.then((fn) => fn());

});

</script>

<template>

<div>Download progress: {{ progress }}%</div>

</template>
```

```
<script lang="ts">

import { listen } from '@tauri-apps/api/event';

let progress = $state(0);

$effect(() => {

const unlistenPromise = listen<number>(

'download-progress',

(event) => {

progress = event.payload;

}

);

return () => {

unlistenPromise.then((unlisten) => unlisten());

};

});

</script>

<div>Download progress: {progress}%</div>
```

Additionally Tauri provides a utility function for listening to an event exactly once:

```
import { once } from '@tauri-apps/api/event';

import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';

once('ready', (event) => {});

const appWebview = getCurrentWebviewWindow();

appWebview.once('ready', () => {});
```

#### Listening to Events on Rust

[Section titled “Listening to Events on Rust”](#listening-to-events-on-rust)

Global and webview-specific events are also delivered to listeners registered in Rust.

* Listening to global events

  src-tauri/src/lib.rs

  ```
  use tauri::Listener;

  #[cfg_attr(mobile, tauri::mobile_entry_point)]

  pub fn run() {

  tauri::Builder::default()

  .setup(|app| {

  app.listen("download-started", |event| {

  if let Ok(payload) = serde_json::from_str::<DownloadStarted>(&event.payload()) {

  println!("downloading {}", payload.url);

  }

  });

  Ok(())

  })

  .run(tauri::generate_context!())

  .expect("error while running tauri application");

  }
  ```
* Listening to webview-specific events

  src-tauri/src/lib.rs

  ```
  use tauri::{Listener, Manager};

  #[cfg_attr(mobile, tauri::mobile_entry_point)]

  pub fn run() {

  tauri::Builder::default()

  .setup(|app| {

  let webview = app.get_webview_window("main").unwrap();

  webview.listen("logged-in", |event| {

  let session_token = event.data;

  // save token..

  });

  Ok(())

  })

  .run(tauri::generate_context!())

  .expect("error while running tauri application");

  }
  ```

The `listen` function keeps the event listener registered for the entire lifetime of the application.
To stop listening on an event you can use the `unlisten` function:

```
// unlisten outside of the event handler scope:

let event_id = app.listen("download-started", |event| {});

app.unlisten(event_id);

// unlisten when some event criteria is matched

let handle = app.handle().clone();

app.listen("status-changed", |event| {

if event.data == "ready" {

handle.unlisten(event.id);

}

});
```

Additionally Tauri provides a utility function for listening to an event exactly once:

```
app.once("ready", |event| {

println!("app is ready");

});
```

In this case the event listener is immediately unregistered after its first trigger.

To learn how to listen to events and emit events from your Rust code, see the [Rust Event System documentation](/develop/calling-frontend/#event-system).

---

[Support on Open Collective](https://opencollective.com/tauri)[Sponsor on GitHub](https://github.com/sponsors/tauri-apps)

© 2026 Tauri Contributors. CC-BY / MIT