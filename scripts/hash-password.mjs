#!/usr/bin/env node
/**
 * Generates an ADMIN_PASSWORD_HASH value so the plain admin password never has to be stored anywhere
 * (env files, CI secrets, shell history) — only this hash does. It uses Web Crypto (no dependencies),
 * matching the format `admin-auth.server.ts` verifies: pbkdf2-sha256$<iterations>$<salt>$<hash>.
 *
 * Usage:
 *   node scripts/hash-password.mjs               (prompts for a password)
 *   node scripts/hash-password.mjs "my-password"  (not recommended: ends up in shell history)
 */
import { webcrypto as crypto } from "node:crypto";
import readline from "node:readline";

const ITERATIONS = 100_000;

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");

async function hash(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
  return `pbkdf2-sha256$${ITERATIONS}$${b64url(salt)}$${b64url(new Uint8Array(bits))}`;
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Best-effort masking; works in most terminals, harmless if it doesn't.
    rl._writeToOutput = (text) => rl.output.write(/[\r\n]/.test(text) ? text : "*".repeat(text.length));
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = process.argv[2] ?? (await prompt("Admin password to hash: "));
if (!password) {
  console.error("No password given.");
  process.exit(1);
}
console.log("\nADMIN_PASSWORD_HASH=" + (await hash(password)));
console.log("\nSet this as ADMIN_PASSWORD_HASH in your deployment environment (instead of ADMIN_PASSWORD).");
