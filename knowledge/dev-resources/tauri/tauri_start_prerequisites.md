# Prerequisites

In order to get started building your project with Tauri you’ll first need to install a few dependencies:

1. [System Dependencies](#system-dependencies)
2. [Rust](#rust)
3. [Configure for Mobile Targets](#configure-for-mobile-targets) (only required if developing for mobile)

## System Dependencies

[Section titled “System Dependencies”](#system-dependencies)

Follow the link to get started for your respective operating system:

* [Linux](#linux) (see below for specific distributions)
* [macOS Catalina (10.15) and later](#macos)
* [Windows 7 and later](#windows)

### Linux

[Section titled “Linux”](#linux)

Tauri requires various system dependencies for development on Linux. These may be different depending on your distribution but we’ve included some popular distributions below to help you get setup.

* [Debian](#tab-panel-0-0)
* [Arch](#tab-panel-0-1)
* [Fedora](#tab-panel-0-2)
* [Gentoo](#tab-panel-0-3)
* [OSTree](#tab-panel-0-4)
* [openSUSE](#tab-panel-0-5)
* [Alpine](#tab-panel-0-6)
* [NixOS](#tab-panel-0-7)

Terminal window

```
sudo apt update

sudo apt install libwebkit2gtk-4.1-dev \

build-essential \

curl \

wget \

file \

libxdo-dev \

libssl-dev \

libayatana-appindicator3-dev \

librsvg2-dev
```

Terminal window

```
sudo pacman -Syu

sudo pacman -S --needed \

webkit2gtk-4.1 \

base-devel \

curl \

wget \

file \

openssl \

appmenu-gtk-module \

libappindicator-gtk3 \

librsvg \

xdotool
```

Terminal window

```
sudo dnf check-update

sudo dnf install webkit2gtk4.1-devel \

openssl-devel \

curl \

wget \

file \

libappindicator-gtk3-devel \

librsvg2-devel \

libxdo-devel

sudo dnf group install "c-development"
```

Terminal window

```
sudo emerge --ask \

net-libs/webkit-gtk:4.1 \

dev-libs/libayatana-appindicator \

net-misc/curl \

net-misc/wget \

sys-apps/file
```

Terminal window

```
sudo rpm-ostree install webkit2gtk4.1-devel \

openssl-devel \

curl \

wget \

file \

libappindicator-gtk3-devel \

librsvg2-devel \

libxdo-devel \

gcc \

gcc-c++ \

make

sudo systemctl reboot
```

Terminal window

```
sudo zypper up

sudo zypper in webkit2gtk3-devel \

libopenssl-devel \

curl \

wget \

file \

libappindicator3-1 \

librsvg-devel

sudo zypper in -t pattern devel_basis
```

Terminal window

```
sudo apk add \

build-base \

webkit2gtk-4.1-dev \

curl \

wget \

file \

openssl \

libayatana-appindicator-dev \

librsvg
```

> Note: Alpine Linux containers don’t include any fonts by default. To ensure text renders correctly in your Tauri app, install at least one font package (for example, `font-dejavu` ).

> Note: Alpine targets the musl C library, so Rust builds link a number of system libraries statically. If `cargo`/`pnpm tauri build` fails with linker errors for symbols from libraries that `pkg-config` reports as present, install the matching `*-static` packages alongside the `-dev` ones above:
>
> Terminal window
>
> ```
> sudo apk add --no-cache \
>
>
>
> openssl-libs-static \
>
>
>
> cairo-static \
>
>
>
> harfbuzz-static \
>
>
>
> glib-static \
>
>
>
> wayland-static \
>
>
>
> zlib-static
> ```
>
> Not every dependency Tauri pulls in is packaged as `*-static` on Alpine; in those cases you may need to build the missing static library from source.

If your distribution isn’t included above then you may want to check [Awesome Tauri on GitHub](https://github.com/tauri-apps/awesome-tauri#guides) to see if a guide has been created.

Next: [Install Rust](#rust)

### macOS

[Section titled “macOS”](#macos)

Tauri uses [Xcode](https://developer.apple.com/xcode/resources/) and various macOS and iOS development dependencies.

Download and install Xcode from one of the following places:

* [Mac App Store](https://apps.apple.com/gb/app/xcode/id497799835?mt=12)
* [Apple Developer website](https://developer.apple.com/xcode/resources/).

Be sure to launch Xcode after installing so that it can finish setting up.

Only developing for desktop targets?
If you’re only planning to develop desktop apps and not targeting iOS then you can install Xcode Command Line Tools instead:

Terminal window

```
xcode-select --install
```

Next: [Install Rust](#rust)

### Windows

[Section titled “Windows”](#windows)

Tauri uses the Microsoft C++ Build Tools for development as well as Microsoft Edge WebView2. These are both required for development on Windows.

Follow the steps below to install the required dependencies.

#### Microsoft C++ Build Tools

[Section titled “Microsoft C++ Build Tools”](#microsoft-c-build-tools)

1. Download the [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) installer and open it to begin installation.
2. During installation check the “Desktop development with C++” option.

Next: [Install WebView2](#webview2).

#### WebView2

[Section titled “WebView2”](#webview2)

Tauri uses Microsoft Edge WebView2 to render content on Windows.

Install WebView2 by visiting the [WebView2 Runtime download section](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download-section). Download the “Evergreen Bootstrapper” and install it.

Next: [Check VBSCRIPT](#vbscript-for-msi-installers)

#### VBSCRIPT (for MSI installers)

[Section titled “VBSCRIPT (for MSI installers)”](#vbscript-for-msi-installers)

Building MSI packages on Windows requires the VBSCRIPT optional feature to be enabled. This feature is enabled by default on most Windows installations, but may have been disabled on some systems.

If you encounter errors like `failed to run light.exe` when building MSI packages, you may need to enable the VBSCRIPT feature:

1. Open **Settings** → **Apps** → **Optional features** → **More Windows features**
2. Locate **VBSCRIPT** in the list and ensure it’s checked
3. Click **Next** and restart your computer if prompted

**Note:** VBSCRIPT is currently enabled by default on most Windows installations, but is [being deprecated](https://techcommunity.microsoft.com/blog/windows-itpro-blog/vbscript-deprecation-timelines-and-next-steps/4148301) and may be disabled in future Windows versions.

Next: [Install Rust](#rust)

## Rust

[Section titled “Rust”](#rust)

Tauri is built with [Rust](https://www.rust-lang.org) and requires it for development. Install Rust using one of following methods. You can view more installation methods at <https://www.rust-lang.org/tools/install>.

* [Linux and macOS](#tab-panel-1-0)
* [Windows](#tab-panel-1-1)

Install via [`rustup`](https://github.com/rust-lang/rustup) using the following command:

Terminal window

```
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

Visit <https://www.rust-lang.org/tools/install> to install `rustup`.

Alternatively, you can use `winget` to install rustup using the following command in PowerShell:

Terminal window

```
winget install --id Rustlang.Rustup
```

**Be sure to restart your Terminal (and in some cases your system) for the changes to take effect.**

Next: [Configure for Mobile Targets](#configure-for-mobile-targets) if you’d like to build for Android and iOS, or, if you’d like to use a JavaScript framework, [install Node](#nodejs). Otherwise [Create a Project](/start/create-project/).

## Node.js

[Section titled “Node.js”](#nodejs)

1. Go to the [Node.js website](https://nodejs.org), download the Long Term Support (LTS) version and install it.
2. Check if Node was successfully installed by running:

Terminal window

```
node -v

# v20.10.0

npm -v

# 10.2.3
```

It’s important to restart your Terminal to ensure it recognizes the new installation. In some cases, you might need to restart your computer.

While npm is the default package manager for Node.js, you can also use others like pnpm or yarn. To enable these, run `corepack enable` in your Terminal. This step is optional and only needed if you prefer using a package manager other than npm.

Next: [Configure for Mobile Targets](#configure-for-mobile-targets) or [Create a project](/start/create-project/).

## Configure for Mobile Targets

[Section titled “Configure for Mobile Targets”](#configure-for-mobile-targets)

If you’d like to target your app for Android or iOS then there are a few additional dependencies that you need to install:

* [Android](#android)
* [iOS](#ios)

### Android

[Section titled “Android”](#android)

1. Download and install [Android Studio from the Android Developers website](https://developer.android.com/studio)
2. Set the `JAVA_HOME` environment variable:

* [Linux](#tab-panel-2-0)
* [macOS](#tab-panel-2-1)
* [Windows](#tab-panel-2-2)

Terminal window

```
export JAVA_HOME=/opt/android-studio/jbr
```

Terminal window

```
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

Terminal window

```
[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")
```

3. Use the SDK Manager in Android Studio to install the following:

* Android SDK Platform
* Android SDK Platform-Tools
* NDK (Side by side)
* Android SDK Build-Tools
* Android SDK Command-line Tools

Selecting “Show Package Details” in the SDK Manager enables the installation of older package versions. Only install older versions if necessary, as they may introduce compatibility issues or security risks.

4. Set `ANDROID_HOME` and `NDK_HOME` environment variables.

* [Linux](#tab-panel-3-0)
* [macOS](#tab-panel-3-1)
* [Windows](#tab-panel-3-2)

Terminal window

```
export ANDROID_HOME="$HOME/Android/Sdk"

export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk)"
```

Terminal window

```
export ANDROID_HOME="$HOME/Library/Android/sdk"

export NDK_HOME="$ANDROID_HOME/ndk/$(ls -1 $ANDROID_HOME/ndk)"
```

Terminal window

```
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LocalAppData\Android\Sdk", "User")

$VERSION = Get-ChildItem -Name "$env:LocalAppData\Android\Sdk\ndk" | Select-Object -Last 1

[System.Environment]::SetEnvironmentVariable("NDK_HOME", "$env:LocalAppData\Android\Sdk\ndk\$VERSION", "User")
```

5. Add the Android targets with `rustup`:

Terminal window

```
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Next: [Setup for iOS](#ios) or [Create a project](/start/create-project/).

### iOS

[Section titled “iOS”](#ios)

1. Add the iOS targets with `rustup` in Terminal:

Terminal window

```
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
```

2. Install [Homebrew](https://brew.sh):

Terminal window

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

3. Install [Cocoapods](https://cocoapods.org) using Homebrew:

Terminal window

```
brew install cocoapods
```

Next: [Create a project](/start/create-project/).

## Troubleshooting

[Section titled “Troubleshooting”](#troubleshooting)

If you run into any issues during installation be sure to check the [Troubleshooting Guide](/develop/debug/) or reach out on the [Tauri Discord](https://discord.com/invite/tauri).

Next Steps

Now that you’ve installed all of the prerequisites you’re ready to [create your first Tauri project](/start/create-project/)!

---

[Support on Open Collective](https://opencollective.com/tauri)[Sponsor on GitHub](https://github.com/sponsors/tauri-apps)

© 2026 Tauri Contributors. CC-BY / MIT