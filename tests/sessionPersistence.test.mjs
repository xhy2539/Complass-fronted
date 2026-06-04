import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadApi(existingStorage = new Map()) {
  const source = readFileSync(join(process.cwd(), "src", "api.ts"), "utf8");
  const patched = source.replace("const API_BASE = import.meta.env.VITE_API_BASE_URL ?? \"\";", "const API_BASE = \"\";");
  const compiled = ts.transpileModule(patched, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  const storage = existingStorage;
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };

  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    Headers,
    FormData,
    Blob,
    URL,
    document: { createElement: () => ({ click() {} }) },
    localStorage,
    setTimeout,
    clearTimeout,
    Date
  });

  return { apiModule: module.exports, storage };
}

test("session token survives module reload until expires_in elapses", () => {
  const { apiModule, storage } = loadApi();

  apiModule.storeSession({
    access_token: "secret-token",
    expires_in: 1,
    token_type: "bearer",
    user: { id: "user-1", email: "u@example.com", nickname: "U", is_active: true, is_verified: false }
  });

  assert.equal(apiModule.getStoredToken(), "secret-token");
  assert.equal(storage.get("complass_access_token"), "secret-token");

  const { apiModule: reloadedApiModule } = loadApi(storage);
  assert.equal(reloadedApiModule.getStoredToken(), "secret-token");

  const expiredClock = () => Date.now() + 2000;
  apiModule.__setSessionClockForTests(expiredClock);
  reloadedApiModule.__setSessionClockForTests(expiredClock);
  assert.equal(apiModule.getStoredToken(), null);
  assert.equal(reloadedApiModule.getStoredToken(), null);
});
