# Windows Installer

Tauri applications for Windows are either distributed as Microsoft Installers (`.msi` files) using the [WiX Toolset v3](https://wixtoolset.org/documentation/manual/v3/)
or as setup executables (`-setup.exe` files) using [NSIS](https://nsis.sourceforge.io/Main_Page).

Please note that `.msi` installers can **only be created on Windows** as WiX can only run on Windows systems.
Cross-compilation for NSIS installers is shown below.

This guide provides information about available customization options for the installer.

## Building

[Section titled “Building”](#building)

To build and bundle your app into a Windows installer you can use the Tauri CLI and run the `tauri build` command in a Windows computer:

* [npm](#tab-panel-0-0)
* [yarn](#tab-panel-0-1)
* [pnpm](#tab-panel-0-2)
* [deno](#tab-panel-0-3)
* [bun](#tab-panel-0-4)
* [cargo](#tab-panel-0-5)

```
npm run tauri build
```

```
yarn tauri build
```

```
pnpm tauri build
```

```
deno task tauri build
```

```
bun tauri build
```

```
cargo tauri build
```

### Build Windows apps on Linux and macOS

[Section titled “Build Windows apps on Linux and macOS”](#build-windows-apps-on-linux-and-macos)

Cross compiling Windows apps on Linux and macOS hosts is possible with caveats when using [NSIS](https://nsis.sourceforge.io/Main_Page).
It is not as straight forward as compiling on Windows directly and is not tested as much.
Therefore it should only be used as a last resort if local VMs or CI solutions like GitHub Actions don’t work for you.

Since Tauri officially only supports the MSVC Windows target, the setup is a bit more involved.

#### Install NSIS

[Section titled “Install NSIS”](#install-nsis)

* [Linux](#tab-panel-1-0)
* [macOS](#tab-panel-1-1)

Some Linux distributions have NSIS available in their repositories, for example on Ubuntu you can install NSIS by running this command:

Ubuntu

```
sudo apt install nsis
```

But on many other distributions you have to compile NSIS yourself or download Stubs and Plugins manually that weren’t included in the distro’s binary package.
Fedora for example only provides the binary but not the Stubs and Plugins:

Fedora

```
sudo dnf in mingw64-nsis

wget https://github.com/tauri-apps/binary-releases/releases/download/nsis-3/nsis-3.zip

unzip nsis-3.zip

sudo cp nsis-3.08/Stubs/* /usr/share/nsis/Stubs/

sudo cp -r nsis-3.08/Plugins/** /usr/share/nsis/Plugins/
```

On macOS you will need [Homebrew] to install NSIS:

macOS

```
brew install nsis
```

#### Install LLVM and the LLD Linker

[Section titled “Install LLVM and the LLD Linker”](#install-llvm-and-the-lld-linker)

Since the default Microsoft linker only works on Windows we will also need to install a new linker.
To compile the Windows Resource file which is used for setting the app icon among other things
we will also need the `llvm-rc` binary which is part of the LLVM project.

* [Linux](#tab-panel-2-0)
* [macOS](#tab-panel-2-1)

Ubuntu

```
sudo apt install lld llvm
```

On Linux you also need to install the `clang` package if you added dependencies that compile C/C++ dependencies as part of their build scripts.
Default Tauri apps should not require this.

macOS

```
brew install llvm
```

On macOS you also have to add `/opt/homebrew/opt/llvm/bin` to your `$PATH` as suggested in the install output.

#### Install the Windows Rust target

[Section titled “Install the Windows Rust target”](#install-the-windows-rust-target)

Assuming you’re building for 64-bit Windows systems:

Terminal window

```
rustup target add x86_64-pc-windows-msvc
```

#### Install `cargo-xwin`

[Section titled “Install cargo-xwin”](#install-cargo-xwin)

Instead of setting the Windows SDKs up manually we will use [`cargo-xwin`] as Tauri’s “runner”:

Terminal window

```
cargo install --locked cargo-xwin
```

By default `cargo-xwin` will download the Windows SDKs into a project-local folder.
If you have multiple projects and want to share those files you can set the `XWIN_CACHE_DIR` environment variable with a path to the preferred location.

#### Building the App

[Section titled “Building the App”](#building-the-app)

Now it should be as simple as adding the runner and target to the `tauri build` command:

* [npm](#tab-panel-3-0)
* [yarn](#tab-panel-3-1)
* [pnpm](#tab-panel-3-2)
* [deno](#tab-panel-3-3)
* [bun](#tab-panel-3-4)
* [cargo](#tab-panel-3-5)

```
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc
```

```
yarn tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

```
pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

```
deno task tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

```
bun tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

```
cargo tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc
```

The build output will then be in `target/x86_64-pc-windows-msvc/release/bundle/nsis/`.

### Building for 32-bit or ARM

[Section titled “Building for 32-bit or ARM”](#building-for-32-bit-or-arm)

The Tauri CLI compiles your executable using your machine’s architecture by default.
Assuming that you’re developing on a 64-bit machine, the CLI will produce 64-bit applications.

If you need to support **32-bit** machines, you can compile your application with a **different** [Rust target](https://doc.rust-lang.org/nightly/rustc/platform-support.html)
using the `--target` flag:

* [npm](#tab-panel-4-0)
* [yarn](#tab-panel-4-1)
* [pnpm](#tab-panel-4-2)
* [deno](#tab-panel-4-3)
* [bun](#tab-panel-4-4)
* [cargo](#tab-panel-4-5)

```
npm run tauri build -- --target i686-pc-windows-msvc
```

```
yarn tauri build --target i686-pc-windows-msvc
```

```
pnpm tauri build --target i686-pc-windows-msvc
```

```
deno task tauri build --target i686-pc-windows-msvc
```

```
bun tauri build --target i686-pc-windows-msvc
```

```
cargo tauri build --target i686-pc-windows-msvc
```

By default, Rust only installs toolchains for your machine’s target,
so you need to install the 32-bit Windows toolchain first: `rustup target add i686-pc-windows-msvc`.

If you need to build for **ARM64** you first need to install additional build tools.
To do this, open `Visual Studio Installer`, click on “Modify”, and in the “Individual Components” tab install the “C++ ARM64 build tools”.
At the time of writing, the exact name in VS2022 is `MSVC v143 - VS 2022 C++ ARM64 build tools (Latest)`.
Now you can add the rust target with `rustup target add aarch64-pc-windows-msvc` and then use the above-mentioned method to compile your app:

* [npm](#tab-panel-5-0)
* [yarn](#tab-panel-5-1)
* [pnpm](#tab-panel-5-2)
* [deno](#tab-panel-5-3)
* [bun](#tab-panel-5-4)
* [cargo](#tab-panel-5-5)

```
npm run tauri build -- --target aarch64-pc-windows-msvc
```

```
yarn tauri build --target aarch64-pc-windows-msvc
```

```
pnpm tauri build --target aarch64-pc-windows-msvc
```

```
deno task tauri build --target aarch64-pc-windows-msvc
```

```
bun tauri build --target aarch64-pc-windows-msvc
```

```
cargo tauri build --target aarch64-pc-windows-msvc
```

## Supporting Windows 7

[Section titled “Supporting Windows 7”](#supporting-windows-7)

By default, the Microsoft Installer (`.msi`) does not work on Windows 7 because it needs to download the WebView2 bootstrapper if not installed
(which might fail if TLS 1.2 is not enabled in the operating system). Tauri includes an option to embed the WebView2 bootstrapper
(see the [Embedding the WebView2 Bootstrapper](#embedded-bootstrapper) section below).
The NSIS based installer (`-setup.exe`) also supports the `downloadBootstrapper` mode on Windows 7.

Additionally, to use the Notification API in Windows 7, you need to enable the `windows7-compat` Cargo feature:

Cargo.toml

```
[dependencies]

tauri-plugin-notification = { version = "2.0.0", features = [ "windows7-compat" ] }
```

## FIPS Compliance

[Section titled “FIPS Compliance”](#fips-compliance)

If your system requires the MSI bundle to be FIPS compliant you can set the `TAURI_BUNDLER_WIX_FIPS_COMPLIANT` environment variable to `true`
before running `tauri build`. In PowerShell you can set it for the current terminal session like this:

Terminal window

```
$env:TAURI_BUNDLER_WIX_FIPS_COMPLIANT="true"
```

## WebView2 Installation Options

[Section titled “WebView2 Installation Options”](#webview2-installation-options)

The installers by default download the WebView2 bootstrapper and executes it if the runtime is not installed.
Alternatively, you can embed the bootstrapper, embed the offline installer, or use a fixed WebView2 runtime version.
See the following table for a comparison between these methods:

| Installation Method | Requires Internet Connection? | Additional Installer Size | Notes |
| --- | --- | --- | --- |
| [`downloadBootstrapper`](#downloaded-bootstrapper) | Yes | 0MB | `Default`   Results in a smaller installer size, but is not recommended for Windows 7 deployment via `.msi` files. |
| [`embedBootstrapper`](#embedded-bootstrapper) | Yes | ~1.8MB | Better support on Windows 7 for `.msi` installers. |
| [`offlineInstaller`](#offline-installer) | No | ~127MB | Embeds WebView2 installer. Recommended for offline environments. |
| [`fixedVersion`](#fixed-version) | No | ~180MB | Embeds a fixed WebView2 version. |
| [`skip`](#skipping-installation) | No | 0MB | ⚠️ Not recommended   Does not install the WebView2 as part of the Windows Installer. |

### Downloaded Bootstrapper

[Section titled “Downloaded Bootstrapper”](#downloaded-bootstrapper)

This is the default setting for building the Windows Installer. It downloads the bootstrapper and runs it.
Requires an internet connection but results in a smaller installer size.
This is not recommended if you’re going to be distributing to Windows 7 via `.msi` installers.

tauri.conf.json

```
{

"bundle": {

"windows": {

"webviewInstallMode": {

"type": "downloadBootstrapper"

}

}

}

}
```

### Embedded Bootstrapper

[Section titled “Embedded Bootstrapper”](#embedded-bootstrapper)

To embed the WebView2 Bootstrapper, set the [webviewInstallMode](/reference/config/#webviewinstallmode) to `embedBootstrapper`.
This increases the installer size by around 1.8MB, but increases compatibility with Windows 7 systems.

tauri.conf.json

```
{

"bundle": {

"windows": {

"webviewInstallMode": {

"type": "embedBootstrapper"

}

}

}

}
```

### Offline Installer

[Section titled “Offline Installer”](#offline-installer)

To embed the WebView2 Bootstrapper, set the [webviewInstallMode](/reference/config/#webviewinstallmode) to `offlineInstaller`.
This increases the installer size by around 127MB, but allows your application to be installed even if an internet connection is not available.

tauri.conf.json

```
{

"bundle": {

"windows": {

"webviewInstallMode": {

"type": "offlineInstaller"

}

}

}

}
```

### Fixed Version

[Section titled “Fixed Version”](#fixed-version)

Using the runtime provided by the system is great for security as the webview vulnerability patches are managed by Windows.
If you want to control the WebView2 distribution on each of your applications
(either to manage the release patches yourself or distribute applications on environments where an internet connection might not be available)
Tauri can bundle the runtime files for you.

1. Download the WebView2 fixed version runtime from [Microsoft’s website](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section).
   In this example, the downloaded filename is `Microsoft.WebView2.FixedVersionRuntime.128.0.2739.42.x64.cab`
2. Extract the file to the core folder:

Terminal window

```
Expand .\Microsoft.WebView2.FixedVersionRuntime.128.0.2739.42.x64.cab -F:* ./src-tauri
```

3. Configure the WebView2 runtime path in `tauri.conf.json`:

tauri.conf.json

```
{

"bundle": {

"windows": {

"webviewInstallMode": {

"type": "fixedRuntime",

"path": "./Microsoft.WebView2.FixedVersionRuntime.98.0.1108.50.x64/"

}

}

}

}
```

4. Run `tauri build` to produce the Windows Installer with the fixed WebView2 runtime.

### Skipping Installation

[Section titled “Skipping Installation”](#skipping-installation)

You can remove the WebView2 Runtime download check from the installer by setting [webviewInstallMode](/reference/config/#webviewinstallmode) to `skip`.
Your application WILL NOT work if the user does not have the runtime installed.

Your application WILL NOT work if the user does not have the runtime installed and won’t attempt to install it.

tauri.conf.json

```
{

"bundle": {

"windows": {

"webviewInstallMode": {

"type": "skip"

}

}

}

}
```

## Minimum Webview2 version

[Section titled “Minimum Webview2 version”](#minimum-webview2-version)

If your app requires features only available in newer Webview2 versions (such as custom URI schemes), you can instruct the Windows installer
to verify the current Webview2 version and run the Webview2 bootstrapper if it does not match the target version.

tauri.conf.json

```
{

"bundle": {

"windows": {

"minimumWebview2Version": "110.0.1531.0"

}

}

}
```

## Customizing the WiX Installer

[Section titled “Customizing the WiX Installer”](#customizing-the-wix-installer)

See the [WiX configuration](/reference/config/#wixconfig) for the complete list of customization options.

### Installer Template

[Section titled “Installer Template”](#installer-template)

The `.msi` Windows Installer package is built using the [WiX Toolset v3](https://wixtoolset.org/documentation/manual/v3/).
Currently, apart from pre-defined [configurations](/reference/config/#wixconfig), you can change it by using a custom WiX source code
(an XML file with a `.wxs` file extension) or through WiX fragments.

#### Replacing the Installer Code with a Custom WiX File

[Section titled “Replacing the Installer Code with a Custom WiX File”](#replacing-the-installer-code-with-a-custom-wix-file)

The Windows Installer XML defined by Tauri is configured to work for the common use case
of simple webview-based applications (you can find it [here](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-bundler/src/bundle/windows/msi/main.wxs)).
It uses [handlebars](https://docs.rs/handlebars/latest/handlebars/) so the Tauri CLI can brand your installer according to your `tauri.conf.json` definition.
If you need a completely different installer, a custom template file can be configured on [`tauri.bundle.windows.wix.template`](/reference/config/#template-2).

#### Extending the Installer with WiX Fragments

[Section titled “Extending the Installer with WiX Fragments”](#extending-the-installer-with-wix-fragments)

A [WiX fragment](https://wixtoolset.org/documentation/manual/v3/xsd/wix/fragment.html) is a container where you can configure almost everything offered by WiX.
In this example, we will define a fragment that writes two registry entries:

```
<?xml version="1.0" encoding="utf-8"?>

<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">

<Fragment>

<!-- these registry entries should be installed

to the target user's machine -->

<DirectoryRef Id="TARGETDIR">

<!-- groups together the registry entries to be installed -->

<!-- Note the unique `Id` we provide here -->

<Component Id="MyFragmentRegistryEntries" Guid="*">

<!-- the registry key will be under

HKEY_CURRENT_USER\Software\MyCompany\MyApplicationName -->

<!-- Tauri uses the second portion of the

bundle identifier as the `MyCompany` name

(e.g. `tauri-apps` in `com.tauri-apps.test`)  -->

<RegistryKey

Root="HKCU"

Key="Software\MyCompany\MyApplicationName"

Action="createAndRemoveOnUninstall"

>

<!-- values to persist on the registry -->

<RegistryValue

Type="integer"

Name="SomeIntegerValue"

Value="1"

KeyPath="yes"

/>

<RegistryValue Type="string" Value="Default Value" />

</RegistryKey>

</Component>

</DirectoryRef>

</Fragment>

</Wix>
```

Save the fragment file with the `.wxs` extension in the `src-tauri/windows/fragments` folder and reference it on `tauri.conf.json`:

tauri.conf.json

```
{

"bundle": {

"windows": {

"wix": {

"fragmentPaths": ["./windows/fragments/registry.wxs"],

"componentRefs": ["MyFragmentRegistryEntries"]

}

}

}

}
```

Note that `ComponentGroup`, `Component`, `FeatureGroup`, `Feature` and `Merge` element ids must be referenced on the `wix` object
of `tauri.conf.json` on the `componentGroupRefs`, `componentRefs`, `featureGroupRefs`, `featureRefs` and `mergeRefs`
respectively to be included in the installer.

### Internationalization

[Section titled “Internationalization”](#internationalization)

The WiX Installer is built using the `en-US` language by default.
Internationalization (i18n) can be configured using the [`tauri.bundle.windows.wix.language`](/reference/config/#language) property,
defining the languages Tauri should build an installer against.
You can find the language names to use in the Language-Culture column on [Microsoft’s website](https://docs.microsoft.com/en-us/windows/win32/msi/localizing-the-error-and-actiontext-tables).

#### Compiling a WiX Installer for a Single Language

[Section titled “Compiling a WiX Installer for a Single Language”](#compiling-a-wix-installer-for-a-single-language)

To create a single installer targeting a specific language, set the `language` value to a string:

tauri.conf.json

```
{

"bundle": {

"windows": {

"wix": {

"language": "fr-FR"

}

}

}

}
```

#### Compiling a WiX Installer for Each Language in a List

[Section titled “Compiling a WiX Installer for Each Language in a List”](#compiling-a-wix-installer-for-each-language-in-a-list)

To compile an installer targeting a list of languages, use an array.
A specific installer for each language will be created, with the language key as a suffix:

tauri.conf.json

```
{

"bundle": {

"windows": {

"wix": {

"language": ["en-US", "pt-BR", "fr-FR"]

}

}

}

}
```

#### Configuring the WiX Installer Strings for Each Language

[Section titled “Configuring the WiX Installer Strings for Each Language”](#configuring-the-wix-installer-strings-for-each-language)

A configuration object can be defined for each language to configure localization strings:

tauri.conf.json

```
{

"bundle": {

"windows": {

"wix": {

"language": {

"en-US": null,

"pt-BR": {

"localePath": "./wix/locales/pt-BR.wxl"

}

}

}

}

}

}
```

The `localePath` property defines the path to a language file, a XML configuring the language culture:

```
<WixLocalization

Culture="en-US"

xmlns="http://schemas.microsoft.com/wix/2006/localization"

>

<String Id="LaunchApp"> Launch MyApplicationName </String>

<String Id="DowngradeErrorMessage">

A newer version of MyApplicationName is already installed.

</String>

<String Id="PathEnvVarFeature">

Add the install location of the MyApplicationName executable to

the PATH system environment variable. This allows the

MyApplicationName executable to be called from any location.

</String>

<String Id="InstallAppFeature">

Installs MyApplicationName.

</String>

</WixLocalization>
```

Currently, Tauri references the following locale strings: `LaunchApp`, `DowngradeErrorMessage`, `PathEnvVarFeature` and `InstallAppFeature`.
You can define your own strings and reference them on your custom template or fragments with `"!(loc.TheStringId)"`.
See the [WiX localization documentation](https://wixtoolset.org/documentation/manual/v3/howtos/ui_and_localization/make_installer_localizable.html) for more information.

## Customizing the NSIS Installer

[Section titled “Customizing the NSIS Installer”](#customizing-the-nsis-installer)

See the [NSIS configuration](/reference/config/#nsisconfig) for the complete list of customization options.

### Installer Template

[Section titled “Installer Template”](#installer-template-1)

The NSIS Installer’s `.nsi` script defined by Tauri is configured to work for the common use case
of simple webview-based applications (you can find it [here](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi)).
It uses [handlebars](https://docs.rs/handlebars/latest/handlebars/) so the Tauri CLI can brand your installer according to your `tauri.conf.json` definition.
If you need a completely different installer, a custom template file can be configured on [`tauri.bundle.windows.nsis.template`](/reference/config/#template-1).

### Extending the Installer

[Section titled “Extending the Installer”](#extending-the-installer)

If you only need to extend some installation steps you might be able to use installer hooks instead of replacing the entire installer template.

Supported hooks are:

* `NSIS_HOOK_PREINSTALL`: Runs before copying files, setting registry key values and creating shortcuts.
* `NSIS_HOOK_POSTINSTALL`: Runs after the installer has finished copying all files, setting the registry keys and created shortcuts.
* `NSIS_HOOK_PREUNINSTALL`: Runs before removing any files, registry keys and shortcuts.
* `NSIS_HOOK_POSTUNINSTALL`: Runs after files, registry keys and shortcuts have been removed.

For example, create a `hooks.nsh` file in the `src-tauri/windows` folder and define the hooks you need:

```
!macro NSIS_HOOK_PREINSTALL

MessageBox MB_OK "PreInstall"

!macroend

!macro NSIS_HOOK_POSTINSTALL

MessageBox MB_OK "PostInstall"

!macroend

!macro NSIS_HOOK_PREUNINSTALL

MessageBox MB_OK "PreUnInstall"

!macroend

!macro NSIS_HOOK_POSTUNINSTALL

MessageBox MB_OK "PostUninstall"

!macroend
```

Then you must configure Tauri to use that hook file:

tauri.conf.json

```
{

"bundle": {

"windows": {

"nsis": {

"installerHooks": "./windows/hooks.nsh"

}

}

}

}
```

#### Including Files Next to the Hook

[Section titled “Including Files Next to the Hook”](#including-files-next-to-the-hook)

Tauri includes your hook file from its generated NSIS script using `!include`. At the top level of the hook file, `${__FILEDIR__}` refers to the hook file’s directory, so you can include a file beside it directly.

Macro bodies, however, are expanded where Tauri inserts them into the generated script. Inside a hook macro, `${__FILEDIR__}` therefore refers to the generated script’s directory instead. If a macro needs a file beside the hook, capture the hook directory in a top-level `!define` first:

```
!include "${__FILEDIR__}\adjacent.nsh"

!define HOOK_FILE_DIR "${__FILEDIR__}"

!macro NSIS_HOOK_PREINSTALL

File "${HOOK_FILE_DIR}\example.txt"

!macroend
```

#### Installing Dependencies with Hooks

[Section titled “Installing Dependencies with Hooks”](#installing-dependencies-with-hooks)

You can use installer hooks to automatically install system dependencies that your application requires. This is particularly useful for runtime dependencies like Visual C++ Redistributables, DirectX, OpenSSL or other system libraries that may not be present on all Windows systems.

**MSI Installer Example (Visual C++ Redistributable):**

```
!macro NSIS_HOOK_POSTINSTALL

; Check if Visual C++ 2019 Redistributable is installed (via Windows Registry)

ReadRegDWord $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"

${If} $0 == 1

DetailPrint "Visual C++ Redistributable already installed"

Goto vcredist_done

${EndIf}

; Install from bundled MSI if not installed

${If} ${FileExists} "$INSTDIR\resources\vc_redist.x64.msi"

DetailPrint "Installing Visual C++ Redistributable..."

; Copy to TEMP folder and then execute installer

CopyFiles "$INSTDIR\resources\vc_redist.x64.msi" "$TEMP\vc_redist.x64.msi"

ExecWait 'msiexec /i "$TEMP\vc_redist.x64.msi" /passive /norestart' $0

; Check wether installation process exited successfully (code 0) or not

${If} $0 == 0

DetailPrint "Visual C++ Redistributable installed successfully"

${Else}

MessageBox MB_ICONEXCLAMATION "Visual C++ installation failed. Some features may not work."

${EndIf}

; Clean up setup files from TEMP and your installed app

Delete "$TEMP\vc_redist.x64.msi"

Delete "$INSTDIR\resources\vc_redist.x64.msi"

${EndIf}

vcredist_done:

!macroend
```

**Key considerations:**

* A good practice is to always check if the dependency is already installed using registry keys or file existence or via Windows [where](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/where) command.
* Use `/passive`, `/quiet`, or `/silent` flags to avoid interrupting the installation flow. Check out [msiexec](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/msiexec) options for `.msi` files, or the setup manual for app-specific flags
* Include `/norestart` to prevent automatic system reboots during installation for setups that restarts user devices
* Clean up temporary files and bundled installers to avoid bloating the application
* Consider that dependencies might be shared with other applications when uninstalling
* Provide meaningful error messages if installation fails

Ensure to bundle the dependency installers in your `src-tauri/resources` folder and add to `tauri.conf.json` so they get bundled, and can be accessed during installation from `$INSTDIR\resources\`:

tauri.conf.json

```
{

"bundle": {

"resources": [

"resources/my-dependency.exe",

"resources/another-one.msi

]

}

}
```

### Install Modes

[Section titled “Install Modes”](#install-modes)

By default the installer will install your application for the current user only.
The advantage of this option is that the installer does not require Administrator privileges to run,
but the app is installed in the `%LOCALAPPDATA%` folder instead of `C:/Program Files`.

If you prefer your app installation to be available system-wide (which requires Administrator privileges)
you can set [installMode](/reference/config/#installmode) to `perMachine`:

tauri.conf.json

```
{

"bundle": {

"windows": {

"nsis": {

"installMode": "perMachine"

}

}

}

}
```

Alternatively you can let the user choose whether the app should be installed for the current user only or system-wide
by setting the [installMode](/reference/config/#installmode) to `both`.
Note that the installer will require Administrator privileges to execute.

See [NSISInstallerMode](/reference/config/#nsisinstallermode) for more information.

### Internationalization

[Section titled “Internationalization”](#internationalization-1)

The NSIS Installer is a multi-language installer, which means you always have a single installer which contains all the selected translations.

You can specify which languages to include using the [`tauri.bundle.windows.nsis.languages`](/reference/config/#languages) property.
A list of languages supported by NSIS is available in [the NSIS GitHub project](https://github.com/kichik/nsis/tree/9465c08046f00ccb6eda985abbdbf52c275c6c4d/Contrib/Language%20files).
There are a few [Tauri-specific translations](https://github.com/tauri-apps/tauri/tree/dev/crates/tauri-bundler/src/bundle/windows/nsis/languages) required, so if you see untranslated texts feel free to open a feature request in [Tauri’s main repo](https://github.com/tauri-apps/tauri/issues/new?assignees=&labels=type%3A+feature+request&template=feature_request.yml&title=%5Bfeat%5D+).
You can also provide [custom translation files](/reference/config/#customlanguagefiles).

By default the operating system default language is used to determine the installer language.
You can also configure the installer to display a language selector before the installer contents are rendered:

tauri.conf.json

```
{

"bundle": {

"windows": {

"nsis": {

"displayLanguageSelector": true

}

}

}

}
```

---

[Support on Open Collective](https://opencollective.com/tauri)[Sponsor on GitHub](https://github.com/sponsors/tauri-apps)

© 2026 Tauri Contributors. CC-BY / MIT