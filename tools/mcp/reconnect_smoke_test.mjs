#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer, connect as connectTcp } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline";
import process from "node:process";

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directory, "..", "..");
const serverPath = path.join(directory, "server.mjs");
const godotBin = process.env.GODOT_BIN;
if (!godotBin) throw new Error("GODOT_BIN is required");

const port = await reservePort();
const token = randomBytes(32).toString("hex");
const environment = {
  ...process.env,
  GODOT_WS_PORT: String(port),
  GODOT_WS_URL: `ws://127.0.0.1:${port}`,
  GODOT_MCP_TOKEN: token,
};

let godot = startGodot();
let mcp = null;
try {
  await waitForPort(port);
  mcp = createMcpClient(environment);
  await mcp.rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "reconnect-smoke", version: "1" },
  });
  mcp.notify("notifications/initialized", {});
  await mcp.rpc("resources/subscribe", { uri: "godot://where-i-am/runtime/state" });
  const firstState = await mcp.waitForStateAvailability(true, 8000);
  if (!Number.isInteger(firstState.state?.session?.required_sigils)) {
    throw new Error("Initial realtime state omitted required_sigils");
  }

  await stopProcess(godot);
  godot = null;
  await mcp.waitForStateAvailability(false, 8000);

  godot = startGodot();
  await waitForPort(port);
  const reconnectedState = await mcp.waitForStateAvailability(true, 12000);
  if (reconnectedState.state?.session?.required_sigils !== firstState.state.session.required_sigils) {
    throw new Error("Objective requirement did not survive MCP reconnect");
  }
  process.stdout.write("MCP reconnect smoke test passed: subscribed state clears and resumes after Godot restart\n");
} finally {
  if (mcp) mcp.close();
  if (godot) await stopProcess(godot);
}


function startGodot() {
  return spawn(godotBin, ["--headless", "--path", projectRoot], {
    cwd: projectRoot,
    env: environment,
    stdio: ["ignore", "ignore", "ignore"],
    windowsHide: true,
  });
}


function createMcpClient(env) {
  const child = spawn(process.execPath, [serverPath], {
    cwd: projectRoot,
    env,
    stdio: ["pipe", "pipe", "inherit"],
    windowsHide: true,
  });
  const lines = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  const pending = new Map();
  const notifications = [];
  let nextId = 1;
  lines.on("line", (line) => {
    const message = JSON.parse(line);
    if (Object.prototype.hasOwnProperty.call(message, "id")) {
      const waiter = pending.get(message.id);
      if (waiter) {
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result);
      }
    } else {
      notifications.push(message);
    }
  });
  return {
    rpc(method, params) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for ${method}`));
        }, 12000);
        pending.set(id, {
          resolve: (value) => { clearTimeout(timer); resolve(value); },
          reject: (error) => { clearTimeout(timer); reject(error); },
        });
		child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    },
    notify(method, params) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    },
    async waitForStateAvailability(expected, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
	  for (let index = notifications.length - 1; index >= 0; index -= 1) {
		if (notifications[index].method === "notifications/resources/updated"
		  && notifications[index].params?.uri === "godot://where-i-am/runtime/state") {
		  notifications.splice(index, 1);
		}
	  }
	  let sawNotification = false;
      while (Date.now() < deadline) {
        const notificationIndex = notifications.findIndex((item) =>
          item.method === "notifications/resources/updated"
          && item.params?.uri === "godot://where-i-am/runtime/state");
		if (notificationIndex >= 0) {
		  notifications.splice(notificationIndex, 1);
		  sawNotification = true;
		}
        const resource = await this.rpc("resources/read", { uri: "godot://where-i-am/runtime/state" });
        const payload = JSON.parse(resource.contents[0].text);
		if (payload.available === expected && sawNotification) return payload;
        await delay(100);
      }
      throw new Error(`Runtime state resource did not become available=${expected}`);
    },
    close() {
      child.stdin.end();
      lines.close();
      child.kill();
    },
  };
}


function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}


async function waitForPort(port) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await canConnect(port)) return;
    await delay(100);
  }
  throw new Error(`Godot did not listen on port ${port}`);
}


function canConnect(port) {
  return new Promise((resolve) => {
    const socket = connectTcp({ host: "127.0.0.1", port });
    socket.setTimeout(150);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
}


function stopProcess(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); }, 1500);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.kill();
  });
}


function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
