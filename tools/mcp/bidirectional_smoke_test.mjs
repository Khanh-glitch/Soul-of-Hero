#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline";
import process from "node:process";

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directory, "..", "..");
const serverPath = path.join(directory, "server.mjs");
const tuningPath = path.join(projectRoot, "config", "gameplay_tuning.json");
const levelPath = path.join(projectRoot, "data", "levels", "crypt_entrance.json");
const tuningOriginalText = await readFile(tuningPath, "utf8");
const levelOriginalText = await readFile(levelPath, "utf8");
const originalTuning = JSON.parse(tuningOriginalText);
const originalLevel = JSON.parse(levelOriginalText);

const child = spawn(process.execPath, [serverPath], {
  cwd: projectRoot,
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
  windowsHide: true,
});
const output = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
const pending = new Map();
let nextId = 1;

output.on("line", (line) => {
  try {
    const message = JSON.parse(line);
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      waiter.resolve(message);
    }
  } catch (error) {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  }
});

try {
  await rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "bidirectional-smoke", version: "1" },
  });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

  const status = await callTool("status", {});
  assert(status.connected === true, "MCP adapter did not connect to Godot");
  assert(typeof status.godot?.workspace_id === "string" && status.godot.workspace_id.length === 64,
    "Godot bridge did not expose a valid workspace identity");
  assert(status.godot?.authenticated_peer_count >= 1, "MCP adapter was not authenticated by Godot");

  const originalSpeed = Number(originalTuning.player.move_speed);
	const tuningBeforeRejectedMutation = await readFile(tuningPath, "utf8");
	await expectToolError("set_player_tuning", { section: "player", values: { move_speed: -1 } });
	assert(await readFile(tuningPath, "utf8") === tuningBeforeRejectedMutation,
	  "invalid tuning mutation changed canonical JSON");
  const testSpeed = originalSpeed + 0.75;
  await callTool("set_player_tuning", { section: "player", values: { move_speed: testSpeed } });
  await delay(180);
  const tunedState = await callTool("get_state", {});
  const player = tunedState.players?.[0];
  assert(player?.movement_mode === "top_down", "runtime did not report top_down movement");
  assert(Math.abs(Number(player?.tuning?.move_speed) - testSpeed) < 0.001, "tuning did not reach the live Knight");

  const actionResult = await callTool("trigger_action", {
    action: "jump",
    pressed: true,
    duration: 0.08,
  });
  assert(Number(actionResult.receivers) >= 1, "remote action had no player receiver");

  const levelBeforeRejectedMutation = await readFile(levelPath, "utf8");
  await expectToolError("set_tile", {
    layer: "Geometry", x: 100, y: 2, source: 0, atlas: [1, 5], alternative: 0,
  });
  assert(await readFile(levelPath, "utf8") === levelBeforeRejectedMutation,
    "out-of-bounds tile mutation changed canonical JSON");
  await expectToolError("set_tile", {
    layer: "Geometry", x: 2, y: 2, source: 0, atlas: [999, 999], alternative: 0,
  });
  assert(await readFile(levelPath, "utf8") === levelBeforeRejectedMutation,
    "invalid atlas tile mutation changed canonical JSON");
  await expectToolError("set_tile", {
    layer: "Decor", x: 2, y: 2, source: 2, atlas: [0, 0], alternative: 0,
  });
  assert(await readFile(levelPath, "utf8") === levelBeforeRejectedMutation,
    "unknown TileSet source mutation changed canonical JSON");

  const testCell = {
    layer: "Geometry", x: 2, y: 2, source: 1, atlas: [10, 0], alternative: 0, persist: false,
  };
  const diskBeforePreview = await readFile(levelPath, "utf8");
  const tileResult = await callTool("set_tile", testCell);
  assert(tileResult.runtime?.applied === true, "MCP tile change did not reach runtime Geometry");
  assert(tileResult.persisted === false, "runtime-only tile preview was unexpectedly persisted");
  assert(await readFile(levelPath, "utf8") === diskBeforePreview,
    "runtime-only tile preview changed canonical JSON");
  const changedLevel = await callTool("get_level", {});
  assert(!findCell(changedLevel, "Geometry", 2, 2), "runtime-only tile preview mutated the canonical level snapshot");

  const saved = await callTool("save_runtime_map", {});
  assert(saved.saved === true || saved.path, "runtime map was not saved back to JSON");
  const diskLevel = JSON.parse(await readFile(levelPath, "utf8"));
  assert(findCell(diskLevel, "Geometry", 2, 2)?.source === 1,
    "dedicated low-wall source did not sync from runtime to JSON");

  for (const layer of ["Backdrop", "Decor"]) {
    const originalCell = findCell(originalLevel, layer, 2, 2);
    const beforePreview = await readFile(levelPath, "utf8");
    const preview = await callTool("set_tile", {
      layer, x: 2, y: 2, source: 0, atlas: [1, 4], alternative: 0, persist: false,
    });
    assert(preview.runtime?.applied === true, `MCP tile change did not reach runtime ${layer}`);
    assert(await readFile(levelPath, "utf8") === beforePreview,
      `runtime-only ${layer} preview changed canonical JSON`);
    const savedLayer = await callTool("save_runtime_map", { layer });
    assert(savedLayer.layer === layer, `save_runtime_map did not report ${layer}`);
    const savedDocument = JSON.parse(await readFile(levelPath, "utf8"));
    assert(findCell(savedDocument, layer, 2, 2)?.source === 0,
      `${layer} did not sync from runtime to JSON`);
    await callTool("set_tile", originalCell
      ? { layer, ...structuredClone(originalCell) }
      : { layer, x: 2, y: 2, source: -1, atlas: [-1, -1], alternative: 0 });
  }

  await callTool("set_tile", { layer: "Geometry", x: 2, y: 2, source: -1, atlas: [-1, -1], alternative: 0 });
  await callTool("set_player_tuning", { section: "player", values: { move_speed: originalSpeed } });
  process.stdout.write("Bidirectional MCP smoke test passed: tuning ↔ runtime, action → player, all map layers ↔ runtime ↔ JSON\n");
} finally {
	let restoreFailure = null;
	try {
	  await restoreOwnedFile(tuningPath, tuningOriginalText, ownsTuningMutation);
	  await restoreOwnedFile(levelPath, levelOriginalText, ownsLevelMutation);
	} catch (error) {
	  restoreFailure = error;
	}
  child.stdin.end();
  output.close();
  child.kill();
	if (restoreFailure) throw restoreFailure;
}


function rpc(method, params) {
  const id = nextId++;
  const request = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 12000);
    pending.set(id, {
      resolve: (message) => {
        clearTimeout(timeout);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    child.stdin.write(`${JSON.stringify(request)}\n`);
  });
}


async function callTool(name, args) {
  const result = await rpc("tools/call", { name, arguments: args });
  if (result.isError) throw new Error(result.content?.[0]?.text || `${name} failed`);
  return result.structuredContent ?? JSON.parse(result.content?.[0]?.text || "null");
}


async function expectToolError(name, args) {
  try {
    await callTool(name, args);
  } catch {
    return;
  }
  throw new Error(`${name} unexpectedly accepted invalid input`);
}


function findCell(level, layer, x, y) {
  return level?.layers?.[layer]?.find((cell) => Number(cell.x) === x && Number(cell.y) === y);
}


function assert(condition, message) {
  if (!condition) throw new Error(message);
}


async function restoreOwnedFile(filePath, originalText, ownsMutation) {
  const lockPath = `${filePath}.write.lock`;
  try {
	await mkdir(lockPath);
  } catch (error) {
	throw new Error(`Refusing to restore ${path.basename(filePath)} while another writer owns its lock: ${error.message}`);
  }
  try {
	const currentText = await readFile(filePath, "utf8");
	if (currentText === originalText) return;
	if (!ownsMutation(currentText)) {
	  throw new Error(`Refusing to overwrite concurrent edits in ${filePath}; restore the test mutation manually.`);
	}
	await atomicReplace(filePath, originalText);
  } finally {
	await rm(lockPath, { recursive: true, force: true });
  }
}


function ownsTuningMutation(currentText) {
  try {
	const current = JSON.parse(currentText);
	current.player.move_speed = originalTuning.player.move_speed;
	return JSON.stringify(current) === JSON.stringify(originalTuning);
  } catch {
	return false;
  }
}


function ownsLevelMutation(currentText) {
  try {
	const current = JSON.parse(currentText);
	for (const layer of ["Backdrop", "Geometry", "Decor"]) {
	  const currentCells = current.layers[layer].filter((cell) => !(cell.x === 2 && cell.y === 2));
	  const originalCell = findCell(originalLevel, layer, 2, 2);
	  if (originalCell) currentCells.push(structuredClone(originalCell));
	  currentCells.sort((left, right) => left.y - right.y || left.x - right.x);
	  current.layers[layer] = currentCells;
	}
	return semanticLevelJson(current) === semanticLevelJson(originalLevel);
  } catch {
	return false;
  }
}


function semanticLevelJson(level) {
  const normalized = structuredClone(level);
  for (const layer of ["Backdrop", "Geometry", "Decor"]) {
    normalized.layers[layer].sort((left, right) => left.y - right.y || left.x - right.x);
  }
  return JSON.stringify(sortObjectKeys(normalized));
}


function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObjectKeys(value[key])]));
}


async function atomicReplace(filePath, text) {
  const suffix = `${process.pid}-${Date.now()}`;
  const temporaryPath = `${filePath}.tmp.${suffix}`;
  const backupPath = `${filePath}.backup.${suffix}`;
  const handle = await open(temporaryPath, "wx");
  try {
	await handle.writeFile(text, "utf8");
	await handle.sync();
  } finally {
	await handle.close();
  }
  try {
	await rename(temporaryPath, filePath);
  } catch {
	await rename(filePath, backupPath);
	try {
	  await rename(temporaryPath, filePath);
	  await rm(backupPath, { force: true });
	} catch (error) {
	  await rename(backupPath, filePath).catch(() => {});
	  await rm(temporaryPath, { force: true });
	  throw error;
	}
  }
}


function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
