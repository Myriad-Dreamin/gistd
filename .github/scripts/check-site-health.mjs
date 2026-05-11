#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

const siteUrl = process.argv[2];
if (!siteUrl) {
  console.error("Usage: node .github/scripts/check-site-health.mjs <url>");
  process.exit(2);
}

const timeoutMs = Number(process.env.SITE_HEALTH_TIMEOUT_MS || 120000);
const pollIntervalMs = 1000;

const chromeBin = findChrome();
const userDataDir = mkdtempSync(join(tmpdir(), "gistd-site-health-"));
const port = await getFreePort();

let chromeStderr = "";
const chrome = spawn(
  chromeBin,
  [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] }
);

chrome.stderr.on("data", (chunk) => {
  chromeStderr += chunk.toString();
  if (chromeStderr.length > 8000) {
    chromeStderr = chromeStderr.slice(-8000);
  }
});

let cleanedUp = false;
const cleanup = () => {
  if (cleanedUp) {
    return;
  }
  cleanedUp = true;
  if (!chrome.killed) {
    chrome.kill("SIGTERM");
  }
  rmSync(userDataDir, { recursive: true, force: true });
};

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

try {
  await waitForChrome(port, timeoutMs);
  const target = await createTarget(port);
  const client = await connectCdp(target.webSocketDebuggerUrl);
  const browserLogs = [];

  client.onEvent((message) => {
    if (message.method === "Runtime.consoleAPICalled") {
      const { type, args } = message.params;
      browserLogs.push(
        `[console:${type}] ${args.map((arg) => formatRemoteObject(arg)).join(" ")}`
      );
    } else if (message.method === "Log.entryAdded") {
      const { entry } = message.params;
      browserLogs.push(`[${entry.level}] ${entry.text}`);
    }
    if (browserLogs.length > 50) {
      browserLogs.shift();
    }
  });

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Page.navigate", { url: siteUrl });

  const state = await waitForHealthyRender(client, browserLogs);
  console.log(
    `Rendered ${siteUrl}: title=${JSON.stringify(state.title)}, pages=${state.pageCount}`
  );
  client.close();
  cleanup();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (chromeStderr.trim()) {
    console.error("\nChrome stderr:");
    console.error(chromeStderr.trim());
  }
  cleanup();
  process.exit(1);
}

async function waitForHealthyRender(client, browserLogs) {
  const started = Date.now();
  let lastState = null;

  while (Date.now() - started < timeoutMs) {
    await delay(pollIntervalMs);
    lastState = await getPageState(client);

    if (lastState.rendered && !lastState.errorText) {
      return lastState;
    }
  }

  const details = [
    `Timed out after ${timeoutMs}ms waiting for ${siteUrl} to render.`,
    `Last state: ${JSON.stringify(lastState, null, 2)}`,
  ];

  if (browserLogs.length) {
    details.push(`Recent browser logs:\n${browserLogs.slice(-20).join("\n")}`);
  }

  throw new Error(details.join("\n\n"));
}

async function getPageState(client) {
  const expression = String.raw`
    (() => {
      const error = document.querySelector("div.error");
      const bodyText = document.body?.innerText || "";
      const pages = document.querySelectorAll(".typst-dom-page");

      return {
        appShell: Boolean(document.querySelector("#app")),
        bodyText: bodyText.slice(0, 1000),
        errorText: error?.textContent?.trim() || "",
        href: location.href,
        loadingCompiler: bodyText.includes("Loading compiler from CDN..."),
        loadingFonts: bodyText.includes("Loading fonts from CDN..."),
        pageCount: pages.length,
        rendered: pages.length > 0,
        title: document.title,
      };
    })()
  `;

  const response = await client.send("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });

  if (response.exceptionDetails) {
    throw new Error(
      `Failed to inspect page state: ${JSON.stringify(response.exceptionDetails)}`
    );
  }

  return response.result.value;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    "google-chrome",
    "google-chrome-stable",
    "chromium-browser",
    "chromium",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes("/") && existsSync(candidate)) {
      return candidate;
    }

    const result = spawnSync("which", [candidate], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status === 0) {
      return result.stdout.trim().split("\n")[0];
    }
  }

  throw new Error("No Chrome or Chromium binary is available");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForChrome(port, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Chrome is still starting.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for Chrome on port ${port}`);
}

async function createTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Failed to create Chrome target: HTTP ${response.status}`);
  }

  const target = await response.json();
  if (!target.webSocketDebuggerUrl) {
    throw new Error(`Chrome target is missing a debugger URL: ${JSON.stringify(target)}`);
  }
  return target;
}

function connectCdp(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketUrl);
    const pending = new Map();
    const eventHandlers = new Set();
    let nextId = 1;

    ws.addEventListener("open", () => {
      resolve({
        close: () => ws.close(),
        onEvent: (handler) => eventHandlers.add(handler),
        send: (method, params = {}) => {
          const id = nextId++;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((sendResolve, sendReject) => {
            pending.set(id, { resolve: sendResolve, reject: sendReject });
          });
        },
      });
    });

    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = pending.get(message.id);
        if (!entry) {
          return;
        }
        pending.delete(message.id);
        if (message.error) {
          entry.reject(new Error(`${message.error.message}: ${message.error.data || ""}`));
        } else {
          entry.resolve(message.result || {});
        }
      } else {
        for (const handler of eventHandlers) {
          handler(message);
        }
      }
    });

    ws.addEventListener("error", reject);
  });
}

function formatRemoteObject(value) {
  if ("value" in value) {
    return String(value.value);
  }
  return value.description || value.type;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
