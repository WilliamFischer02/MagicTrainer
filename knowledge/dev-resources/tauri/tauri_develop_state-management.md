# State Management

In a Tauri application, you often need to keep track of the current state of your application or manage the lifecycle of things associated with it. Tauri provides an easy way to manage the state of your application using the [`Manager`](https://docs.rs/tauri/latest/tauri/trait.Manager.html) API, and read it when commands are called.

Here is a simple example:

```
use tauri::{Builder, Manager};

struct AppData {

welcome_message: &'static str,

}

fn main() {

Builder::default()

.setup(|app| {

app.manage(AppData {

welcome_message: "Welcome to Tauri!",

});

Ok(())

})

.run(tauri::generate_context!())

.unwrap();

}
```

You can later access your state with any type that implements the [`Manager`](https://docs.rs/tauri/latest/tauri/trait.Manager.html) trait, for example the [`App`](https://docs.rs/tauri/latest/tauri/struct.App.html) instance:

```
let data = app.state::<AppData>();
```

For more info, including accessing state in commands, see the [Accessing State](#accessing-state) section.

## Mutability

[Section titled “Mutability”](#mutability)

In Rust, you cannot directly mutate values which are shared between multiple threads or when ownership is controlled through a shared pointer such as [`Arc`](https://doc.rust-lang.org/stable/std/sync/struct.Arc.html) (or Tauri’s [`State`](https://docs.rs/tauri/latest/tauri/struct.State.html)). Doing so could cause data races (for example, two writes happening simultaneously).

To work around this, you can use a concept known as [interior mutability](https://doc.rust-lang.org/book/ch15-05-interior-mutability.html). For example, the standard library’s [`Mutex`](https://doc.rust-lang.org/stable/std/sync/struct.Mutex.html) can be used to wrap your state. This allows you to lock the value when you need to modify it, and unlock it when you are done.

```
use std::sync::Mutex;

use tauri::{Builder, Manager};

#[derive(Default)]

struct AppState {

counter: u32,

}

fn main() {

Builder::default()

.setup(|app| {

app.manage(Mutex::new(AppState::default()));

Ok(())

})

.run(tauri::generate_context!())

.unwrap();

}
```

The state can now be modified by locking the mutex:

```
let state = app.state::<Mutex<AppState>>();

// Lock the mutex to get mutable access:

let mut state = state.lock().unwrap();

// Modify the state:

state.counter += 1;
```

At the end of the scope, or when the `MutexGuard` is otherwise dropped, the mutex is unlocked automatically so that other parts of your application can access and mutate the data within.

### When to use an async mutex

[Section titled “When to use an async mutex”](#when-to-use-an-async-mutex)

To quote the [Tokio documentation](https://docs.rs/tokio/latest/tokio/sync/struct.Mutex.html#which-kind-of-mutex-should-you-use), it’s often fine to use the standard library’s [`Mutex`](https://doc.rust-lang.org/stable/std/sync/struct.Mutex.html) instead of an async mutex such as the one Tokio provides:

> Contrary to popular belief, it is ok and often preferred to use the ordinary Mutex from the standard library in asynchronous code … The primary use case for the async mutex is to provide shared mutable access to IO resources such as a database connection.

It’s a good idea to read the linked documentation fully to understand the trade-offs between the two. One reason you *would* need an async mutex is if you need to hold the `MutexGuard` across await points.

### Do you need `Arc`?

[Section titled “Do you need Arc?”](#do-you-need-arc)

It’s common to see [`Arc`](https://doc.rust-lang.org/stable/std/sync/struct.Arc.html) used in Rust to share ownership of a value across multiple threads (usually paired with a [`Mutex`](https://doc.rust-lang.org/stable/std/sync/struct.Mutex.html) in the form of `Arc<Mutex<T>>`). However, you don’t need to use [`Arc`](https://doc.rust-lang.org/stable/std/sync/struct.Arc.html) for things stored in [`State`](https://docs.rs/tauri/latest/tauri/struct.State.html) because Tauri will do this for you.

In case `State`’s lifetime requirements prevent you from moving your state into a new thread you can instead move an `AppHandle` into the thread and then retrieve your state as shown below in the “[Access state with the Manager trait](#access-state-with-the-manager-trait)” section. `AppHandle`s are deliberately cheap to clone for use-cases like this.

## Accessing State

[Section titled “Accessing State”](#accessing-state)

### Access state in commands

[Section titled “Access state in commands”](#access-state-in-commands)

```
#[tauri::command]

fn increase_counter(state: State<'_, Mutex<AppState>>) -> u32 {

let mut state = state.lock().unwrap();

state.counter += 1;

state.counter

}
```

For more information on commands, see [Calling Rust from the Frontend](/develop/calling-rust/).

#### Async commands

[Section titled “Async commands”](#async-commands)

If you are using `async` commands and want to use Tokio’s async [`Mutex`](https://docs.rs/tokio/latest/tokio/sync/struct.Mutex.html), you can set it up the same way and access the state like this:

```
#[tauri::command]

async fn increase_counter(state: State<'_, Mutex<AppState>>) -> Result<u32, ()> {

let mut state = state.lock().await;

state.counter += 1;

Ok(state.counter)

}
```

Note that the return type must be [`Result`](https://doc.rust-lang.org/stable/std/result/index.html) if you use asynchronous commands.

### Access state with the [`Manager`](https://docs.rs/tauri/latest/tauri/trait.Manager.html) trait

[Section titled “Access state with the Manager trait”](#access-state-with-the-manager-trait)

Sometimes you may need to access the state outside of commands, such as in a different thread or in an event handler like `on_window_event`. In such cases, you can use the `state()` method of types that implement the [`Manager`](https://docs.rs/tauri/latest/tauri/trait.Manager.html) trait (such as the `AppHandle`) to get the state:

```
use std::sync::Mutex;

use tauri::{Builder, Window, WindowEvent, Manager};

#[derive(Default)]

struct AppState {

counter: u32,

}

// In an event handler:

fn on_window_event(window: &Window, _event: &WindowEvent) {

// Get a handle to the app so we can get the global state.

let app_handle = window.app_handle();

let state = app_handle.state::<Mutex<AppState>>();

// Lock the mutex to mutably access the state.

let mut state = state.lock().unwrap();

state.counter += 1;

}

fn main() {

Builder::default()

.setup(|app| {

app.manage(Mutex::new(AppState::default()));

Ok(())

})

.on_window_event(on_window_event)

.run(tauri::generate_context!())

.unwrap();

}
```

This method is useful when you cannot rely on command injection. For example, if you need to move the state into a thread where using an `AppHandle` is easier, or if you are not in a command context.

## Mismatching Types

[Section titled “Mismatching Types”](#mismatching-types)

If you prefer, you can wrap your state with a type alias to prevent this mistake:

```
use std::sync::Mutex;

#[derive(Default)]

struct AppStateInner {

counter: u32,

}

type AppState = Mutex<AppStateInner>;
```

However, make sure to use the type alias as it is, and not wrap it in a [`Mutex`](https://doc.rust-lang.org/stable/std/sync/struct.Mutex.html) a second time, otherwise you will run into the same issue.

---

[Support on Open Collective](https://opencollective.com/tauri)[Sponsor on GitHub](https://github.com/sponsors/tauri-apps)

© 2026 Tauri Contributors. CC-BY / MIT