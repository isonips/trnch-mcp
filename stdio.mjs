#!/usr/bin/env node
// Stdio bridge to the hosted TRNCH MCP server (https://trnch.fun/api/mcp).
// For clients that only speak stdio. No dependencies, Node 18+.
// Optional env: TRNCH_API_KEY (sent as Authorization: Bearer), TRNCH_MCP_URL.
import { createInterface } from "node:readline";

const URL_ = process.env.TRNCH_MCP_URL || "https://trnch.fun/api/mcp";
const KEY = process.env.TRNCH_API_KEY || "";

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");

async function forward(req) {
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  if (KEY) headers.authorization = `Bearer ${KEY}`;
  try {
    const res = await fetch(URL_, { method: "POST", headers, body: JSON.stringify(req) });
    if (req.id === undefined || res.status === 202) return;
    const text = await res.text();
    send(text ? JSON.parse(text) : { jsonrpc: "2.0", id: req.id, error: { code: -32603, message: `HTTP ${res.status}` } });
  } catch (e) {
    if (req.id !== undefined) send({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: String(e?.message || e) } });
  }
}

// Requests are forwarded one at a time so replies keep their order.
let queue = Promise.resolve();
createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
  }
  for (const r of Array.isArray(req) ? req : [req]) queue = queue.then(() => forward(r));
});
