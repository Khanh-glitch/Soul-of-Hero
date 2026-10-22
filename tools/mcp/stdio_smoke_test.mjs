#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline";
import process from "node:process";

const directory = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(directory, "server.mjs");
const projectRoot = path.resolve(directory, "..", "..");
const stateUri = "godot://where-i-am/runtime/state";
const eventsUri = "godot://where-i-am/runtime/events";
const child = spawn(process.execPath, [server], {
  cwd: projectRoot,
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
  windowsHide: true,
});

const output = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
const pending = new Map();
const notificationBacklog = [];
const notificationWaiters = [];
let nextId = 1;
let childExited = false;

output.on("line", (line) => {
  try {
    const message = JSON.parse(line);
    if (Object.prototype.hasOwnProperty.call(message, "id")) {
      const waiter = pending.get(idKey(message.id));
      if (waiter) {
        pending.delete(idKey(message.id));
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      }
      return;
    }
    if (typeof message.method === "string") dispatchNotification(message);
  } catch (error) {
    failPending(new Error(`Invalid NDJSON response: ${error.message}`));
  }
});

child.on("error", failPending);
child.on("exit", (code) => {
  childExited = true;
  if (pending.size > 0) failPending(new Error(`MCP child exited early with code ${code}`));
});

try {
  const beforeInit = await rawRpc("tools/list", {});
  assert(beforeInit.error?.code === -32002, "tools/list was accepted before initialization");

  const initialized = await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "stdio-smoke", version: "1" },
  });
  assert(initialized.protocolVersion === "2025-11-25", "initialize protocol mismatch");
  assert(initialized.capabilities?.resources?.subscribe === true, "resource subscriptions were not declared");
  assert(initialized.instructions?.includes(process.env.GODOT_WS_URL || "ws://127.0.0.1:9080"), "initialize instructions do not contain the configured bridge URL");

  notify("notifications/initialized");

  const listedTools = await rpc("tools/list", {});
  assert(listedTools.tools?.length === 8, "tools/list did not return 8 tools");
  const tuningTool = listedTools.tools.find((tool) => tool.name === "set_player_tuning");
  assert(tuningTool?.annotations?.destructiveHint === true, "set_player_tuning is not marked destructive");

  const listedResources = await rpc("resources/list", {});
  const uris = new Set(listedResources.resources?.map((resource) => resource.uri));
  assert(uris.has(stateUri) && uris.has(eventsUri), "runtime state/event resources were not listed");

  await rpc("resources/subscribe", { uri: stateUri });
  const stateUpdated = waitForNotification(
    (message) => message.method === "notifications/resources/updated" && message.params?.uri === stateUri,
    6000,
  );

  const status = await callTool("status", {});
  assert(status.connected === true, "status did not connect to Godot");
  assert(status.authenticated === true, "MCP adapter did not authenticate to Godot");

  await stateUpdated;
  const stateResource = await rpc("resources/read", { uri: stateUri });
  const cachedState = JSON.parse(stateResource.contents?.[0]?.text || "null");
  assert(cachedState?.available === true, "subscribed runtime state was not cached");
  assert(Array.isArray(cachedState?.state?.players), "cached runtime resource has no player state array");
  assert(Number.isInteger(cachedState?.state?.session?.required_sigils), "cached runtime resource omitted required_sigils");

  await rpc("resources/subscribe", { uri: eventsUri });
  const eventUpdated = waitForNotification(
    (message) => message.method === "notifications/resources/updated" && message.params?.uri === eventsUri,
    6000,
  );
  const action = await callTool("trigger_action", { action: "jump", pressed: true, duration: 0.05 });
  assert(Number(action.receivers) >= 1, "trigger_action had no live player receiver");
  await eventUpdated;
  const eventsResource = await rpc("resources/read", { uri: eventsUri });
  const cachedEvents = JSON.parse(eventsResource.contents?.[0]?.text || "null");
  assert(cachedEvents?.events?.some((event) => event.event === "remote_action"), "runtime event resource did not cache remote_action");

  const state = await callTool("get_state", {});
  assert(Array.isArray(state.players), "get_state tool did not return live player state");
  assert(state.session?.required_sigils === cachedState.state.session.required_sigils, "get_state and subscribed objective requirements differ");

  const badArguments = await rawRpc("tools/call", { name: "get_state", arguments: { unexpected: true } });
  assert(badArguments.error?.code === -32602, "tool inputSchema violation did not return -32602");
  const unknownTool = await rawRpc("tools/call", { name: "does_not_exist", arguments: {} });
  assert(unknownTool.error?.code === -32602, "unknown tool did not return -32602");
  const nullId = await rawRequest({ jsonrpc: "2.0", id: null, method: "ping", params: {} }, null);
  assert(nullId.error?.code === -32600, "null JSON-RPC id was not rejected");

  process.stdout.write("MCP stdio smoke test passed: lifecycle + auth + schema errors + subscribed realtime state/events\n");
} catch (error) {
  process.stderr.write(`MCP stdio smoke test failed: ${error.message}\n`);
  process.exitCode = 1;
} finally {
  for (const waiter of notificationWaiters) clearTimeout(waiter.timer);
  child.stdin.end();
  output.close();
  if (!childExited) {
    const killTimer = setTimeout(() => child.kill(), 1000);
    killTimer.unref();
  }
}


function rpc(method, params) {
  return rawRpc(method, params).then((message) => {
    if (message.error) throw new Error(`${method}: ${message.error.message}`);
    return message.result;
  });
}


function rawRpc(method, params) {
  const id = nextId++;
  return rawRequest({ jsonrpc: "2.0", id, method, params }, id);
}


function rawRequest(request, responseId) {
  const key = idKey(responseId);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(key);
      reject(new Error(`Timed out waiting for ${request.method}`));
    }, 12000);
    pending.set(key, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify(request)}\n`);
  });
}


function notify(method, params) {
  const message = { jsonrpc: "2.0", method };
  if (params !== undefined) message.params = params;
  child.stdin.write(`${JSON.stringify(message)}\n`);
}


async function callTool(name, args) {
  const result = await rpc("tools/call", { name, arguments: args });
  if (result.isError) throw new Error(result.content?.[0]?.text || `${name} failed`);
  return result.structuredContent ?? JSON.parse(result.content?.[0]?.text || "null");
}


function waitForNotification(predicate, timeoutMs) {
  const index = notificationBacklog.findIndex(predicate);
  if (index >= 0) return Promise.resolve(notificationBacklog.splice(index, 1)[0]);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve, reject, timer: null };
    waiter.timer = setTimeout(() => {
      const waiterIndex = notificationWaiters.indexOf(waiter);
      if (waiterIndex >= 0) notificationWaiters.splice(waiterIndex, 1);
      reject(new Error("Timed out waiting for notifications/resources/updated"));
    }, timeoutMs);
    notificationWaiters.push(waiter);
  });
}


function dispatchNotification(message) {
  const index = notificationWaiters.findIndex((waiter) => waiter.predicate(message));
  if (index < 0) {
    notificationBacklog.push(message);
    if (notificationBacklog.length > 100) notificationBacklog.shift();
    return;
  }
  const [waiter] = notificationWaiters.splice(index, 1);
  clearTimeout(waiter.timer);
  waiter.resolve(message);
}


function failPending(error) {
  for (const waiter of pending.values()) {
    clearTimeout(waiter.timer);
    waiter.reject(error);
  }
  pending.clear();
  for (const waiter of notificationWaiters.splice(0)) {
    clearTimeout(waiter.timer);
    waiter.reject(error);
  }
}


function idKey(id) {
  return `${typeof id}:${String(id)}`;
}


function assert(condition, message) {
  if (!condition) throw new Error(message);
}
