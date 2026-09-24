# Dialog

[GitHub](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/dialog)[npm](https://www.npmx.dev/package/@tauri-apps/plugin-dialog)[crates.io](https://crates.io/crates/tauri-plugin-dialog)

API Reference:

Native system dialogs for opening and saving files along with message dialogs.

## Supported Platforms

[Section titled “Supported Platforms”](#supported-platforms)

*This plugin requires a Rust version of at least **1.77.2***

| Platform | Level | Notes |
| --- | --- | --- |
| windows |  |  |
| linux |  |  |
| macos |  |  |
| android |  | Does not support folder picker |
| ios |  | Does not support folder picker |

## Setup

[Section titled “Setup”](#setup)

Install the dialog plugin to get started.

* [Automatic](#tab-panel-2-0)
* [Manual](#tab-panel-2-1)

Use your project’s package manager to add the dependency:

* [npm](#tab-panel-0-0)
* [yarn](#tab-panel-0-1)
* [pnpm](#tab-panel-0-2)
* [deno](#tab-panel-0-3)
* [bun](#tab-panel-0-4)
* [cargo](#tab-panel-0-5)

```
npm run tauri add dialog
```

```
yarn run tauri add dialog
```

```
pnpm tauri add dialog
```

```
deno task tauri add dialog
```

```
bun tauri add dialog
```

```
cargo tauri add dialog
```

1. Run the following command in the `src-tauri` folder to add the plugin to the project’s dependencies in `Cargo.toml`:

   ```
   cargo add tauri-plugin-dialog
   ```
2. Modify `lib.rs` to initialize the plugin:

   src-tauri/src/lib.rs

   ```
   #[cfg_attr(mobile, tauri::mobile_entry_point)]

   pub fn run() {

   tauri::Builder::default()

   .plugin(tauri_plugin_dialog::init())

   .run(tauri::generate_context!())

   .expect("error while running tauri application");

   }
   ```
3. If you’d like create dialogs in JavaScript, install the npm package as well:

   * [npm](#tab-panel-1-0)
   * [yarn](#tab-panel-1-1)
   * [pnpm](#tab-panel-1-2)
   * [deno](#tab-panel-1-3)
   * [bun](#tab-panel-1-4)

   ```
   npm install @tauri-apps/plugin-dialog
   ```

   ```
   yarn add @tauri-apps/plugin-dialog
   ```

   ```
   pnpm add @tauri-apps/plugin-dialog
   ```

   ```
   deno add npm:@tauri-apps/plugin-dialog
   ```

   ```
   bun add @tauri-apps/plugin-dialog
   ```

## Usage

[Section titled “Usage”](#usage)

The dialog plugin is available in both JavaScript and Rust. Here’s how you can use it:

in JavaScript:

* [Create Yes/No Dialog](#create-yesno-dialog)
* [Create Ok/Cancel Dialog](#create-okcancel-dialog)
* [Create Message Dialog](#create-message-dialog)
* [Open a File Selector Dialog](#open-a-file-selector-dialog)
* [Save to File Dialog](#save-to-file-dialog)

in Rust:

* [Build an Ask Dialog](#build-an-ask-dialog)
* [Build a Message Dialog](#build-a-message-dialog)
* [Build a File Selector Dialog](#build-a-file-selector-dialog)

### JavaScript

[Section titled “JavaScript”](#javascript)

See all [Dialog Options](/reference/javascript/dialog/) at the JavaScript API reference.

#### Create Yes/No Dialog

[Section titled “Create Yes/No Dialog”](#create-yesno-dialog)

Shows a question dialog with `Yes` and `No` buttons.

```
import { ask } from '@tauri-apps/plugin-dialog';

// when using `"withGlobalTauri": true`, you may use

// const { ask } = window.__TAURI__.dialog;

// Create a Yes/No dialog

const answer = await ask('This action cannot be reverted. Are you sure?', {

title: 'Tauri',

kind: 'warning',

});

console.log(answer);

// Prints boolean to the console
```

#### Create Ok/Cancel Dialog

[Section titled “Create Ok/Cancel Dialog”](#create-okcancel-dialog)

Shows a question dialog with `Ok` and `Cancel` buttons.

```
import { confirm } from '@tauri-apps/plugin-dialog';

// when using `"withGlobalTauri": true`, you may use

// const { confirm } = window.__TAURI__.dialog;

// Creates a confirmation Ok/Cancel dialog

const confirmation = await confirm(

'This action cannot be reverted. Are you sure?',

{ title: 'Tauri', kind: 'warning' }

);

console.log(confirmation);

// Prints boolean to the console
```

#### Create Message Dialog

[Section titled “Create Message Dialog”](#create-message-dialog)

Shows a message dialog with an `Ok` button. Keep in mind that if the user closes the dialog it will return `false`.

```
import { message } from '@tauri-apps/plugin-dialog';

// when using `"withGlobalTauri": true`, you may use

// const { message } = window.__TAURI__.dialog;

// Shows message

await message('File not found', { title: 'Tauri', kind: 'error' });
```

#### Open a File Selector Dialog

[Section titled “Open a File Selector Dialog”](#open-a-file-selector-dialog)

Open a file/directory selection dialog.

The `multiple` option controls whether the dialog allows multiple selection or not, while the `directory`, whether is a directory selection or not.

```
import { open } from '@tauri-apps/plugin-dialog';

// when using `"withGlobalTauri": true`, you may use

// const { open } = window.__TAURI__.dialog;

// Open a dialog

const file = await open({

multiple: false,

directory: false,

});

console.log(file);

// Prints file path or URI
```

#### Save to File Dialog

[Section titled “Save to File Dialog”](#save-to-file-dialog)

Open a file/directory save dialog.

```
import { save } from '@tauri-apps/plugin-dialog';

// when using `"withGlobalTauri": true`, you may use

// const { save } = window.__TAURI__.dialog;

// Prompt to save a 'My Filter' with extension .png or .jpeg

const path = await save({

filters: [

{

name: 'My Filter',

extensions: ['png', 'jpeg'],

},

],

});

console.log(path);

// Prints the chosen path
```

---

### Rust

[Section titled “Rust”](#rust)

Refer to the [Rust API reference](https://docs.rs/tauri-plugin-dialog/) to see all available options.

#### Build an Ask Dialog

[Section titled “Build an Ask Dialog”](#build-an-ask-dialog)

Shows a question dialog with `Absolutely` and `Totally` buttons.

```
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

let answer = app.dialog()

.message("Tauri is Awesome")

.title("Tauri is Awesome")

.buttons(MessageDialogButtons::OkCancelCustom("Absolutely", "Totally"))

.blocking_show();
```

If you need a non blocking operation you can use `show()` instead:

```
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

app.dialog()

.message("Tauri is Awesome")

.title("Tauri is Awesome")

.buttons(MessageDialogButtons::OkCancelCustom("Absolutely", "Totally"))

.show(|result| match result {

true => // do something,

false =>// do something,

});
```

#### Build a Message Dialog

[Section titled “Build a Message Dialog”](#build-a-message-dialog)

Shows a message dialog with an `Ok` button. Keep in mind that if the user closes the dialog it will return `false`.

```
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

let ans = app.dialog()

.message("File not found")

.kind(MessageDialogKind::Error)

.title("Warning")

.blocking_show();
```

If you need a non blocking operation you can use `show()` instead:

```
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

app.dialog()

.message("Tauri is Awesome")

.kind(MessageDialogKind::Info)

.title("Information")

.buttons(MessageDialogButtons::OkCustom("Absolutely"))

.show(|result| match result {

true => // do something,

false => // do something,

});
```

#### Build a File Selector Dialog

[Section titled “Build a File Selector Dialog”](#build-a-file-selector-dialog)

#### Pick Files

[Section titled “Pick Files”](#pick-files)

```
use tauri_plugin_dialog::DialogExt;

let file_path = app.dialog().file().blocking_pick_file();

// return a file_path `Option`, or `None` if the user closes the dialog
```

If you need a non blocking operation you can use `pick_file()` instead:

```
use tauri_plugin_dialog::DialogExt;

app.dialog().file().pick_file(|file_path| {

// return a file_path `Option`, or `None` if the user closes the dialog

})
```

#### Save Files

[Section titled “Save Files”](#save-files)

```
use tauri_plugin_dialog::DialogExt;

let file_path = app

.dialog()

.file()

.add_filter("My Filter", &["png", "jpeg"])

.blocking_save_file();

// do something with the optional file path here

// the file path is `None` if the user closed the dialog
```

or, alternatively:

```
use tauri_plugin_dialog::DialogExt;

app.dialog()

.file()

.add_filter("My Filter", &["png", "jpeg"])

.pick_file(|file_path| {

// return a file_path `Option`, or `None` if the user closes the dialog

});
```

## [Default Permission](#default-permission)

This permission set configures the types of dialogs
available from the dialog plugin.

#### [Granted Permissions](#granted-permissions)

All dialog types are enabled.

#### This default permission set includes the following:

* `allow-message`
* `allow-save`
* `allow-open`

## Permission Table

| Identifier | Description |
| --- | --- |
| `dialog:allow-ask` | Enables the ask command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `allow-message` and will be removed in v3) |
| `dialog:deny-ask` | Denies the ask command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `deny-message` and will be removed in v3) |
| `dialog:allow-message` | Enables the message command without any pre-configured scope. |
| `dialog:deny-message` | Denies the message command without any pre-configured scope. |
| `dialog:allow-open` | Enables the open command without any pre-configured scope. |
| `dialog:deny-open` | Denies the open command without any pre-configured scope. |
| `dialog:allow-save` | Enables the save command without any pre-configured scope. |
| `dialog:deny-save` | Denies the save command without any pre-configured scope. |
| `dialog:allow-confirm` | Enables the confirm command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `allow-message` and will be removed in v3) |
| `dialog:deny-confirm` | Denies the confirm command without any pre-configured scope. (**DEPRECATED**: This is now an alias to `deny-message` and will be removed in v3) |

---

[Support on Open Collective](https://opencollective.com/tauri)[Sponsor on GitHub](https://github.com/sponsors/tauri-apps)

© 2026 Tauri Contributors. CC-BY / MIT