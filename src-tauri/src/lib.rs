use arboard::Clipboard;
use enigo::{Direction::{Click, Press, Release}, Enigo, Key, Keyboard, Settings};
use std::{sync::{Mutex, OnceLock, atomic::{AtomicBool, AtomicI8, Ordering}}, thread, time::Duration, path::PathBuf, io::Write};
#[cfg(target_os = "macos")]
use std::cell::Cell;
use tauri::{Emitter, Manager, State};
#[cfg(target_os = "macos")]
use objc2_app_kit::{NSApplication, NSApplicationActivationOptions, NSImage, NSRunningApplication, NSWorkspace, NSWindow, NSWindowCollectionBehavior};
#[cfg(target_os = "macos")]
use objc2_foundation::NSData;
#[cfg(target_os = "macos")]
use core_graphics::event::{CallbackResult, CGEventFlags, CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement, CGEventType, EventField};
#[cfg(target_os = "macos")]
use core_foundation::runloop::CFRunLoop;

const SERVICE: &str = "Linksaw Snippets";
const ACCOUNT: &str = "session";
static LOG_PATH: OnceLock<PathBuf> = OnceLock::new();
static QUIT_ALLOWED: AtomicBool = AtomicBool::new(false);
static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
static PASTING: AtomicBool = AtomicBool::new(false);
static LAST_PERMISSION: AtomicI8 = AtomicI8::new(-1);

fn trace(message: &str) {
    if let Some(path) = LOG_PATH.get() {
        if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
            let time = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
            let _ = writeln!(file, "{time} {message}");
        }
    }
}

#[cfg(target_os = "macos")]
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn AXIsProcessTrusted() -> bool;
}

#[derive(Default)]
struct PasteTarget(Mutex<Option<i32>>);

#[cfg(target_os = "macos")]
fn start_right_command_monitor(app: tauri::AppHandle) {
    thread::spawn(move || {
        // A passive tap observes the physical right Command key without altering
        // normal Command shortcuts. Retry after the user grants Accessibility.
        loop {
            let down = Cell::new(false);
            let alone = Cell::new(false);
            let result = CGEventTap::with_enabled(
                CGEventTapLocation::Session,
                CGEventTapPlacement::HeadInsertEventTap,
                CGEventTapOptions::ListenOnly,
                vec![CGEventType::FlagsChanged, CGEventType::KeyDown, CGEventType::KeyUp],
                |_, kind, event| {
                    match kind {
                        CGEventType::FlagsChanged => {
                            if event.get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE) == 54 {
                                // NX_DEVICERCMDKEYMASK distinguishes right Command
                                // from left Command, even when both are held.
                                let flags = event.get_flags();
                                if flags.bits() & 0x10 != 0 && !down.get() {
                                    down.set(true);
                                    let other_modifiers = CGEventFlags::CGEventFlagShift
                                        | CGEventFlags::CGEventFlagControl | CGEventFlags::CGEventFlagAlternate;
                                    alone.set(!flags.intersects(other_modifiers) && flags.bits() & 0x08 == 0);
                                } else if down.get() {
                                    down.set(false);
                                    if alone.get() { trace("right-command tap"); let _ = app.emit("right-command-tap", ()); }
                                    alone.set(false);
                                }
                            } else if down.get() { alone.set(false); }
                        }
                        CGEventType::KeyDown | CGEventType::KeyUp => { if down.get() { alone.set(false); } }
                        CGEventType::TapDisabledByTimeout | CGEventType::TapDisabledByUserInput => {
                            down.set(false); alone.set(false);
                            CFRunLoop::get_current().stop();
                        }
                        _ => {}
                    }
                    CallbackResult::Keep
                },
                || { trace("right-command monitor ready"); CFRunLoop::run_current(); },
            );
            if result.is_err() { thread::sleep(Duration::from_secs(2)); }
        }
    });
}

#[tauri::command]
fn remember_target_app(target: State<'_, PasteTarget>) {
    #[cfg(target_os = "macos")]
    {
    trace("launcher requested; capturing previous focus");
    *target.0.lock().unwrap() = None;
    if let Some(app) = NSWorkspace::sharedWorkspace().frontmostApplication() {
        let pid = app.processIdentifier();
        if pid != std::process::id() as i32 && focused_text_is_editable(pid) {
            *target.0.lock().unwrap() = Some(pid);
            trace(&format!("paste target {pid}"));
        }
    }
    }
    #[cfg(not(target_os = "macos"))]
    let _ = target;
}

#[cfg(target_os = "macos")]
fn focused_text_is_editable(pid: i32) -> bool {
    use core_foundation::{base::{CFRelease, TCFType}, string::CFString};
    use std::ffi::c_void;
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXUIElementCreateApplication(pid: i32) -> *const c_void;
        fn AXUIElementCopyAttributeValue(element: *const c_void, attribute: *const c_void, value: *mut *const c_void) -> i32;
        fn AXUIElementIsAttributeSettable(element: *const c_void, attribute: *const c_void, settable: *mut u8) -> i32;
    }
    // Capture while the destination still has focus; an app alone is not a
    // paste target. Never read the user's field contents to make this decision.
    unsafe {
        let app = AXUIElementCreateApplication(pid);
        if app.is_null() { return false; }
        let mut focused = std::ptr::null();
        let result = AXUIElementCopyAttributeValue(app, CFString::new("AXFocusedUIElement").as_CFTypeRef(), &mut focused);
        CFRelease(app);
        if result != 0 || focused.is_null() { return false; }
        let mut role = std::ptr::null();
        let result = AXUIElementCopyAttributeValue(focused, CFString::new("AXRole").as_CFTypeRef(), &mut role);
        let text_role = if result == 0 && !role.is_null() {
            let role = CFString::wrap_under_create_rule(role.cast());
            matches!(role.to_string().as_str(), "AXTextField" | "AXTextArea" | "AXComboBox")
        } else { false };
        let editable = text_role && ["AXValue", "AXSelectedText"].iter().any(|attribute| {
            let mut settable = 0;
            AXUIElementIsAttributeSettable(focused, CFString::new(attribute).as_CFTypeRef(), &mut settable) == 0 && settable != 0
        });
        CFRelease(focused);
        editable
    }
}

#[cfg(not(target_os = "macos"))]
fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn read_session() -> Result<String, String> {
    match entry()?.get_password() {
        Ok(value) => Ok(value),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn save_session(token: String) -> Result<(), String> {
    if token.len() != 64 || !token.chars().all(|character| character.is_ascii_alphanumeric()) {
        return Err("Invalid session token".into());
    }
    entry()?.set_password(&token).map_err(|error| error.to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn clear_session() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(target_os = "macos")]
fn helper_session(app: tauri::AppHandle, operation: &str, token: Option<String>) -> Result<String, String> {
    use std::os::unix::fs::PermissionsExt;
    use std::process::{Command, Stdio};
    const HELPER: &[u8] = include_bytes!("../helper-bin/linksaw-session-helper");
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("SessionHelper");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700)).map_err(|e| e.to_string())?;
    let path = dir.join("linksaw-session-helper");
    if path.exists() {
        let metadata = std::fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        if !metadata.is_file() || std::fs::read(&path).map_err(|e| e.to_string())? != HELPER {
            return Err("Sign-in helper identity changed. A deliberate helper migration is required.".into());
        }
    } else {
        let mut file = std::fs::OpenOptions::new().create_new(true).write(true).open(&path).map_err(|e| e.to_string())?;
        file.write_all(HELPER).map_err(|e| e.to_string())?;
    }
    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700)).map_err(|e| e.to_string())?;
    let mut child = Command::new(path).arg(operation).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().map_err(|e| e.to_string())?;
    if let Some(token) = token { child.stdin.take().ok_or("No helper input")?.write_all(token.as_bytes()).map_err(|e| e.to_string())?; }
    else { drop(child.stdin.take()); }
    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    if !output.status.success() { return Err(String::from_utf8_lossy(&output.stderr).trim().to_string()); }
    String::from_utf8(output.stdout).map_err(|_| "Invalid helper response".into())
}

#[cfg(target_os = "macos")]
#[tauri::command]
async fn read_session(app: tauri::AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || helper_session(app, "read", None)).await.map_err(|e| e.to_string())?
}
#[cfg(target_os = "macos")]
#[tauri::command]
async fn save_session(app: tauri::AppHandle, token: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || helper_session(app, "save", Some(token)).map(|_| ())).await.map_err(|e| e.to_string())?
}
#[cfg(target_os = "macos")]
#[tauri::command]
async fn clear_session(app: tauri::AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || helper_session(app, "clear", None).map(|_| ())).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn read_clipboard() -> Result<String, String> {
    Clipboard::new().map_err(|error| error.to_string())?
        .get_text().or_else(|_| Ok(String::new()))
}

#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    Clipboard::new().map_err(|error| error.to_string())?
        .set_text(text).map_err(|error| error.to_string())
}

#[tauri::command]
fn paste_access_status() -> bool {
    #[cfg(target_os = "macos")]
    {
        // Query macOS directly. Input-driver initialization can fail for reasons
        // unrelated to Accessibility and must not be reported as permission off.
        let trusted = unsafe { AXIsProcessTrusted() };
        if LAST_PERMISSION.swap(trusted as i8, Ordering::Relaxed) != trusted as i8 {
            trace(if trusted { "accessibility trusted" } else { "accessibility not trusted" });
        }
        trusted
    }
    #[cfg(not(target_os = "macos"))]
    { true }
}

#[tauri::command]
fn request_paste_access() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        // macOS presents this asynchronously; do not open Settings over its prompt.
        Ok(Enigo::new(&Settings::default()).is_ok())
    }
    #[cfg(not(target_os = "macos"))]
    { Ok(true) }
}

#[tauri::command]
fn open_paste_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("/usr/bin/open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn paste_text(window: tauri::WebviewWindow, target: State<'_, PasteTarget>, text: String, cursor_left: usize) -> Result<bool, String> {
    if PASTING.swap(true, Ordering::AcqRel) { return Err("A paste is already in progress.".into()); }
    struct ResetPaste;
    impl Drop for ResetPaste { fn drop(&mut self) { PASTING.store(false, Ordering::Release); } }
    let reset = ResetPaste;
    let destination_pid = *target.0.lock().unwrap();
    // Clipboard waits and app activation must not block the window's event loop.
    tauri::async_runtime::spawn_blocking(move || {
        let _reset = reset;
        trace("paste started");
        let result = paste_text_blocking(window, destination_pid, text, cursor_left);
        match &result { Ok(true) => trace("paste sent"), Ok(false) => trace("copied without destination"), Err(error) => trace(&format!("paste failed: {error}")) }
        result
    }).await.map_err(|error| error.to_string())?
}

fn paste_text_blocking(window: tauri::WebviewWindow, destination_pid: Option<i32>, text: String, cursor_left: usize) -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    let destination = match destination_pid.and_then(NSRunningApplication::runningApplicationWithProcessIdentifier) {
        Some(destination) => destination,
        None => {
            let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
            clipboard.set_text(text).map_err(|error| error.to_string())?;
            return Ok(false);
        }
    };
    // Check input permission before hiding the launcher or changing the clipboard.
    let settings = Settings { open_prompt_to_get_permissions: false, ..Settings::default() };
    let mut enigo = Enigo::new(&settings).map_err(|error| format!("Could not start pasting: {error}"))?;
    #[cfg(not(target_os = "macos"))]
    let _ = destination_pid;
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    let prior = clipboard.get_text().ok();
    clipboard.set_text(text.clone()).map_err(|error| error.to_string())?;
    window.hide().map_err(|error| error.to_string())?;
    #[cfg(target_os = "macos")]
    {
        if !destination.activateWithOptions(NSApplicationActivationOptions::empty()) {
            if let Some(previous) = prior { let _ = clipboard.set_text(previous); }
            let _ = window.show();
            return Err("Could not return to the app you were typing in. Try the shortcut from its text box again.".into());
        }
        for _ in 0..20 {
            if destination.isActive() { break; }
            thread::sleep(Duration::from_millis(50));
        }
        if !destination.isActive() {
            if let Some(previous) = prior { let _ = clipboard.set_text(previous); }
            let _ = window.show();
            return Err("Could not focus the app you were typing in. Try the shortcut from its text box again.".into());
        }
    }
    thread::sleep(Duration::from_millis(100));
    #[cfg(target_os = "macos")]
    let modifier = Key::Meta;
    #[cfg(not(target_os = "macos"))]
    let modifier = Key::Control;
    // Carbon's keyboard-layout lookup asserts that it runs on the main queue.
    // Keep only the short input operation there, never focus/clipboard waits.
    let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    window.run_on_main_thread(move || {
        let settings = Settings { open_prompt_to_get_permissions: false, ..Settings::default() };
        let result = Enigo::new(&settings).map(|mut input| {
            let pressed = input.key(modifier, Press).is_ok();
            let clicked = pressed && input.key(Key::Unicode('v'), Click).is_ok();
            let released = !pressed || input.key(modifier, Release).is_ok();
            pressed && clicked && released
        }).unwrap_or(false);
        let _ = sender.send(result);
    }).map_err(|error| error.to_string())?;
    let pasted = receiver.recv_timeout(Duration::from_secs(3)).unwrap_or(false);
    if !pasted {
        if let Some(previous) = prior { let _ = clipboard.set_text(previous); }
        let _ = window.show();
        return Err("Pasting was blocked. Check Accessibility permission for Linksaw.".into());
    }
    thread::sleep(Duration::from_millis(150));
    for _ in 0..cursor_left.min(100_000) {
        if enigo.key(Key::LeftArrow, Click).is_err() { break; }
    }
    thread::sleep(Duration::from_millis(1200));
    if let Ok(current) = clipboard.get_text() {
        if current == text {
            if let Some(previous) = prior { let _ = clipboard.set_text(previous); }
        }
    }
    Ok(true)
}

#[tauri::command]
fn finish_quit(app: tauri::AppHandle) {
    QUIT_ALLOWED.store(true, Ordering::SeqCst);
    app.exit(0);
}

fn request_quit(app: &tauri::AppHandle) {
    trace("quit requested; check editor");
    let _ = app.emit("request-quit", ());
}

// Cocoa's Quit menu and Dock Quit terminate directly, bypassing Tauri's
// ExitRequested event. Install the delegate's documented veto callback too.
#[cfg(target_os = "macos")]
unsafe extern "C" fn should_terminate(_: *mut std::ffi::c_void, _: *mut std::ffi::c_void, _: *mut std::ffi::c_void) -> usize {
    if QUIT_ALLOWED.load(Ordering::SeqCst) { return 1; }
    if let Some(app) = APP_HANDLE.get() { request_quit(app); }
    0 // NSTerminateCancel; the frontend exits explicitly after resolving the draft.
}

#[cfg(target_os = "macos")]
fn configure_mac_launcher(window: &tauri::WebviewWindow) -> Result<(), Box<dyn std::error::Error>> {
    use objc2::{AnyThread, MainThreadMarker, msg_send, runtime::AnyObject};
    use std::ffi::{c_char, c_void};
    #[link(name = "objc")]
    extern "C" {
        fn object_getClass(object: *mut c_void) -> *mut c_void;
        fn sel_registerName(name: *const c_char) -> *mut c_void;
        fn class_addMethod(class: *mut c_void, selector: *mut c_void, implementation: *const c_void, types: *const c_char) -> bool;
    }
    let mtm = MainThreadMarker::new().ok_or("Launcher must be configured on the main thread")?;
    unsafe {
        let native: &NSWindow = &*window.ns_window()?.cast();
        let mut behavior = native.collectionBehavior();
        behavior.remove(NSWindowCollectionBehavior::FullScreenPrimary | NSWindowCollectionBehavior::MoveToActiveSpace | NSWindowCollectionBehavior::Primary | NSWindowCollectionBehavior::Auxiliary);
        behavior.insert(NSWindowCollectionBehavior::CanJoinAllSpaces | NSWindowCollectionBehavior::FullScreenAuxiliary | NSWindowCollectionBehavior::CanJoinAllApplications);
        native.setCollectionBehavior(behavior);
        let app = NSApplication::sharedApplication(mtm);
        let icon_data = NSData::with_bytes(include_bytes!("../icons/icon.png"));
        if let Some(icon) = NSImage::initWithData(NSImage::alloc(mtm), &icon_data) {
            app.setApplicationIconImage(Some(&icon));
        }
        let delegate: *mut AnyObject = msg_send![&app, delegate];
        if delegate.is_null() || !class_addMethod(object_getClass(delegate.cast()), sel_registerName(c"applicationShouldTerminate:".as_ptr()), should_terminate as *const c_void, c"Q@:@".as_ptr()) {
            return Err("Could not install the macOS quit guard".into());
        }
    }
    trace("launcher joins full-screen Spaces; native quit guard ready");
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--autostart"])))
        .manage(PasteTarget::default())
        .on_window_event(|window, event| {
            #[cfg(target_os = "macos")]
            if matches!(event, tauri::WindowEvent::Focused(true)) {
                // Only window state is logged, never snippet or session contents.
                if objc2::MainThreadMarker::new().is_some() {
                    if let Ok(pointer) = window.ns_window() {
                        let native: &NSWindow = unsafe { &*pointer.cast() };
                        trace(&format!("launcher focused; active Space={} visible={}", unsafe { native.isOnActiveSpace() }, native.isVisible()));
                    }
                }
            }
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if !QUIT_ALLOWED.load(Ordering::SeqCst) { api.prevent_close(); request_quit(window.app_handle()); }
            }
            if matches!(event, tauri::WindowEvent::Focused(false)) {
                trace("window lost focus; hide");
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![read_session, save_session, clear_session, read_clipboard, copy_text, paste_text, remember_target_app, paste_access_status, request_paste_access, open_paste_settings, finish_quit])
        .setup(|app| {
            if let Ok(dir) = app.path().app_log_dir() {
                let _ = std::fs::create_dir_all(&dir);
                let _ = LOG_PATH.set(dir.join("launcher.log"));
            }
            let _ = APP_HANDLE.set(app.handle().clone());
            trace("app started");
            std::panic::set_hook(Box::new(|info| { trace(&format!("panic: {info}")); }));
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                configure_mac_launcher(&window)?;
                if std::env::args().any(|arg| arg == "--autostart") { let _ = window.hide(); }
                else { let _ = window.set_focus(); }
            }
            #[cfg(target_os = "macos")]
            start_right_command_monitor(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Linksaw could not start")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = &event {
                if !QUIT_ALLOWED.load(Ordering::SeqCst) { api.prevent_exit(); request_quit(app_handle); }
            }
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                trace("dock reopen");
                *app_handle.state::<PasteTarget>().0.lock().unwrap() = None;
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            if matches!(event, tauri::RunEvent::Exit) { trace("app exited"); }
            #[cfg(not(target_os = "macos"))]
            let _ = (app_handle, event);
        });
}
