import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
if (process.platform === 'darwin') {
  const file = 'src-tauri/helper-bin/linksaw-session-helper';
  // Deliberately build/sign once. Routine app builds reuse these exact bytes.
  if (!existsSync(file)) {
    execFileSync('cargo', ['build', '--release', '--manifest-path', 'session-helper/Cargo.toml'], { stdio: 'inherit' });
    mkdirSync('src-tauri/helper-bin', { recursive: true });
    copyFileSync('session-helper/target/release/linksaw-session-helper', file);
    execFileSync(process.execPath, ['scripts/sign-local-mac.mjs', file, 'com.linksaw.snippets.session-helper'], { stdio: 'inherit' });
  }
}
