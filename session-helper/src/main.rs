use std::{io::{Read, Write}, process::{Command, Stdio}};
extern "C" { fn getppid() -> i32; fn proc_pidpath(pid: i32, buffer: *mut u8, buffersize: u32) -> i32; }
const REQUIREMENT: &str = "=identifier \"com.linksaw.snippets\" and certificate leaf = H\"1f330140331aa074911da2df2dae71e1331604ce\"";

fn run() -> Result<(), String> {
    // Only the signed Linksaw app can invoke this helper. Never authorize an
    // arbitrary caller merely because it knows the executable's path.
    let mut path = [0u8; 4096];
    let length = unsafe { proc_pidpath(getppid(), path.as_mut_ptr(), path.len() as u32) };
    if length <= 0 { return Err("Could not identify Linksaw.".into()); }
    let path = std::ffi::CStr::from_bytes_until_nul(&path).map_err(|_| "Invalid caller")?.to_str().map_err(|_| "Invalid caller")?;
    // Verify the bundle so Info.plist and its sealed resources are available.
    let bundle = path.rsplit_once("/Contents/MacOS/").map(|(bundle, _)| bundle).ok_or("Caller is not a Mac app")?;
    let verified = Command::new("/usr/bin/codesign").args(["--verify", "--strict", "-R", REQUIREMENT, bundle]).stdout(Stdio::null()).stderr(Stdio::null()).status().map_err(|_| "Could not verify Linksaw")?;
    if !verified.success() { return Err("Only the signed Linksaw app may access this session.".into()); }
    let entry = keyring::Entry::new("Linksaw Snippets", "stable-session-v1").map_err(|_| "Could not open session storage")?;
    match std::env::args().nth(1).as_deref() {
        Some("read") => {
            let value = match entry.get_password() {
                Ok(value) => value,
                Err(keyring::Error::NoEntry) => {
                    // Migrate once, within this process; no tokens reach logs or files.
                    let legacy = keyring::Entry::new("Linksaw Snippets", "session").map_err(|_| "Could not open old session")?;
                    match legacy.get_password() {
                        Ok(value) => { entry.set_password(&value).map_err(|_| "Could not save migrated session")?; value }
                        Err(keyring::Error::NoEntry) => String::new(),
                        Err(_) => return Err("Could not access saved sign-in. Approve the helper's Keychain prompt or sign in again.".into()),
                    }
                }
                Err(_) => return Err("Could not read saved sign-in.".into()),
            };
            std::io::stdout().write_all(value.as_bytes()).map_err(|_| "Could not return session")?;
        }
        Some("save") => {
            let mut value = String::new();
            std::io::stdin().take(65).read_to_string(&mut value).map_err(|_| "Could not read session")?;
            if value.len() != 64 || !value.chars().all(|c| c.is_ascii_alphanumeric()) { return Err("Invalid session".into()); }
            entry.set_password(&value).map_err(|_| "Could not save sign-in")?;
        }
        Some("clear") => {
            // Empty sentinel prevents re-migrating the old login after sign-out.
            entry.set_password("").map_err(|_| "Could not clear sign-in")?;
        }
        _ => return Err("Invalid session operation".into()),
    }
    Ok(())
}
fn main() {
    if let Err(error) = run() { eprintln!("{error}"); std::process::exit(1); }
}
