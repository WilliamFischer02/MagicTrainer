# File System

[GitHub](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/fs)[npm](https://www.npmx.dev/package/@tauri-apps/plugin-fs)[crates.io](https://crates.io/crates/tauri-plugin-fs)

API Reference:

Access the file system.

## Supported Platforms

[Section titled “Supported Platforms”](#supported-platforms)

*This plugin requires a Rust version of at least **1.77.2***

| Platform | Level | Notes |
| --- | --- | --- |
| windows |  | Apps installed via MSI or NSIS in `perMachine` and `both` mode require admin permissions for write access in `$RESOURCES` folder |
| linux |  | No write access to `$RESOURCES` folder |
| macos |  | No write access to `$RESOURCES` folder |
| android |  | Access is restricted to Application folder by default |
| ios |  | Access is restricted to Application folder by default |

## Setup

[Section titled “Setup”](#setup)

Install the fs plugin to get started.

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
npm run tauri add fs
```

```
yarn run tauri add fs
```

```
pnpm tauri add fs
```

```
deno task tauri add fs
```

```
bun tauri add fs
```

```
cargo tauri add fs
```

1. Run the following command in the `src-tauri` folder to add the plugin to the project’s dependencies in `Cargo.toml`:

   ```
   cargo add tauri-plugin-fs
   ```
2. Modify `lib.rs` to initialize the plugin:

   src-tauri/src/lib.rs

   ```
   #[cfg_attr(mobile, tauri::mobile_entry_point)]

   pub fn run() {

   tauri::Builder::default()

   .plugin(tauri_plugin_fs::init())

   .run(tauri::generate_context!())

   .expect("error while running tauri application");

   }
   ```
3. Install the JavaScript Guest bindings using your preferred JavaScript package manager:

   * [npm](#tab-panel-1-0)
   * [yarn](#tab-panel-1-1)
   * [pnpm](#tab-panel-1-2)
   * [deno](#tab-panel-1-3)
   * [bun](#tab-panel-1-4)

   ```
   npm install @tauri-apps/plugin-fs
   ```

   ```
   yarn add @tauri-apps/plugin-fs
   ```

   ```
   pnpm add @tauri-apps/plugin-fs
   ```

   ```
   deno add npm:@tauri-apps/plugin-fs
   ```

   ```
   bun add @tauri-apps/plugin-fs
   ```

## Configuration

[Section titled “Configuration”](#configuration)

### Android

[Section titled “Android”](#android)

When using the audio, cache, documents, downloads, picture, public or video directories your app must have access to the external storage.

Include the following permissions to the `manifest` tag in the `gen/android/app/src/main/AndroidManifest.xml` file:

```
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>

<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

### iOS

[Section titled “iOS”](#ios)

Apple requires app developers to specify approved reasons for API usage to enhance user privacy.

You must create a `PrivacyInfo.xcprivacy` file in the `src-tauri/gen/apple` folder
with the required [NSPrivacyAccessedAPICategoryFileTimestamp](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api#4278393) key and the [C617.1](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api#4278393) recommended reason.

```
<?xml version="1.0" encoding="UTF-8"?>

<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">

<plist version="1.0">

<dict>

<key>NSPrivacyAccessedAPITypes</key>

<array>

<dict>

<key>NSPrivacyAccessedAPIType</key>

<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>

<key>NSPrivacyAccessedAPITypeReasons</key>

<array>

<string>C617.1</string>

</array>

</dict>

</array>

</dict>

</plist>
```

## Usage

[Section titled “Usage”](#usage)

The fs plugin is available in both JavaScript and Rust.

* [JavaScript](#tab-panel-3-0)
* [Rust](#tab-panel-3-1)

```
import { exists, BaseDirectory } from '@tauri-apps/plugin-fs';

// when using `"withGlobalTauri": true`, you may use

// const { exists, BaseDirectory } = window.__TAURI__.fs;

// Check if the `$APPDATA/avatar.png` file exists

await exists('avatar.png', { baseDir: BaseDirectory.AppData });
```

src-tauri/src/lib.rs

```
use tauri_plugin_fs::FsExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]

pub fn run() {

tauri::Builder::default()

.plugin(tauri_plugin_fs::init())

.setup(|app| {

// allowed the given directory

let scope = app.fs_scope();

scope.allow_directory("/path/to/directory", false);

dbg!(scope.allowed());

Ok(())

})

.run(tauri::generate_context!())

.expect("error while running tauri application");

}
```

## Security

[Section titled “Security”](#security)

This module prevents path traversal, not allowing parent directory accessors to be used
(i.e. “/usr/path/to/../file” or “../path/to/file” paths are not allowed).
Paths accessed with this API must be either relative to one of the [base directories](/reference/javascript/api/namespacepath/#basedirectory)
or created with the [path API](/reference/javascript/api/namespacepath/).

See [@tauri-apps/plugin-fs - Security](/reference/javascript/fs/#security) for more information.

## Paths

[Section titled “Paths”](#paths)

The file system plugin offers two ways of manipulating paths: the [base directory](/reference/javascript/api/namespacepath/#basedirectory) and the [path API](/reference/javascript/api/namespacepath/).

* base directory

  Every API has an options argument that lets you define a [baseDir](/reference/javascript/api/namespacepath/#basedirectory) that acts as the working directory of the operation.

  ```
  import { readFile } from '@tauri-apps/plugin-fs';

  const contents = await readFile('avatars/tauri.png', {

  baseDir: BaseDirectory.Home,

  });
  ```

  In the above example the ~/avatars/tauri.png file is read since we are using the **Home** base directory.
* path API

  Alternatively you can use the path APIs to perform path manipulations.

  ```
  import { readFile } from '@tauri-apps/plugin-fs';

  import * as path from '@tauri-apps/api/path';

  const home = await path.homeDir();

  const contents = await readFile(await path.join(home, 'avatars/tauri.png'));
  ```

## Files

[Section titled “Files”](#files)

### Create

[Section titled “Create”](#create)

Creates a file and returns a handle to it. If the file already exists, it is truncated.

```
import { create, BaseDirectory } from '@tauri-apps/plugin-fs';

const file = await create('foo/bar.txt', { baseDir: BaseDirectory.AppData });

await file.write(new TextEncoder().encode('Hello world'));

await file.close();
```

### Write

[Section titled “Write”](#write)

The plugin offers separate APIs for writing text and binary files for performance.

* text files

  ```
  import { writeTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

  const contents = JSON.stringify({ notifications: true });

  await writeTextFile('config.json', contents, {

  baseDir: BaseDirectory.AppConfig,

  });
  ```
* binary files

  ```
  import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';

  const contents = new Uint8Array(); // fill a byte array

  await writeFile('config', contents, {

  baseDir: BaseDirectory.AppConfig,

  });
  ```

### Open

[Section titled “Open”](#open)

Opens a file and returns a handle to it.
With this API you have more control over how the file should be opened
(read-only mode, write-only mode, append instead of overwrite, only create if it does not exist, etc).

* read-only

  This is the default mode.

  ```
  import { open, BaseDirectory } from '@tauri-apps/plugin-fs';

  const file = await open('foo/bar.txt', {

  read: true,

  baseDir: BaseDirectory.AppData,

  });

  const stat = await file.stat();

  const buf = new Uint8Array(stat.size);

  await file.read(buf);

  const textContents = new TextDecoder().decode(buf);

  await file.close();
  ```
* write-only

  ```
  import { open, BaseDirectory } from '@tauri-apps/plugin-fs';

  const file = await open('foo/bar.txt', {

  write: true,

  baseDir: BaseDirectory.AppData,

  });

  await file.write(new TextEncoder().encode('Hello world'));

  await file.close();
  ```

  By default the file is truncated on any `file.write()` call.
  See the following example to learn how to append to the existing contents instead.
* append

  ```
  import { open, BaseDirectory } from '@tauri-apps/plugin-fs';

  const file = await open('foo/bar.txt', {

  append: true,

  baseDir: BaseDirectory.AppData,

  });

  await file.write(new TextEncoder().encode('world'));

  await file.close();
  ```

  Note that `{ append: true }` has the same effect as `{ write: true, append: true }`.
* truncate

  When the `truncate` option is set and the file already exists, it will be truncated to length 0.

  ```
  import { open, BaseDirectory } from '@tauri-apps/plugin-fs';

  const file = await open('foo/bar.txt', {

  write: true,

  truncate: true,

  baseDir: BaseDirectory.AppData,

  });

  await file.write(new TextEncoder().encode('world'));

  await file.close();
  ```

  This option requires `write` to be `true`.

  You can use it along the `append` option if you want to rewrite an existing file using multiple `file.write()` calls.
* create

  By default the `open` API only opens existing files. To create the file if it does not exist,
  opening it if it does, set `create` to `true`:

  ```
  import { open, BaseDirectory } from '@tauri-apps/plugin-fs';

  const file = await open('foo/bar.txt', {

  write: true,

  create: true,

  baseDir: BaseDirectory.AppData,

  });

  await file.write(new TextEncoder().encode('world'));

  await file.close();
  ```

  In order for the file to be created, `write` or `append` must also be set to `true`.

  To fail if the file already exists, see `createNew`.
* createNew

  `createNew` works similarly to `create`, but will fail if the file already exists.

  ```
  import { open, BaseDirectory } from '@tauri-apps/plugin-fs';

  const file = await open('foo/bar.txt', {

  write: true,

  createNew: true,

  baseDir: BaseDirectory.AppData,

  });

  await file.write(new TextEncoder().encode('world'));

  await file.close();
  ```

  In order for the file to be created, `write` must also be set to `true`.

### Read

[Section titled “Read”](#read)

The plugin offers separate APIs for reading text and binary files for performance.

* text files

  ```
  import { readTextFile, BaseDirectory } from '@tauri-apps/plugin-fs';

  const configToml = await readTextFile('config.toml', {

  baseDir: BaseDirectory.AppConfig,

  });
  ```

  If the file is large you can stream its lines with the `readTextFileLines` API:

  ```
  import { readTextFileLines, BaseDirectory } from '@tauri-apps/plugin-fs';

  const lines = await readTextFileLines('app.logs', {

  baseDir: BaseDirectory.AppLog,

  });

  for await (const line of lines) {

  console.log(line);

  }
  ```
* binary files

  ```
  import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs';

  const icon = await readFile('icon.png', {

  baseDir: BaseDirectory.Resources,

  });
  ```

### Remove

[Section titled “Remove”](#remove)

Call `remove()` to delete a file. If the file does not exist, an error is returned.

```
import { remove, BaseDirectory } from '@tauri-apps/plugin-fs';

await remove('user.db', { baseDir: BaseDirectory.AppLocalData });
```

### Copy

[Section titled “Copy”](#copy)

The `copyFile` function takes the source and destination paths.
Note that you must configure each base directory separately.

```
import { copyFile, BaseDirectory } from '@tauri-apps/plugin-fs';

await copyFile('user.db', 'user.db.bk', {

fromPathBaseDir: BaseDirectory.AppLocalData,

toPathBaseDir: BaseDirectory.Temp,

});
```

In the above example the <app-local-data>/user.db file is copied to $TMPDIR/user.db.bk.

### Exists

[Section titled “Exists”](#exists)

Use the `exists()` function to check if a file exists:

```
import { exists, BaseDirectory } from '@tauri-apps/plugin-fs';

const tokenExists = await exists('token', {

baseDir: BaseDirectory.AppLocalData,

});
```

### Metadata

[Section titled “Metadata”](#metadata)

File metadata can be retrieved with the `stat` and the `lstat` functions.
`stat` follows symlinks (and returns an error if the actual file it points to is not allowed by the scope)
and `lstat` does not follow symlinks, returning the information of the symlink itself.

```
import { stat, BaseDirectory } from '@tauri-apps/plugin-fs';

const metadata = await stat('app.db', {

baseDir: BaseDirectory.AppLocalData,

});
```

### Rename

[Section titled “Rename”](#rename)

The `rename` function takes the source and destination paths.
Note that you must configure each base directory separately.

```
import { rename, BaseDirectory } from '@tauri-apps/plugin-fs';

await rename('user.db.bk', 'user.db', {

fromPathBaseDir: BaseDirectory.AppLocalData,

toPathBaseDir: BaseDirectory.Temp,

});
```

In the above example the <app-local-data>/user.db.bk file is renamed to $TMPDIR/user.db.

### Truncate

[Section titled “Truncate”](#truncate)

Truncates or extends the specified file to reach the specified file length (defaults to 0).

* truncate to 0 length

```
import { truncate } from '@tauri-apps/plugin-fs';

await truncate('my_file.txt', 0, { baseDir: BaseDirectory.AppLocalData });
```

* truncate to a specific length

```
import {

truncate,

readTextFile,

writeTextFile,

BaseDirectory,

} from '@tauri-apps/plugin-fs';

const filePath = 'file.txt';

await writeTextFile(filePath, 'Hello World', {

baseDir: BaseDirectory.AppLocalData,

});

await truncate(filePath, 7, {

baseDir: BaseDirectory.AppLocalData,

});

const data = await readTextFile(filePath, {

baseDir: BaseDirectory.AppLocalData,

});

console.log(data); // "Hello W"
```

## Directories

[Section titled “Directories”](#directories)

### Create

[Section titled “Create”](#create-1)

To create a directory, call the `mkdir` function:

```
import { mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';

await mkdir('images', {

baseDir: BaseDirectory.AppLocalData,

});
```

### Read

[Section titled “Read”](#read-1)

The `readDir` function recursively lists the entries of a directory:

```
import { readDir, BaseDirectory } from '@tauri-apps/plugin-fs';

const entries = await readDir('users', { baseDir: BaseDirectory.AppLocalData });
```

### Remove

[Section titled “Remove”](#remove-1)

Call `remove()` to delete a directory. If the directory does not exist, an error is returned.

```
import { remove, BaseDirectory } from '@tauri-apps/plugin-fs';

await remove('images', { baseDir: BaseDirectory.AppLocalData });
```

If the directory is not empty, the `recursive` option must be set to `true`:

```
import { remove, BaseDirectory } from '@tauri-apps/plugin-fs';

await remove('images', {

baseDir: BaseDirectory.AppLocalData,

recursive: true,

});
```

### Exists

[Section titled “Exists”](#exists-1)

Use the `exists()` function to check if a directory exists:

```
import { exists, BaseDirectory } from '@tauri-apps/plugin-fs';

const tokenExists = await exists('images', {

baseDir: BaseDirectory.AppLocalData,

});
```

### Metadata

[Section titled “Metadata”](#metadata-1)

Directory metadata can be retrieved with the `stat` and the `lstat` functions.
`stat` follows symlinks (and returns an error if the actual file it points to is not allowed by the scope)
and `lstat` does not follow symlinks, returning the information of the symlink itself.

```
import { stat, BaseDirectory } from '@tauri-apps/plugin-fs';

const metadata = await stat('databases', {

baseDir: BaseDirectory.AppLocalData,

});
```

## Watching changes

[Section titled “Watching changes”](#watching-changes)

To watch a directory or file for changes, use the `watch` or `watchImmediate` functions.

* watch

  `watch` is debounced so it only emits events after a certain delay:

  ```
  import { watch, BaseDirectory } from '@tauri-apps/plugin-fs';

  await watch(

  'app.log',

  (event) => {

  console.log('app.log event', event);

  },

  {

  baseDir: BaseDirectory.AppLog,

  delayMs: 500,

  }

  );
  ```
* watchImmediate

  `watchImmediate` immediately notifies listeners of an event:

  ```
  import { watchImmediate, BaseDirectory } from '@tauri-apps/plugin-fs';

  await watchImmediate(

  'logs',

  (event) => {

  console.log('logs directory event', event);

  },

  {

  baseDir: BaseDirectory.AppLog,

  recursive: true,

  }

  );
  ```

By default watch operations on a directory are not recursive.
Set the `recursive` option to `true` to recursively watch for changes on all sub-directories.

## Permissions

[Section titled “Permissions”](#permissions)

By default all potentially dangerous plugin commands and scopes are blocked and cannot be accessed. You must modify the permissions in your `capabilities` configuration to enable these.

See the [Capabilities Overview](/security/capabilities/) for more information and the [step by step guide](/learn/security/using-plugin-permissions/) to use plugin permissions.

src-tauri/capabilities/default.json

```
{

"$schema": "../gen/schemas/desktop-schema.json",

"identifier": "main-capability",

"description": "Capability for the main window",

"windows": ["main"],

"permissions": [

"fs:default",

{

"identifier": "fs:allow-exists",

"allow": [{ "path": "$APPDATA/*" }]

}

]

}
```

## [Default Permission](#default-permission)

This set of permissions describes the what kind of
file system access the `fs` plugin has enabled or denied by default.

#### [Granted Permissions](#granted-permissions)

This default permission set enables read access to the
application specific directories (AppConfig, AppData, AppLocalData, AppCache,
AppLog) and all files and sub directories created in it.
The location of these directories depends on the operating system,
where the application is run.

In general these directories need to be manually created
by the application at runtime, before accessing files or folders
in it is possible.

Therefore, it is also allowed to create all of these folders via
the `mkdir` command.

#### Denied Permissions

This default permission set prevents access to critical components
of the Tauri application by default.

* On Windows the access to webview data folder `$APPLOCALDATA/EBWebView` is denied.
* On Linux the access to webview data paths inside `$APPLOCALDATA` are denied.

#### This default permission set includes the following:

* `create-app-specific-dirs`
* `read-app-specific-dirs-recursive`
* `deny-default`

## Permission Table

| Identifier | Description |
| --- | --- |
| `fs:allow-app-read-recursive` | This allows full recursive read access to the complete application folders, files and subdirectories. |
| `fs:allow-app-write-recursive` | This allows full recursive write access to the complete application folders, files and subdirectories. |
| `fs:allow-app-read` | This allows non-recursive read access to the application folders. |
| `fs:allow-app-write` | This allows non-recursive write access to the application folders. |
| `fs:allow-app-meta-recursive` | This allows full recursive read access to metadata of the application folders, including file listing and statistics. |
| `fs:allow-app-meta` | This allows non-recursive read access to metadata of the application folders, including file listing and statistics. |
| `fs:scope-app-recursive` | This scope permits recursive access to the complete application folders, including sub directories and files. |
| `fs:scope-app` | This scope permits access to all files and list content of top level directories in the application folders. |
| `fs:scope-app-index` | This scope permits to list all files and folders in the application directories. |
| `fs:allow-appcache-read-recursive` | This allows full recursive read access to the complete `$APPCACHE` folder, files and subdirectories. |
| `fs:allow-appcache-write-recursive` | This allows full recursive write access to the complete `$APPCACHE` folder, files and subdirectories. |
| `fs:allow-appcache-read` | This allows non-recursive read access to the `$APPCACHE` folder. |
| `fs:allow-appcache-write` | This allows non-recursive write access to the `$APPCACHE` folder. |
| `fs:allow-appcache-meta-recursive` | This allows full recursive read access to metadata of the `$APPCACHE` folder, including file listing and statistics. |
| `fs:allow-appcache-meta` | This allows non-recursive read access to metadata of the `$APPCACHE` folder, including file listing and statistics. |
| `fs:scope-appcache-recursive` | This scope permits recursive access to the complete `$APPCACHE` folder, including sub directories and files. |
| `fs:scope-appcache` | This scope permits access to all files and list content of top level directories in the `$APPCACHE` folder. |
| `fs:scope-appcache-index` | This scope permits to list all files and folders in the `$APPCACHE`folder. |
| `fs:allow-appconfig-read-recursive` | This allows full recursive read access to the complete `$APPCONFIG` folder, files and subdirectories. |
| `fs:allow-appconfig-write-recursive` | This allows full recursive write access to the complete `$APPCONFIG` folder, files and subdirectories. |
| `fs:allow-appconfig-read` | This allows non-recursive read access to the `$APPCONFIG` folder. |
| `fs:allow-appconfig-write` | This allows non-recursive write access to the `$APPCONFIG` folder. |
| `fs:allow-appconfig-meta-recursive` | This allows full recursive read access to metadata of the `$APPCONFIG` folder, including file listing and statistics. |
| `fs:allow-appconfig-meta` | This allows non-recursive read access to metadata of the `$APPCONFIG` folder, including file listing and statistics. |
| `fs:scope-appconfig-recursive` | This scope permits recursive access to the complete `$APPCONFIG` folder, including sub directories and files. |
| `fs:scope-appconfig` | This scope permits access to all files and list content of top level directories in the `$APPCONFIG` folder. |
| `fs:scope-appconfig-index` | This scope permits to list all files and folders in the `$APPCONFIG`folder. |
| `fs:allow-appdata-read-recursive` | This allows full recursive read access to the complete `$APPDATA` folder, files and subdirectories. |
| `fs:allow-appdata-write-recursive` | This allows full recursive write access to the complete `$APPDATA` folder, files and subdirectories. |
| `fs:allow-appdata-read` | This allows non-recursive read access to the `$APPDATA` folder. |
| `fs:allow-appdata-write` | This allows non-recursive write access to the `$APPDATA` folder. |
| `fs:allow-appdata-meta-recursive` | This allows full recursive read access to metadata of the `$APPDATA` folder, including file listing and statistics. |
| `fs:allow-appdata-meta` | This allows non-recursive read access to metadata of the `$APPDATA` folder, including file listing and statistics. |
| `fs:scope-appdata-recursive` | This scope permits recursive access to the complete `$APPDATA` folder, including sub directories and files. |
| `fs:scope-appdata` | This scope permits access to all files and list content of top level directories in the `$APPDATA` folder. |
| `fs:scope-appdata-index` | This scope permits to list all files and folders in the `$APPDATA`folder. |
| `fs:allow-applocaldata-read-recursive` | This allows full recursive read access to the complete `$APPLOCALDATA` folder, files and subdirectories. |
| `fs:allow-applocaldata-write-recursive` | This allows full recursive write access to the complete `$APPLOCALDATA` folder, files and subdirectories. |
| `fs:allow-applocaldata-read` | This allows non-recursive read access to the `$APPLOCALDATA` folder. |
| `fs:allow-applocaldata-write` | This allows non-recursive write access to the `$APPLOCALDATA` folder. |
| `fs:allow-applocaldata-meta-recursive` | This allows full recursive read access to metadata of the `$APPLOCALDATA` folder, including file listing and statistics. |
| `fs:allow-applocaldata-meta` | This allows non-recursive read access to metadata of the `$APPLOCALDATA` folder, including file listing and statistics. |
| `fs:scope-applocaldata-recursive` | This scope permits recursive access to the complete `$APPLOCALDATA` folder, including sub directories and files. |
| `fs:scope-applocaldata` | This scope permits access to all files and list content of top level directories in the `$APPLOCALDATA` folder. |
| `fs:scope-applocaldata-index` | This scope permits to list all files and folders in the `$APPLOCALDATA`folder. |
| `fs:allow-applog-read-recursive` | This allows full recursive read access to the complete `$APPLOG` folder, files and subdirectories. |
| `fs:allow-applog-write-recursive` | This allows full recursive write access to the complete `$APPLOG` folder, files and subdirectories. |
| `fs:allow-applog-read` | This allows non-recursive read access to the `$APPLOG` folder. |
| `fs:allow-applog-write` | This allows non-recursive write access to the `$APPLOG` folder. |
| `fs:allow-applog-meta-recursive` | This allows full recursive read access to metadata of the `$APPLOG` folder, including file listing and statistics. |
| `fs:allow-applog-meta` | This allows non-recursive read access to metadata of the `$APPLOG` folder, including file listing and statistics. |
| `fs:scope-applog-recursive` | This scope permits recursive access to the complete `$APPLOG` folder, including sub directories and files. |
| `fs:scope-applog` | This scope permits access to all files and list content of top level directories in the `$APPLOG` folder. |
| `fs:scope-applog-index` | This scope permits to list all files and folders in the `$APPLOG`folder. |
| `fs:allow-audio-read-recursive` | This allows full recursive read access to the complete `$AUDIO` folder, files and subdirectories. |
| `fs:allow-audio-write-recursive` | This allows full recursive write access to the complete `$AUDIO` folder, files and subdirectories. |
| `fs:allow-audio-read` | This allows non-recursive read access to the `$AUDIO` folder. |
| `fs:allow-audio-write` | This allows non-recursive write access to the `$AUDIO` folder. |
| `fs:allow-audio-meta-recursive` | This allows full recursive read access to metadata of the `$AUDIO` folder, including file listing and statistics. |
| `fs:allow-audio-meta` | This allows non-recursive read access to metadata of the `$AUDIO` folder, including file listing and statistics. |
| `fs:scope-audio-recursive` | This scope permits recursive access to the complete `$AUDIO` folder, including sub directories and files. |
| `fs:scope-audio` | This scope permits access to all files and list content of top level directories in the `$AUDIO` folder. |
| `fs:scope-audio-index` | This scope permits to list all files and folders in the `$AUDIO`folder. |
| `fs:allow-cache-read-recursive` | This allows full recursive read access to the complete `$CACHE` folder, files and subdirectories. |
| `fs:allow-cache-write-recursive` | This allows full recursive write access to the complete `$CACHE` folder, files and subdirectories. |
| `fs:allow-cache-read` | This allows non-recursive read access to the `$CACHE` folder. |
| `fs:allow-cache-write` | This allows non-recursive write access to the `$CACHE` folder. |
| `fs:allow-cache-meta-recursive` | This allows full recursive read access to metadata of the `$CACHE` folder, including file listing and statistics. |
| `fs:allow-cache-meta` | This allows non-recursive read access to metadata of the `$CACHE` folder, including file listing and statistics. |
| `fs:scope-cache-recursive` | This scope permits recursive access to the complete `$CACHE` folder, including sub directories and files. |
| `fs:scope-cache` | This scope permits access to all files and list content of top level directories in the `$CACHE` folder. |
| `fs:scope-cache-index` | This scope permits to list all files and folders in the `$CACHE`folder. |
| `fs:allow-config-read-recursive` | This allows full recursive read access to the complete `$CONFIG` folder, files and subdirectories. |
| `fs:allow-config-write-recursive` | This allows full recursive write access to the complete `$CONFIG` folder, files and subdirectories. |
| `fs:allow-config-read` | This allows non-recursive read access to the `$CONFIG` folder. |
| `fs:allow-config-write` | This allows non-recursive write access to the `$CONFIG` folder. |
| `fs:allow-config-meta-recursive` | This allows full recursive read access to metadata of the `$CONFIG` folder, including file listing and statistics. |
| `fs:allow-config-meta` | This allows non-recursive read access to metadata of the `$CONFIG` folder, including file listing and statistics. |
| `fs:scope-config-recursive` | This scope permits recursive access to the complete `$CONFIG` folder, including sub directories and files. |
| `fs:scope-config` | This scope permits access to all files and list content of top level directories in the `$CONFIG` folder. |
| `fs:scope-config-index` | This scope permits to list all files and folders in the `$CONFIG`folder. |
| `fs:allow-data-read-recursive` | This allows full recursive read access to the complete `$DATA` folder, files and subdirectories. |
| `fs:allow-data-write-recursive` | This allows full recursive write access to the complete `$DATA` folder, files and subdirectories. |
| `fs:allow-data-read` | This allows non-recursive read access to the `$DATA` folder. |
| `fs:allow-data-write` | This allows non-recursive write access to the `$DATA` folder. |
| `fs:allow-data-meta-recursive` | This allows full recursive read access to metadata of the `$DATA` folder, including file listing and statistics. |
| `fs:allow-data-meta` | This allows non-recursive read access to metadata of the `$DATA` folder, including file listing and statistics. |
| `fs:scope-data-recursive` | This scope permits recursive access to the complete `$DATA` folder, including sub directories and files. |
| `fs:scope-data` | This scope permits access to all files and list content of top level directories in the `$DATA` folder. |
| `fs:scope-data-index` | This scope permits to list all files and folders in the `$DATA`folder. |
| `fs:allow-desktop-read-recursive` | This allows full recursive read access to the complete `$DESKTOP` folder, files and subdirectories. |
| `fs:allow-desktop-write-recursive` | This allows full recursive write access to the complete `$DESKTOP` folder, files and subdirectories. |
| `fs:allow-desktop-read` | This allows non-recursive read access to the `$DESKTOP` folder. |
| `fs:allow-desktop-write` | This allows non-recursive write access to the `$DESKTOP` folder. |
| `fs:allow-desktop-meta-recursive` | This allows full recursive read access to metadata of the `$DESKTOP` folder, including file listing and statistics. |
| `fs:allow-desktop-meta` | This allows non-recursive read access to metadata of the `$DESKTOP` folder, including file listing and statistics. |
| `fs:scope-desktop-recursive` | This scope permits recursive access to the complete `$DESKTOP` folder, including sub directories and files. |
| `fs:scope-desktop` | This scope permits access to all files and list content of top level directories in the `$DESKTOP` folder. |
| `fs:scope-desktop-index` | This scope permits to list all files and folders in the `$DESKTOP`folder. |
| `fs:allow-document-read-recursive` | This allows full recursive read access to the complete `$DOCUMENT` folder, files and subdirectories. |
| `fs:allow-document-write-recursive` | This allows full recursive write access to the complete `$DOCUMENT` folder, files and subdirectories. |
| `fs:allow-document-read` | This allows non-recursive read access to the `$DOCUMENT` folder. |
| `fs:allow-document-write` | This allows non-recursive write access to the `$DOCUMENT` folder. |
| `fs:allow-document-meta-recursive` | This allows full recursive read access to metadata of the `$DOCUMENT` folder, including file listing and statistics. |
| `fs:allow-document-meta` | This allows non-recursive read access to metadata of the `$DOCUMENT` folder, including file listing and statistics. |
| `fs:scope-document-recursive` | This scope permits recursive access to the complete `$DOCUMENT` folder, including sub directories and files. |
| `fs:scope-document` | This scope permits access to all files and list content of top level directories in the `$DOCUMENT` folder. |
| `fs:scope-document-index` | This scope permits to list all files and folders in the `$DOCUMENT`folder. |
| `fs:allow-download-read-recursive` | This allows full recursive read access to the complete `$DOWNLOAD` folder, files and subdirectories. |
| `fs:allow-download-write-recursive` | This allows full recursive write access to the complete `$DOWNLOAD` folder, files and subdirectories. |
| `fs:allow-download-read` | This allows non-recursive read access to the `$DOWNLOAD` folder. |
| `fs:allow-download-write` | This allows non-recursive write access to the `$DOWNLOAD` folder. |
| `fs:allow-download-meta-recursive` | This allows full recursive read access to metadata of the `$DOWNLOAD` folder, including file listing and statistics. |
| `fs:allow-download-meta` | This allows non-recursive read access to metadata of the `$DOWNLOAD` folder, including file listing and statistics. |
| `fs:scope-download-recursive` | This scope permits recursive access to the complete `$DOWNLOAD` folder, including sub directories and files. |
| `fs:scope-download` | This scope permits access to all files and list content of top level directories in the `$DOWNLOAD` folder. |
| `fs:scope-download-index` | This scope permits to list all files and folders in the `$DOWNLOAD`folder. |
| `fs:allow-exe-read-recursive` | This allows full recursive read access to the complete `$EXE` folder, files and subdirectories. |
| `fs:allow-exe-write-recursive` | This allows full recursive write access to the complete `$EXE` folder, files and subdirectories. |
| `fs:allow-exe-read` | This allows non-recursive read access to the `$EXE` folder. |
| `fs:allow-exe-write` | This allows non-recursive write access to the `$EXE` folder. |
| `fs:allow-exe-meta-recursive` | This allows full recursive read access to metadata of the `$EXE` folder, including file listing and statistics. |
| `fs:allow-exe-meta` | This allows non-recursive read access to metadata of the `$EXE` folder, including file listing and statistics. |
| `fs:scope-exe-recursive` | This scope permits recursive access to the complete `$EXE` folder, including sub directories and files. |
| `fs:scope-exe` | This scope permits access to all files and list content of top level directories in the `$EXE` folder. |
| `fs:scope-exe-index` | This scope permits to list all files and folders in the `$EXE`folder. |
| `fs:allow-font-read-recursive` | This allows full recursive read access to the complete `$FONT` folder, files and subdirectories. |
| `fs:allow-font-write-recursive` | This allows full recursive write access to the complete `$FONT` folder, files and subdirectories. |
| `fs:allow-font-read` | This allows non-recursive read access to the `$FONT` folder. |
| `fs:allow-font-write` | This allows non-recursive write access to the `$FONT` folder. |
| `fs:allow-font-meta-recursive` | This allows full recursive read access to metadata of the `$FONT` folder, including file listing and statistics. |
| `fs:allow-font-meta` | This allows non-recursive read access to metadata of the `$FONT` folder, including file listing and statistics. |
| `fs:scope-font-recursive` | This scope permits recursive access to the complete `$FONT` folder, including sub directories and files. |
| `fs:scope-font` | This scope permits access to all files and list content of top level directories in the `$FONT` folder. |
| `fs:scope-font-index` | This scope permits to list all files and folders in the `$FONT`folder. |
| `fs:allow-home-read-recursive` | This allows full recursive read access to the complete `$HOME` folder, files and subdirectories. |
| `fs:allow-home-write-recursive` | This allows full recursive write access to the complete `$HOME` folder, files and subdirectories. |
| `fs:allow-home-read` | This allows non-recursive read access to the `$HOME` folder. |
| `fs:allow-home-write` | This allows non-recursive write access to the `$HOME` folder. |
| `fs:allow-home-meta-recursive` | This allows full recursive read access to metadata of the `$HOME` folder, including file listing and statistics. |
| `fs:allow-home-meta` | This allows non-recursive read access to metadata of the `$HOME` folder, including file listing and statistics. |
| `fs:scope-home-recursive` | This scope permits recursive access to the complete `$HOME` folder, including sub directories and files. |
| `fs:scope-home` | This scope permits access to all files and list content of top level directories in the `$HOME` folder. |
| `fs:scope-home-index` | This scope permits to list all files and folders in the `$HOME`folder. |
| `fs:allow-localdata-read-recursive` | This allows full recursive read access to the complete `$LOCALDATA` folder, files and subdirectories. |
| `fs:allow-localdata-write-recursive` | This allows full recursive write access to the complete `$LOCALDATA` folder, files and subdirectories. |
| `fs:allow-localdata-read` | This allows non-recursive read access to the `$LOCALDATA` folder. |
| `fs:allow-localdata-write` | This allows non-recursive write access to the `$LOCALDATA` folder. |
| `fs:allow-localdata-meta-recursive` | This allows full recursive read access to metadata of the `$LOCALDATA` folder, including file listing and statistics. |
| `fs:allow-localdata-meta` | This allows non-recursive read access to metadata of the `$LOCALDATA` folder, including file listing and statistics. |
| `fs:scope-localdata-recursive` | This scope permits recursive access to the complete `$LOCALDATA` folder, including sub directories and files. |
| `fs:scope-localdata` | This scope permits access to all files and list content of top level directories in the `$LOCALDATA` folder. |
| `fs:scope-localdata-index` | This scope permits to list all files and folders in the `$LOCALDATA`folder. |
| `fs:allow-log-read-recursive` | This allows full recursive read access to the complete `$LOG` folder, files and subdirectories. |
| `fs:allow-log-write-recursive` | This allows full recursive write access to the complete `$LOG` folder, files and subdirectories. |
| `fs:allow-log-read` | This allows non-recursive read access to the `$LOG` folder. |
| `fs:allow-log-write` | This allows non-recursive write access to the `$LOG` folder. |
| `fs:allow-log-meta-recursive` | This allows full recursive read access to metadata of the `$LOG` folder, including file listing and statistics. |
| `fs:allow-log-meta` | This allows non-recursive read access to metadata of the `$LOG` folder, including file listing and statistics. |
| `fs:scope-log-recursive` | This scope permits recursive access to the complete `$LOG` folder, including sub directories and files. |
| `fs:scope-log` | This scope permits access to all files and list content of top level directories in the `$LOG` folder. |
| `fs:scope-log-index` | This scope permits to list all files and folders in the `$LOG`folder. |
| `fs:allow-picture-read-recursive` | This allows full recursive read access to the complete `$PICTURE` folder, files and subdirectories. |
| `fs:allow-picture-write-recursive` | This allows full recursive write access to the complete `$PICTURE` folder, files and subdirectories. |
| `fs:allow-picture-read` | This allows non-recursive read access to the `$PICTURE` folder. |
| `fs:allow-picture-write` | This allows non-recursive write access to the `$PICTURE` folder. |
| `fs:allow-picture-meta-recursive` | This allows full recursive read access to metadata of the `$PICTURE` folder, including file listing and statistics. |
| `fs:allow-picture-meta` | This allows non-recursive read access to metadata of the `$PICTURE` folder, including file listing and statistics. |
| `fs:scope-picture-recursive` | This scope permits recursive access to the complete `$PICTURE` folder, including sub directories and files. |
| `fs:scope-picture` | This scope permits access to all files and list content of top level directories in the `$PICTURE` folder. |
| `fs:scope-picture-index` | This scope permits to list all files and folders in the `$PICTURE`folder. |
| `fs:allow-public-read-recursive` | This allows full recursive read access to the complete `$PUBLIC` folder, files and subdirectories. |
| `fs:allow-public-write-recursive` | This allows full recursive write access to the complete `$PUBLIC` folder, files and subdirectories. |
| `fs:allow-public-read` | This allows non-recursive read access to the `$PUBLIC` folder. |
| `fs:allow-public-write` | This allows non-recursive write access to the `$PUBLIC` folder. |
| `fs:allow-public-meta-recursive` | This allows full recursive read access to metadata of the `$PUBLIC` folder, including file listing and statistics. |
| `fs:allow-public-meta` | This allows non-recursive read access to metadata of the `$PUBLIC` folder, including file listing and statistics. |
| `fs:scope-public-recursive` | This scope permits recursive access to the complete `$PUBLIC` folder, including sub directories and files. |
| `fs:scope-public` | This scope permits access to all files and list content of top level directories in the `$PUBLIC` folder. |
| `fs:scope-public-index` | This scope permits to list all files and folders in the `$PUBLIC`folder. |
| `fs:allow-resource-read-recursive` | This allows full recursive read access to the complete `$RESOURCE` folder, files and subdirectories. |
| `fs:allow-resource-write-recursive` | This allows full recursive write access to the complete `$RESOURCE` folder, files and subdirectories. |
| `fs:allow-resource-read` | This allows non-recursive read access to the `$RESOURCE` folder. |
| `fs:allow-resource-write` | This allows non-recursive write access to the `$RESOURCE` folder. |
| `fs:allow-resource-meta-recursive` | This allows full recursive read access to metadata of the `$RESOURCE` folder, including file listing and statistics. |
| `fs:allow-resource-meta` | This allows non-recursive read access to metadata of the `$RESOURCE` folder, including file listing and statistics. |
| `fs:scope-resource-recursive` | This scope permits recursive access to the complete `$RESOURCE` folder, including sub directories and files. |
| `fs:scope-resource` | This scope permits access to all files and list content of top level directories in the `$RESOURCE` folder. |
| `fs:scope-resource-index` | This scope permits to list all files and folders in the `$RESOURCE`folder. |
| `fs:allow-runtime-read-recursive` | This allows full recursive read access to the complete `$RUNTIME` folder, files and subdirectories. |
| `fs:allow-runtime-write-recursive` | This allows full recursive write access to the complete `$RUNTIME` folder, files and subdirectories. |
| `fs:allow-runtime-read` | This allows non-recursive read access to the `$RUNTIME` folder. |
| `fs:allow-runtime-write` | This allows non-recursive write access to the `$RUNTIME` folder. |
| `fs:allow-runtime-meta-recursive` | This allows full recursive read access to metadata of the `$RUNTIME` folder, including file listing and statistics. |
| `fs:allow-runtime-meta` | This allows non-recursive read access to metadata of the `$RUNTIME` folder, including file listing and statistics. |
| `fs:scope-runtime-recursive` | This scope permits recursive access to the complete `$RUNTIME` folder, including sub directories and files. |
| `fs:scope-runtime` | This scope permits access to all files and list content of top level directories in the `$RUNTIME` folder. |
| `fs:scope-runtime-index` | This scope permits to list all files and folders in the `$RUNTIME`folder. |
| `fs:allow-temp-read-recursive` | This allows full recursive read access to the complete `$TEMP` folder, files and subdirectories. |
| `fs:allow-temp-write-recursive` | This allows full recursive write access to the complete `$TEMP` folder, files and subdirectories. |
| `fs:allow-temp-read` | This allows non-recursive read access to the `$TEMP` folder. |
| `fs:allow-temp-write` | This allows non-recursive write access to the `$TEMP` folder. |
| `fs:allow-temp-meta-recursive` | This allows full recursive read access to metadata of the `$TEMP` folder, including file listing and statistics. |
| `fs:allow-temp-meta` | This allows non-recursive read access to metadata of the `$TEMP` folder, including file listing and statistics. |
| `fs:scope-temp-recursive` | This scope permits recursive access to the complete `$TEMP` folder, including sub directories and files. |
| `fs:scope-temp` | This scope permits access to all files and list content of top level directories in the `$TEMP` folder. |
| `fs:scope-temp-index` | This scope permits to list all files and folders in the `$TEMP`folder. |
| `fs:allow-template-read-recursive` | This allows full recursive read access to the complete `$TEMPLATE` folder, files and subdirectories. |
| `fs:allow-template-write-recursive` | This allows full recursive write access to the complete `$TEMPLATE` folder, files and subdirectories. |
| `fs:allow-template-read` | This allows non-recursive read access to the `$TEMPLATE` folder. |
| `fs:allow-template-write` | This allows non-recursive write access to the `$TEMPLATE` folder. |
| `fs:allow-template-meta-recursive` | This allows full recursive read access to metadata of the `$TEMPLATE` folder, including file listing and statistics. |
| `fs:allow-template-meta` | This allows non-recursive read access to metadata of the `$TEMPLATE` folder, including file listing and statistics. |
| `fs:scope-template-recursive` | This scope permits recursive access to the complete `$TEMPLATE` folder, including sub directories and files. |
| `fs:scope-template` | This scope permits access to all files and list content of top level directories in the `$TEMPLATE` folder. |
| `fs:scope-template-index` | This scope permits to list all files and folders in the `$TEMPLATE`folder. |
| `fs:allow-video-read-recursive` | This allows full recursive read access to the complete `$VIDEO` folder, files and subdirectories. |
| `fs:allow-video-write-recursive` | This allows full recursive write access to the complete `$VIDEO` folder, files and subdirectories. |
| `fs:allow-video-read` | This allows non-recursive read access to the `$VIDEO` folder. |
| `fs:allow-video-write` | This allows non-recursive write access to the `$VIDEO` folder. |
| `fs:allow-video-meta-recursive` | This allows full recursive read access to metadata of the `$VIDEO` folder, including file listing and statistics. |
| `fs:allow-video-meta` | This allows non-recursive read access to metadata of the `$VIDEO` folder, including file listing and statistics. |
| `fs:scope-video-recursive` | This scope permits recursive access to the complete `$VIDEO` folder, including sub directories and files. |
| `fs:scope-video` | This scope permits access to all files and list content of top level directories in the `$VIDEO` folder. |
| `fs:scope-video-index` | This scope permits to list all files and folders in the `$VIDEO`folder. |
| `fs:allow-copy-file` | Enables the copy\_file command without any pre-configured scope. |
| `fs:deny-copy-file` | Denies the copy\_file command without any pre-configured scope. |
| `fs:allow-create` | Enables the create command without any pre-configured scope. |
| `fs:deny-create` | Denies the create command without any pre-configured scope. |
| `fs:allow-exists` | Enables the exists command without any pre-configured scope. |
| `fs:deny-exists` | Denies the exists command without any pre-configured scope. |
| `fs:allow-fstat` | Enables the fstat command without any pre-configured scope. |
| `fs:deny-fstat` | Denies the fstat command without any pre-configured scope. |
| `fs:allow-ftruncate` | Enables the ftruncate command without any pre-configured scope. |
| `fs:deny-ftruncate` | Denies the ftruncate command without any pre-configured scope. |
| `fs:allow-lstat` | Enables the lstat command without any pre-configured scope. |
| `fs:deny-lstat` | Denies the lstat command without any pre-configured scope. |
| `fs:allow-mkdir` | Enables the mkdir command without any pre-configured scope. |
| `fs:deny-mkdir` | Denies the mkdir command without any pre-configured scope. |
| `fs:allow-open` | Enables the open command without any pre-configured scope. |
| `fs:deny-open` | Denies the open command without any pre-configured scope. |
| `fs:allow-read` | Enables the read command without any pre-configured scope. |
| `fs:deny-read` | Denies the read command without any pre-configured scope. |
| `fs:allow-read-dir` | Enables the read\_dir command without any pre-configured scope. |
| `fs:deny-read-dir` | Denies the read\_dir command without any pre-configured scope. |
| `fs:allow-read-file` | Enables the read\_file command without any pre-configured scope. |
| `fs:deny-read-file` | Denies the read\_file command without any pre-configured scope. |
| `fs:allow-read-text-file` | Enables the read\_text\_file command without any pre-configured scope. |
| `fs:deny-read-text-file` | Denies the read\_text\_file command without any pre-configured scope. |
| `fs:allow-read-text-file-lines` | Enables the read\_text\_file\_lines command without any pre-configured scope. |
| `fs:deny-read-text-file-lines` | Denies the read\_text\_file\_lines command without any pre-configured scope. |
| `fs:allow-read-text-file-lines-next` | Enables the read\_text\_file\_lines\_next command without any pre-configured scope. |
| `fs:deny-read-text-file-lines-next` | Denies the read\_text\_file\_lines\_next command without any pre-configured scope. |
| `fs:allow-remove` | Enables the remove command without any pre-configured scope. |
| `fs:deny-remove` | Denies the remove command without any pre-configured scope. |
| `fs:allow-rename` | Enables the rename command without any pre-configured scope. |
| `fs:deny-rename` | Denies the rename command without any pre-configured scope. |
| `fs:allow-seek` | Enables the seek command without any pre-configured scope. |
| `fs:deny-seek` | Denies the seek command without any pre-configured scope. |
| `fs:allow-size` | Enables the size command without any pre-configured scope. |
| `fs:deny-size` | Denies the size command without any pre-configured scope. |
| `fs:allow-start-accessing-security-scoped-resource` | Enables the start\_accessing\_security\_scoped\_resource command without any pre-configured scope. |
| `fs:deny-start-accessing-security-scoped-resource` | Denies the start\_accessing\_security\_scoped\_resource command without any pre-configured scope. |
| `fs:allow-stat` | Enables the stat command without any pre-configured scope. |
| `fs:deny-stat` | Denies the stat command without any pre-configured scope. |
| `fs:allow-stop-accessing-security-scoped-resource` | Enables the stop\_accessing\_security\_scoped\_resource command without any pre-configured scope. |
| `fs:deny-stop-accessing-security-scoped-resource` | Denies the stop\_accessing\_security\_scoped\_resource command without any pre-configured scope. |
| `fs:allow-truncate` | Enables the truncate command without any pre-configured scope. |
| `fs:deny-truncate` | Denies the truncate command without any pre-configured scope. |
| `fs:allow-unwatch` | Enables the unwatch command without any pre-configured scope. |
| `fs:deny-unwatch` | Denies the unwatch command without any pre-configured scope. |
| `fs:allow-watch` | Enables the watch command without any pre-configured scope. |
| `fs:deny-watch` | Denies the watch command without any pre-configured scope. |
| `fs:allow-write` | Enables the write command without any pre-configured scope. |
| `fs:deny-write` | Denies the write command without any pre-configured scope. |
| `fs:allow-write-file` | Enables the write\_file command without any pre-configured scope. |
| `fs:deny-write-file` | Denies the write\_file command without any pre-configured scope. |
| `fs:allow-write-text-file` | Enables the write\_text\_file command without any pre-configured scope. |
| `fs:deny-write-text-file` | Denies the write\_text\_file command without any pre-configured scope. |
| `fs:create-app-specific-dirs` | This permissions allows to create the application specific directories. |
| `fs:deny-default` | This denies access to dangerous Tauri relevant files and folders by default. |
| `fs:deny-webview-data-linux` | This denies access to the following paths   * `$APPLOCALDATA/CacheStorage/**` * `$APPLOCALDATA/cookies` * `$APPLOCALDATA/hsts-storage.sqlite` * `$APPLOCALDATA/serviceworkers/**` * `$APPLOCALDATA/WebKitCache/**` * `$APPLOCALDATA/databases/**` * `$APPLOCALDATA/localstorage/**` * `$APPLOCALDATA/mediakeys/**` * `$APPLOCALDATA/storage/**`   on linux as the webview data and configuration values are stored here. Allowing access can lead to sensitive information disclosure and should be well considered. |
| `fs:deny-webview-data-windows` | This denies access to the `$APPLOCALDATA/EBWebView` folder on windows as the webview data and configuration values are stored here. Allowing access can lead to sensitive information disclosure and should be well considered. |
| `fs:read-all` | This enables all read related commands without any pre-configured accessible paths. |
| `fs:read-app-specific-dirs-recursive` | This permission allows recursive read functionality on the application specific base directories. |
| `fs:read-dirs` | This enables directory read and file metadata related commands without any pre-configured accessible paths. |
| `fs:read-files` | This enables file read related commands without any pre-configured accessible paths. |
| `fs:read-meta` | This enables all index or metadata related commands without any pre-configured accessible paths. |
| `fs:scope` | An empty permission you can use to modify the global scope. Example  ``` {   "identifier": "read-documents",   "windows": ["main"],   "permissions": [     "fs:allow-read",     {       "identifier": "fs:scope",       "allow": [         "$APPDATA/documents/**/*"       ],       "deny": [         "$APPDATA/documents/secret.txt"       ]     }   ] } ``` |
| `fs:write-all` | This enables all write related commands without any pre-configured accessible paths. |
| `fs:write-files` | This enables all file write related commands without any pre-configured accessible paths. |

### Scopes

[Section titled “Scopes”](#scopes)

This plugin permissions includes scopes for defining which paths are allowed or explicitly rejected.
For more information on scopes, see the [Command Scopes](/security/scope/).

Each `allow` or `deny` scope must include an array listing all paths that should be allowed or denied.
The scope entries are in the `{ path: string }` format.

Scope entries can use `$<path>` variables to reference common system paths such as the home directory,
the app resources directory and the config directory. The following table lists all common paths you can reference:

| Path | Variable |
| --- | --- |
| [appConfigDir](/reference/javascript/api/namespacepath/#appconfigdir) | $APPCONFIG |
| [appDataDir](/reference/javascript/api/namespacepath/#appdatadir) | $APPDATA |
| [appLocalDataDir](/reference/javascript/api/namespacepath/#applocaldatadir) | $APPLOCALDATA |
| [appcacheDir](/reference/javascript/api/namespacepath/#appcachedir) | $APPCACHE |
| [applogDir](/reference/javascript/api/namespacepath/#applogdir) | $APPLOG |
| [audioDir](/reference/javascript/api/namespacepath/#audiodir) | $AUDIO |
| [cacheDir](/reference/javascript/api/namespacepath/#cachedir) | $CACHE |
| [configDir](/reference/javascript/api/namespacepath/#configdir) | $CONFIG |
| [dataDir](/reference/javascript/api/namespacepath/#datadir) | $DATA |
| [localDataDir](/reference/javascript/api/namespacepath/#localdatadir) | $LOCALDATA |
| [desktopDir](/reference/javascript/api/namespacepath/#desktopdir) | $DESKTOP |
| [documentDir](/reference/javascript/api/namespacepath/#documentdir) | $DOCUMENT |
| [downloadDir](/reference/javascript/api/namespacepath/#downloaddir) | $DOWNLOAD |
| [executableDir](/reference/javascript/api/namespacepath/#executabledir) | $EXE |
| [fontDir](/reference/javascript/api/namespacepath/#fontdir) | $FONT |
| [homeDir](/reference/javascript/api/namespacepath/#homedir) | $HOME |
| [pictureDir](/reference/javascript/api/namespacepath/#picturedir) | $PICTURE |
| [publicDir](/reference/javascript/api/namespacepath/#publicdir) | $PUBLIC |
| [runtimeDir](/reference/javascript/api/namespacepath/#runtimedir) | $RUNTIME |
| [templateDir](/reference/javascript/api/namespacepath/#templatedir) | $TEMPLATE |
| [videoDir](/reference/javascript/api/namespacepath/#videodir) | $VIDEO |
| [resourceDir](/reference/javascript/api/namespacepath/#resourcedir) | $RESOURCE |
| [tempDir](/reference/javascript/api/namespacepath/#tempdir) | $TEMP |

#### Examples

[Section titled “Examples”](#examples)

* global scope

To apply a scope to any `fs` command, use the `fs:scope` permission:

src-tauri/capabilities/default.json

```
{

"$schema": "../gen/schemas/desktop-schema.json",

"identifier": "main-capability",

"description": "Capability for the main window",

"windows": ["main"],

"permissions": [

{

"identifier": "fs:scope",

"allow": [{ "path": "$APPDATA" }, { "path": "$APPDATA/**/*" }]

}

]

}
```

To apply a scope to a specific `fs` command,
use the object form of permissions `{ "identifier": string, "allow"?: [], "deny"?: [] }`:

src-tauri/capabilities/default.json

```
{

"$schema": "../gen/schemas/desktop-schema.json",

"identifier": "main-capability",

"description": "Capability for the main window",

"windows": ["main"],

"permissions": [

{

"identifier": "fs:allow-rename",

"allow": [{ "path": "$HOME/**/*" }]

},

{

"identifier": "fs:allow-rename",

"deny": [{ "path": "$HOME/.config/**/*" }]

},

{

"identifier": "fs:allow-exists",

"allow": [{ "path": "$APPDATA/*" }]

}

]

}
```

In the above example you can use the [`exists`](#exists) API using any `$APPDATA` sub path (does not include sub-directories)
and the [`rename`](#rename)

---

[Support on Open Collective](https://opencollective.com/tauri)[Sponsor on GitHub](https://github.com/sponsors/tauri-apps)

© 2026 Tauri Contributors. CC-BY / MIT