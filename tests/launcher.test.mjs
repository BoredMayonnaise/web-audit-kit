import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  copyFile,
  readFile,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { openSync, closeSync, readFileSync } from "node:fs";

test(
  "Bash launcher opens built output without Node and dispatches desktop commands safely",
  { skip: process.platform === "win32" },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "audit launcher ")),
      bin = join(root, "bin"),
      app = join(root, "dist/web-audit-kit.html"),
      log = join(root, "opened.txt");
    try {
      await mkdir(bin);
      await mkdir(join(root, "dist"));
      await writeFile(app, "offline application");
      await copyFile(
        new URL("../start.sh", import.meta.url),
        join(root, "start.sh"),
      );
      await symlink("/usr/bin/dirname", join(bin, "dirname"));
      const stub = async (name, body) =>
        writeFile(join(bin, name), "#!/bin/bash\n" + body + "\n", {
          mode: 0o755,
        });
      await stub("node", "exit 91");
      await stub("npm", "exit 91");
      const env = {
        ...process.env,
        PATH: bin,
        AUDIT_OPEN_LOG: log,
        DISPLAY: ":test",
        WAYLAND_DISPLAY: "",
      };
      const execute = (args = []) => {
        const out = openSync(join(root, "stdout"), "w"),
          err = openSync(join(root, "stderr"), "w");
        let result;
        try {
          result = spawnSync("/bin/bash", [join(root, "start.sh"), ...args], {
            env,
            cwd: tmpdir(),
            stdio: ["ignore", out, err],
          });
        } finally {
          closeSync(out);
          closeSync(err);
        }
        if (result.error) throw result.error;
        return {
          status: result.status,
          stdout: readFileSync(join(root, "stdout"), "utf8"),
          stderr: readFileSync(join(root, "stderr"), "utf8"),
        };
      };
      const run = () => {
        const result = execute();
        assert.equal(result.status, 0, result.stderr);
        return result.stdout;
      };
      await stub("uname", "printf Linux");
      await stub("xdg-open", 'printf "%s\\n" "$@" > "$AUDIT_OPEN_LOG"');
      assert.match(run(), /Opening Web Audit Kit/);
      assert.equal((await readFile(log, "utf8")).trim(), app);
      await stub("firefox", 'printf "%s\\n" "$@" > "$AUDIT_OPEN_LOG"');
      assert.equal(execute(["--browser", "firefox"]).status, 0);
      assert.equal((await readFile(log, "utf8")).trim(), app);
      assert.equal(execute(["--browser"]).status, 2);
      assert.equal(execute(["--browser", "--safe-graphics"]).status, 2);
      assert.equal(execute(["--browser", "missing-browser"]).status, 1);
      assert.equal(execute(["--safe-graphics"]).status, 1);
      await stub("chromium", 'printf "%s\\n" "$@" > "$AUDIT_OPEN_LOG"');
      const graphics = execute(["--safe-graphics"]);
      assert.equal(graphics.status, 0, graphics.stderr);
      assert.deepEqual((await readFile(log, "utf8")).trim().split("\n"), [
        "--disable-gpu", "--ozone-platform=x11", app,
      ]);
      env.DISPLAY = "";
      env.WAYLAND_DISPLAY = "wayland-test";
      assert.equal(execute(["--browser", "chromium", "--safe-graphics"]).status, 0);
      assert.deepEqual((await readFile(log, "utf8")).trim().split("\n"), [
        "--disable-gpu", app,
      ]);
      assert.equal(execute(["--browser", "firefox", "--safe-graphics"]).status, 2);
      await stub("browser with spaces", 'printf "%s\\n" "$@" > "$AUDIT_OPEN_LOG"');
      assert.equal(execute(["--browser", join(bin, "browser with spaces")]).status, 0);
      assert.equal((await readFile(log, "utf8")).trim(), app);
      await rm(log);
      env.WAYLAND_DISPLAY = "";
      const headless = execute();
      assert.equal(headless.status, 1);
      assert.match(headless.stderr, /No graphical desktop detected/);
      await assert.rejects(readFile(log), { code: "ENOENT" });
      env.DISPLAY = ":test";
      await stub("xdg-open", 'exit 1');
      const failed = execute();
      assert.equal(failed.status, 1);
      assert.match(failed.stdout, /--browser firefox/);
      assert.match(failed.stdout, /--safe-graphics/);
      assert.match(failed.stdout, /dist\/web-audit-kit\.html/);
      assert.match(failed.stderr, /Could not open a browser/);
      await stub("xdg-open", 'exit 0');
      assert.match(run(), /does not confirm a window opened/);
      await stub("uname", "printf Darwin");
      await stub("open", 'printf "%s\\n" "$@" > "$AUDIT_OPEN_LOG"');
      run();
      assert.equal((await readFile(log, "utf8")).trim(), app);
      assert.equal(execute(["--safe-graphics"]).status, 2);
      await stub("uname", "printf MINGW64_NT");
      await stub("cygpath", "printf 'C:/Audit Kit/app.html'");
      await stub("cmd.exe", 'printf "%s\\n" "$@" > "$AUDIT_OPEN_LOG"');
      run();
      assert.deepEqual((await readFile(log, "utf8")).split("\n"), [
        "/c",
        "start",
        "",
        "C:/Audit Kit/app.html",
        "",
      ]);
      const bad = execute(["--unknown"]);
      assert.equal(bad.status, 2);
      await rm(app);
      await rm(join(bin, "node"));
      await rm(join(bin, "npm"));
      const missing = execute();
      assert.equal(missing.status, 1);
      assert.match(missing.stderr, /ready-built app does not need Node/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
