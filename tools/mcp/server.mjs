#!/usr/bin/env node

/**
 * MCP 2025-11-25 stdio adapter for the authenticated local Godot WebSocket bridge.
 * Zero third-party dependencies; requires a Node build with global WebSocket.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import path from "node:path";
import readline from "node:readline";
import process from "node:process";

const MCP_PROTOCOL_VERSION = "2025-11-25";
const SERVER_VERSION = "1.1.0";
const WS_URL = process.env.GODOT_WS_URL || "ws://127.0.0.1:9080";
const REQUEST_TIMEOUT_MS = positiveInteger(process.env.GODOT_REQUEST_TIMEOUT_MS, 5000);
const CONNECT_TIMEOUT_MS = positiveInteger(process.env.GODOT_CONNECT_TIMEOUT_MS, 2500);
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXPECTED_WORKSPACE_ID = process.env.GODOT_WORKSPACE_ID
  || createHash("sha256").update(PROJECT_ROOT.replaceAll("\\", "/").replace(/\/+$/, "").toLowerCase()).digest("hex");
const TOKEN_PATH = process.env.GODOT_MCP_TOKEN_PATH
  || process.env.GODOT_BRIDGE_TOKEN_PATH
  || path.join(PROJECT_ROOT, ".godot", "mcp_bridge_token");
const STATE_RESOURCE_URI = "godot://where-i-am/runtime/state";
const EVENTS_RESOURCE_URI = "godot://where-i-am/runtime/events";

const TOOLS = [
  {
    name: "status",
    title: "Godot bridge status",
    description: "Check whether the local Godot game is running and inspect live-sync bridge status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  {
    name: "get_state",
    title: "Get runtime state",
    description: "Read the running scene and current player state from Godot.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "set_player_tuning",
    title: "Set player tuning",
    description: "Merge values into a gameplay_tuning.json section and apply them to the running player.",
    inputSchema: {
      type: "object",
      properties: {
        section: { type: "string", enum: ["player", "combat"], default: "player" },
        values: { type: "object", description: "Fields to merge into the selected section." },
      },
      required: ["values"],
      additionalProperties: false,
    },
    annotations: { destructiveHint: true, idempotentHint: true },
  },
  {
    name: "trigger_action",
    title: "Trigger a player action",
    description: "Press or release a Godot input action and notify player remote-action handlers.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "Godot InputMap action, for example attack, skill (Soul Echo), dash, soul_relay_1, move_up, or a non-visual compatibility alias." },
        pressed: { type: "boolean", default: true },
        strength: { type: "number", minimum: 0, maximum: 1, default: 1 },
        duration: { type: "number", minimum: 0, maximum: 10, default: 0, description: "Auto-release delay in seconds." },
      },
      required: ["action"],
      additionalProperties: false,
    },
    annotations: { destructiveHint: true },
  },
  {
    name: "get_level",
    title: "Get level JSON",
    description: "Read the in-memory crypt_entrance level document currently watched by Godot.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "set_tile",
    title: "Set a level tile",
    description: "Upsert one cell by x/y; source -1 erases it. Set persist=false to change only the running TileMap until save_runtime_map.",
    inputSchema: {
      type: "object",
      properties: {
        layer: { type: "string", enum: ["Backdrop", "Geometry", "Decor"], default: "Geometry" },
        x: { type: "integer" },
        y: { type: "integer" },
        source: { type: "integer", default: -1, description: "TileSet source id; -1 erases the cell." },
        atlas: {
          type: "array",
          items: { type: "integer" },
          minItems: 2,
          maxItems: 2,
          default: [-1, -1],
        },
        alternative: { type: "integer", minimum: 0, default: 0 },
        persist: { type: "boolean", default: true, description: "Write level JSON immediately; false applies runtime only." },
      },
      required: ["x", "y", "source"],
      additionalProperties: false,
    },
    annotations: { destructiveHint: true, idempotentHint: true },
  },
  {
    name: "reload",
    title: "Reload watched data",
    description: "Reload tuning, level, or both from disk and apply them to the running game.",
    inputSchema: {
      type: "object",
      properties: { target: { type: "string", enum: ["all", "tuning", "level"], default: "all" } },
      additionalProperties: false,
    },
    annotations: { destructiveHint: false, idempotentHint: true },
  },
  {
    name: "save_runtime_map",
    title: "Save a runtime map layer",
    description: "Serialize a running Backdrop, Geometry, or Decor TileMapLayer back into the matching level JSON layer.",
    inputSchema: {
      type: "object",
      properties: {
        layer: { type: "string", enum: ["Backdrop", "Geometry", "Decor"], default: "Geometry" },
      },
      additionalProperties: false,
    },
    annotations: { destructiveHint: true },
  },
];

const TOOL_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));
const RESOURCES = [
  {
    uri: STATE_RESOURCE_URI,
    name: "runtime-state",
    title: "Godot runtime state",
    description: "Latest cached scene, session, and player state streamed by the running Godot project.",
    mimeType: "application/json",
    annotations: { audience: ["assistant"], priority: 1.0 },
  },
  {
    uri: EVENTS_RESOURCE_URI,
    name: "runtime-events",
    title: "Godot runtime events",
    description: "The 50 most recent gameplay and live-sync events streamed by Godot.",
    mimeType: "application/json",
    annotations: { audience: ["assistant"], priority: 0.9 },
  },
];
const RESOURCE_URIS = new Set(RESOURCES.map((resource) => resource.uri));

const EMPTY_PARAMS_SCHEMA = {
  type: "object",
  properties: { _meta: { type: "object" } },
  additionalProperties: false,
};
const LIST_PARAMS_SCHEMA = {
  type: "object",
  properties: { cursor: { type: "string" }, _meta: { type: "object" } },
  additionalProperties: false,
};
const RESOURCE_PARAMS_SCHEMA = {
  type: "object",
  properties: { uri: { type: "string" }, _meta: { type: "object" } },
  required: ["uri"],
  additionalProperties: false,
};
const INITIALIZE_PARAMS_SCHEMA = {
  type: "object",
  properties: {
    protocolVersion: { type: "string" },
    capabilities: { type: "object" },
    clientInfo: {
      type: "object",
      properties: { name: { type: "string" }, version: { type: "string" } },
      required: ["name", "version"],
    },
    _meta: { type: "object" },
  },
  required: ["protocolVersion", "capabilities", "clientInfo"],
};
const TOOL_CALL_PARAMS_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    arguments: { type: "object" },
    task: { type: "object" },
    _meta: { type: "object" },
  },
  required: ["name"],
  additionalProperties: false,
};


class RpcFault extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}


class GodotBridgeClient {
  constructor(url, onCacheUpdated) {
    this.url = url;
    this.onCacheUpdated = onCacheUpdated;
    this.socket = null;
    this.activeConnection = null;
    this.connectPromise = null;
    this.generation = 0;
    this.pending = new Map();
    this.nextId = 1;
    this.lastState = null;
    this.lastStateReceivedAt = null;
    this.lastHello = null;
    this.recentEvents = [];
    this.lastError = null;
    this.onDisconnected = null;
  }

  isOpen() {
    return this.activeConnection?.authenticated === true
      && this.activeConnection.socket.readyState === 1;
  }

  async connect() {
    if (this.isOpen()) return;
    if (this.connectPromise) return this.connectPromise;
    if (typeof globalThis.WebSocket !== "function") {
      throw new Error("This Node runtime has no built-in WebSocket. Use a current Node release (22+ recommended).");
    }

    const connection = {
      generation: ++this.generation,
      socket: new globalThis.WebSocket(this.url),
      authenticated: false,
      authStarted: false,
      authId: null,
      settled: false,
      timer: null,
      resolve: null,
      reject: null,
    };
    this.activeConnection = connection;
    this.socket = connection.socket;

    const promise = new Promise((resolve, reject) => {
      connection.resolve = resolve;
      connection.reject = reject;
      connection.timer = setTimeout(() => {
        this.failConnection(connection, new Error(`Timed out connecting/authenticating at ${this.url}`));
      }, CONNECT_TIMEOUT_MS);

      connection.socket.addEventListener("open", () => {
        if (!this.isCurrent(connection)) return;
        this.lastError = null;
      });
      connection.socket.addEventListener("message", (event) => {
        void this.onMessage(event.data, connection);
      });
      connection.socket.addEventListener("error", () => {
        const error = new Error(`WebSocket error at ${this.url}`);
        this.lastError = error.message;
        if (!connection.settled) this.failConnection(connection, error);
      });
      connection.socket.addEventListener("close", () => {
		const wasCurrent = this.activeConnection === connection;
        if (!connection.settled) {
          this.failConnection(connection, new Error(`Godot bridge closed before authentication at ${this.url}`), false);
        }
        if (wasCurrent) {
          this.activeConnection = null;
          this.socket = null;
		  this.lastState = null;
		  this.lastStateReceivedAt = null;
		  this.recentEvents = [];
		  this.onCacheUpdated?.(STATE_RESOURCE_URI);
		  this.onCacheUpdated?.(EVENTS_RESOURCE_URI);
        }
        const error = new Error("Godot bridge disconnected");
        for (const [id, entry] of this.pending) {
          if (entry.generation !== connection.generation) continue;
          clearTimeout(entry.timer);
          entry.reject(error);
          this.pending.delete(id);
        }
		if (wasCurrent) this.onDisconnected?.();
      });
    });
    this.connectPromise = promise;
    try {
      await promise;
    } finally {
      if (this.connectPromise === promise) this.connectPromise = null;
    }
  }

  isCurrent(connection) {
    return this.activeConnection === connection
      && connection.generation === this.generation;
  }

  completeConnection(connection) {
    if (!this.isCurrent(connection) || connection.settled) return;
    connection.authenticated = true;
    connection.settled = true;
    clearTimeout(connection.timer);
    this.lastError = null;
    connection.resolve();
  }

  failConnection(connection, error, closeSocket = true) {
    if (connection.settled) return;
    connection.settled = true;
    clearTimeout(connection.timer);
    this.lastError = error.message;
    if (closeSocket) {
      try { connection.socket.close(1008, "Authentication failed"); } catch {}
    }
    connection.reject(error);
  }

  async onMessage(data, connection) {
    if (!this.isCurrent(connection)) return;
    try {
      const text = await messageText(data);
      if (!this.isCurrent(connection)) return;
      const message = JSON.parse(text);
      if (!message || typeof message !== "object" || Array.isArray(message)) return;
      if (message.type === "hello") {
        this.lastHello = message;
        await this.authenticate(connection, message);
        return;
      }
      if (message.type === "auth_result") {
        if (!connection.authStarted || message.id !== connection.authId) return;
        if (message.ok === true) this.completeConnection(connection);
        else this.failConnection(connection, new Error(`Godot authentication failed: ${String(message.error || "rejected")}`));
        return;
      }
      if (!connection.authenticated) return;
      if (message.type === "state") {
        this.lastState = message.state ?? null;
        this.lastStateReceivedAt = new Date().toISOString();
        this.onCacheUpdated?.(STATE_RESOURCE_URI);
        return;
      }
      if (message.type === "event") {
        this.recentEvents.push(message);
        if (this.recentEvents.length > 50) this.recentEvents.shift();
        this.onCacheUpdated?.(EVENTS_RESOURCE_URI);
        return;
      }
      if (message.type !== "response") return;
      const id = String(message.id ?? "");
      const entry = this.pending.get(id);
      if (!entry || entry.generation !== connection.generation) return;
      this.pending.delete(id);
      clearTimeout(entry.timer);
      if (message.ok) entry.resolve(message.result);
      else entry.reject(new Error(String(message.error || "Godot command failed")));
    } catch (error) {
      this.lastError = `Invalid bridge message: ${error.message}`;
      if (!connection.authenticated) this.failConnection(connection, new Error(this.lastError));
    }
  }

  async authenticate(connection, hello) {
    if (!this.isCurrent(connection) || connection.authStarted || connection.settled) return;
    const authentication = hello.authentication;
	if (!authentication?.required) {
		this.failConnection(connection, new Error("Godot bridge did not require workspace-token authentication"));
		return;
	}
    if (authentication.method !== "workspace_token") {
      this.failConnection(connection, new Error(`Unsupported Godot authentication method: ${String(authentication.method)}`));
      return;
    }
	if (hello.workspace_id !== EXPECTED_WORKSPACE_ID) {
		this.failConnection(connection, new Error(`Godot workspace identity mismatch: expected ${EXPECTED_WORKSPACE_ID}`));
		return;
	}
    connection.authStarted = true;
    try {
      const token = await readWorkspaceToken();
      if (!this.isCurrent(connection) || connection.settled) return;
      connection.authId = `auth-${process.pid}-${connection.generation}`;
      connection.socket.send(JSON.stringify({
        type: "auth",
        id: connection.authId,
        token,
        workspace_id: hello.workspace_id,
      }));
    } catch (error) {
      this.failConnection(connection, error);
    }
  }

  async request(command, params = {}) {
    await this.connect();
    const connection = this.activeConnection;
    if (!connection?.authenticated || connection.socket.readyState !== 1) {
      throw new Error("Godot bridge is not authenticated");
    }
    const id = `mcp-${process.pid}-${this.nextId++}`;
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Godot command '${command}' timed out after ${REQUEST_TIMEOUT_MS} ms`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer, generation: connection.generation });
    });
    try {
      connection.socket.send(JSON.stringify({ type: "request", id, command, params }));
    } catch (error) {
      const entry = this.pending.get(id);
      if (entry) clearTimeout(entry.timer);
      this.pending.delete(id);
      throw error;
    }
    return response;
  }

  localStatus() {
    return {
      connected: this.isOpen(),
      authenticated: this.activeConnection?.authenticated === true,
      endpoint: this.url,
      workspace_id: this.lastHello?.workspace_id ?? null,
      last_error: this.lastError,
      has_live_state: this.lastState !== null,
      recent_event_count: this.recentEvents.length,
    };
  }

  stateResource() {
    return {
      available: this.lastState !== null,
      received_at: this.lastStateReceivedAt,
      state: this.lastState,
    };
  }

  eventsResource() {
    return {
      count: this.recentEvents.length,
      events: this.recentEvents,
    };
  }
}


let lifecycle = "before_initialize";
const subscriptions = new Set();
const bridge = new GodotBridgeClient(WS_URL, notifyResourceUpdated);
let reconnectTimer = null;
bridge.onDisconnected = scheduleBridgeReconnect;
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
let inputClosed = false;
let inFlightRequests = 0;
let inputQueue = Promise.resolve();

lines.on("line", (line) => {
  if (!line.trim()) return;
  inFlightRequests += 1;
  inputQueue = inputQueue
    .then(() => handleLine(line))
    .catch((error) => process.stderr.write(`[where-i-am-mcp] ${error.stack || error.message}\n`))
    .finally(() => {
      inFlightRequests -= 1;
      maybeShutdown();
    });
});

lines.on("close", () => {
  inputClosed = true;
  maybeShutdown();
});

process.on("uncaughtException", (error) => {
  process.stderr.write(`[where-i-am-mcp] ${error.stack || error.message}\n`);
});

process.on("unhandledRejection", (error) => {
  process.stderr.write(`[where-i-am-mcp] ${error?.stack || String(error)}\n`);
});


async function handleLine(line) {
  let request;
  try {
    request = JSON.parse(line.replace(/^\uFEFF/, ""));
  } catch (error) {
    writeJson(rpcError(null, -32700, `Parse error: ${error.message}`));
    return;
  }
  if (Array.isArray(request)) {
    if (request.length === 0) {
      writeJson(rpcError(null, -32600, "Invalid JSON-RPC request: empty batch"));
      return;
    }
    const responses = [];
    for (const entry of request) {
      const response = await handleRequest(entry);
      if (response) responses.push(response);
    }
    if (responses.length) writeJson(responses);
    return;
  }
  const response = await handleRequest(request);
  if (response) writeJson(response);
}


async function handleRequest(request) {
  const candidateId = isValidRequestId(request?.id) ? request.id : null;
  if (!isRecord(request) || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return rpcError(candidateId, -32600, "Invalid JSON-RPC request");
  }
  const hasId = Object.prototype.hasOwnProperty.call(request, "id");
  if (hasId && !isValidRequestId(request.id)) {
    return rpcError(null, -32600, "Invalid JSON-RPC request id: expected a string or integer, not null");
  }
  if (request.params !== undefined && !isRecord(request.params)) {
    return hasId ? rpcError(request.id, -32602, "Invalid params: expected an object") : null;
  }
  const isNotification = !hasId;

  try {
    if (request.method === "ping") {
      validateSchema(request.params ?? {}, EMPTY_PARAMS_SCHEMA, "params");
      return isNotification ? null : { jsonrpc: "2.0", id: request.id, result: {} };
    }

    if (request.method === "initialize") {
      if (isNotification) return null;
      if (lifecycle !== "before_initialize") throw new RpcFault(-32600, "Server is already initialized");
      validateSchema(request.params, INITIALIZE_PARAMS_SCHEMA, "params");
      lifecycle = "awaiting_initialized";
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: true, listChanged: false },
          },
          serverInfo: { name: "where-i-am-godot", title: "Where I Am Godot Live Sync", version: SERVER_VERSION },
          instructions: `Start this Godot project before calling live tools. The authenticated local bridge is ${WS_URL}. Subscribe to ${STATE_RESOURCE_URI} or ${EVENTS_RESOURCE_URI} for game-to-MCP updates.`,
        },
      };
    }

    if (request.method === "notifications/initialized") {
      if (!isNotification) throw new RpcFault(-32600, "notifications/initialized must not contain an id");
      validateSchema(request.params ?? {}, EMPTY_PARAMS_SCHEMA, "params");
      if (lifecycle === "awaiting_initialized") lifecycle = "ready";
      return null;
    }

    if (lifecycle !== "ready") {
      if (isNotification) return null;
      throw new RpcFault(-32002, "Server is not initialized; complete initialize and notifications/initialized first");
    }

    // MCP operations are requests. Silently discard malformed notifications so
    // a missing JSON-RPC id can never trigger a mutating tool.
    if (isNotification && request.method !== "notifications/cancelled") return null;

    let result;
    switch (request.method) {
      case "notifications/cancelled":
        if (!isNotification) throw new RpcFault(-32600, "notifications/cancelled must not contain an id");
        return null;
      case "tools/list":
        validateSchema(request.params ?? {}, LIST_PARAMS_SCHEMA, "params");
        rejectCursor(request.params?.cursor);
        result = { tools: TOOLS };
        break;
      case "tools/call":
        result = await callTool(request.params);
        break;
      case "resources/list":
        validateSchema(request.params ?? {}, LIST_PARAMS_SCHEMA, "params");
        rejectCursor(request.params?.cursor);
        result = { resources: RESOURCES };
        break;
      case "resources/read":
        validateSchema(request.params, RESOURCE_PARAMS_SCHEMA, "params");
        result = readResource(request.params.uri);
        break;
      case "resources/subscribe":
        validateSchema(request.params, RESOURCE_PARAMS_SCHEMA, "params");
        requireResource(request.params.uri);
        try {
          // A subscription is also the explicit request to begin the live feed.
          // Authenticate now so clients do not need a separate status tool call.
          await bridge.connect();
        } catch (error) {
          throw new RpcFault(-32603, `Cannot subscribe to the Godot bridge: ${error.message}`);
        }
        // Add only after authentication; the next 150 ms state tick will notify.
        subscriptions.add(request.params.uri);
        result = {};
        break;
      case "resources/unsubscribe":
        validateSchema(request.params, RESOURCE_PARAMS_SCHEMA, "params");
        requireResource(request.params.uri);
        subscriptions.delete(request.params.uri);
		if (subscriptions.size === 0 && reconnectTimer !== null) {
		  clearTimeout(reconnectTimer);
		  reconnectTimer = null;
		}
        result = {};
        break;
      default:
        if (isNotification) return null;
        throw new RpcFault(-32601, `Method not found: ${request.method}`);
    }
    return isNotification ? null : { jsonrpc: "2.0", id: request.id, result };
  } catch (error) {
    if (isNotification) return null;
    const code = error instanceof RpcFault ? error.code : -32603;
    return rpcError(request.id, code, error.message || String(error), error.data);
  }
}


async function callTool(params) {
  validateSchema(params, TOOL_CALL_PARAMS_SCHEMA, "params");
  const tool = TOOL_BY_NAME.get(params.name);
  if (!tool) throw new RpcFault(-32602, `Unknown tool: ${params.name}`);
  const args = params.arguments ?? {};
  validateSchema(args, tool.inputSchema, `arguments for ${tool.name}`);

  try {
    let result;
    if (tool.name === "status") {
      try {
        const godotStatus = await bridge.request("status", {});
        result = { ...bridge.localStatus(), connected: true, godot: godotStatus };
      } catch (error) {
        result = { ...bridge.localStatus(), connected: false, error: error.message };
      }
    } else {
      result = await bridge.request(tool.name, args);
    }
    return toolResult(result);
  } catch (error) {
    return toolError(error.message || String(error));
  }
}


function readResource(uri) {
  requireResource(uri);
  const value = uri === STATE_RESOURCE_URI ? bridge.stateResource() : bridge.eventsResource();
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: JSON.stringify(value, null, 2),
    }],
  };
}


function requireResource(uri) {
  if (!RESOURCE_URIS.has(uri)) throw new RpcFault(-32602, `Unknown resource URI: ${String(uri)}`);
}


function rejectCursor(cursor) {
  if (cursor !== undefined) throw new RpcFault(-32602, `Invalid cursor: ${cursor}`);
}


function notifyResourceUpdated(uri) {
  if (lifecycle !== "ready" || !subscriptions.has(uri)) return;
  writeJson({ jsonrpc: "2.0", method: "notifications/resources/updated", params: { uri } });
}


function scheduleBridgeReconnect() {
  if (lifecycle !== "ready" || subscriptions.size === 0 || reconnectTimer !== null || inputClosed) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (subscriptions.size === 0 || inputClosed) return;
    try {
      await bridge.connect();
    } catch {
      scheduleBridgeReconnect();
    }
  }, 750);
}


function toolResult(value) {
  const safeValue = value === undefined ? null : value;
  const result = {
    content: [{ type: "text", text: JSON.stringify(safeValue, null, 2) }],
    isError: false,
  };
  if (safeValue && typeof safeValue === "object" && !Array.isArray(safeValue)) {
    result.structuredContent = safeValue;
  }
  return result;
}


function toolError(message) {
  return {
    content: [{ type: "text", text: String(message) }],
    isError: true,
  };
}


function validateSchema(value, schema, pathLabel) {
  const error = schemaError(value, schema, pathLabel);
  if (error) throw new RpcFault(-32602, `Invalid params: ${error}`);
}


function schemaError(value, schema, pathLabel) {
  if (schema.enum && !schema.enum.some((entry) => Object.is(entry, value))) {
    return `${pathLabel} must be one of ${schema.enum.map((entry) => JSON.stringify(entry)).join(", ")}`;
  }
  switch (schema.type) {
    case "object": {
      if (!isRecord(value)) return `${pathLabel} must be an object`;
      for (const required of schema.required ?? []) {
        if (!Object.prototype.hasOwnProperty.call(value, required)) return `${pathLabel}.${required} is required`;
      }
      const properties = schema.properties ?? {};
      for (const [key, child] of Object.entries(value)) {
        if (properties[key]) {
          const childError = schemaError(child, properties[key], `${pathLabel}.${key}`);
          if (childError) return childError;
        } else if (schema.additionalProperties === false) {
          return `${pathLabel}.${key} is not allowed`;
        }
      }
      return null;
    }
    case "array": {
      if (!Array.isArray(value)) return `${pathLabel} must be an array`;
      if (schema.minItems !== undefined && value.length < schema.minItems) return `${pathLabel} must contain at least ${schema.minItems} items`;
      if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${pathLabel} must contain at most ${schema.maxItems} items`;
      if (schema.items) {
        for (let index = 0; index < value.length; index += 1) {
          const childError = schemaError(value[index], schema.items, `${pathLabel}[${index}]`);
          if (childError) return childError;
        }
      }
      return null;
    }
    case "string":
      return typeof value === "string" ? null : `${pathLabel} must be a string`;
    case "boolean":
      return typeof value === "boolean" ? null : `${pathLabel} must be a boolean`;
    case "integer":
      if (!Number.isInteger(value)) return `${pathLabel} must be an integer`;
      break;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) return `${pathLabel} must be a finite number`;
      break;
    default:
      return null;
  }
  if (schema.minimum !== undefined && value < schema.minimum) return `${pathLabel} must be >= ${schema.minimum}`;
  if (schema.maximum !== undefined && value > schema.maximum) return `${pathLabel} must be <= ${schema.maximum}`;
  return null;
}


function rpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}


function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}


async function messageText(data) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
  if (data && typeof data.text === "function") return data.text();
  return String(data);
}


async function readWorkspaceToken() {
  const environmentToken = (process.env.GODOT_MCP_TOKEN || process.env.GODOT_BRIDGE_TOKEN || "").trim();
  if (environmentToken) return environmentToken;
  try {
    const token = (await readFile(TOKEN_PATH, "utf8")).trim();
    if (!token) throw new Error(`Godot MCP token file is empty: ${TOKEN_PATH}`);
    return token;
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Godot MCP token was not found. Start the project once or set GODOT_MCP_TOKEN (expected ${TOKEN_PATH}).`);
    }
    throw error;
  }
}


function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}


function isValidRequestId(value) {
  return typeof value === "string" || (typeof value === "number" && Number.isInteger(value) && Number.isFinite(value));
}


function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}


function maybeShutdown() {
  if (!inputClosed || inFlightRequests !== 0) return;
  try { bridge.socket?.close(1000, "MCP stdio closed"); } catch {}
  setTimeout(() => process.exit(0), 150);
}
