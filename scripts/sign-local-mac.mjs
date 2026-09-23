// Stable, private development identity. No system trust settings are changed.
import { mkdirSync, existsSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

if (process.platform !== 'darwin') throw new Error('This script is for macOS.');
const dir = join(homedir(), 'Library/Application Support/Linksaw Snippets/Signing');
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
const passwordFile = join(dir, 'password');
if (!existsSync(passwordFile)) writeFileSync(passwordFile, randomBytes(32).toString('hex'), { mode: 0o600 });
const password = readFileSync(passwordFile, 'utf8');
const keychain = join(dir, 'local-signing.keychain-db');
const cert = join(dir, 'certificate.pem');
const key = join(dir, 'private-key.pem');
const p12 = join(dir, 'identity.p12');
const run = (cmd, args) => {
  try { return execFileSync(cmd, args, { stdio: 'pipe' }).toString(); }
  catch (error) { throw new Error(`${cmd} failed: ${String(error.stderr || '').replaceAll(password, '[redacted]')}`); }
};
if (!existsSync(keychain)) run('/usr/bin/security', ['create-keychain', '-p', password, keychain]);
run('/usr/bin/security', ['unlock-keychain', '-p', password, keychain]);
if (!existsSync(cert)) {
  run('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
    '-days', '3650', '-subj', '/CN=Linksaw Snippets Local Development',
    '-addext', 'basicConstraints=critical,CA:FALSE', '-addext', 'keyUsage=critical,digitalSignature',
    '-addext', 'extendedKeyUsage=critical,codeSigning']);
  chmodSync(key, 0o600);
}
const fingerprint = run('openssl', ['x509', '-in', cert, '-noout', '-fingerprint', '-sha1']).trim().split('=').pop().replaceAll(':', '');
const identities = run('/usr/bin/security', ['find-identity', '-p', 'codesigning', keychain]);
if (!identities.includes(fingerprint)) {
  run('openssl', ['pkcs12', '-export', '-legacy', '-inkey', key, '-in', cert, '-out', p12, '-passout', `file:${passwordFile}`]);
  chmodSync(p12, 0o600);
  run('/usr/bin/security', ['import', p12, '-k', keychain, '-P', password, '-T', '/usr/bin/codesign']);
}
const bundle = resolve(process.argv[2] || 'src-tauri/target/release/bundle/macos/Linksaw.app');
run('/usr/bin/codesign', ['--force', '--sign', fingerprint, '--keychain', keychain, '--identifier', process.argv[3] || 'com.linksaw.snippets', '--timestamp=none', bundle]);
run('/usr/bin/codesign', ['--verify', '--strict', bundle]);
console.log('Signed and verified with the persistent local Linksaw identity.');
