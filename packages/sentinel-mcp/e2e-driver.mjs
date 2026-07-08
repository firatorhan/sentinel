// E2E driver: cli.js'i gerçek stdio MCP olarak spawn eder, tarayıcı sekmesi
// bağlanana kadar list_tabs'ı yoklar, sonra tüm tool'ları sırayla çalıştırır.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/cli.js"],
  stderr: "inherit",
});
const client = new Client({ name: "e2e-driver", version: "0" });
await client.connect(transport);
console.log("[e2e] MCP bağlantısı kuruldu, sekme bekleniyor (max 10 dk)...");

const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  return res.content[0].text;
};

const deadline = Date.now() + 10 * 60 * 1000;
let tabs = "";
while (Date.now() < deadline) {
  tabs = await call("list_tabs");
  if (!tabs.startsWith("No tabs connected")) break;
  await new Promise((r) => setTimeout(r, 3000));
}
if (tabs.startsWith("No tabs connected")) {
  console.log("[e2e] ZAMAN AŞIMI: hiçbir sekme bağlanmadı.");
  process.exit(1);
}

console.log("=== list_tabs ===\n" + tabs);
console.log("\n=== list_api_calls ===\n" + (await call("list_api_calls")));
console.log("\n=== get_duplicates ===\n" + (await call("get_duplicates")));
console.log("\n=== get_state (özet) ===\n" + (await call("get_state")));
console.log("\n=== get_state (query: price) ===\n" + (await call("get_state", { query: "price" })));
console.log("\n=== get_action_log ===\n" + (await call("get_action_log", { limit: 10 })));
console.log("\n=== get_lineage (query: price) ===\n" + (await call("get_lineage", { query: "price" })));

const componentsSummary = await call("get_component_props");
console.log("\n=== get_component_props (özet) ===\n" + componentsSummary);
// Özetten ilk component adını çek ("Name  ×N" satırı) ve onunla sorgula.
const firstName = componentsSummary
  .split("\n")
  .map((l) => l.trim())
  .find((l) => /\s×\d+$/.test(l))
  ?.replace(/\s+×\d+$/, "");
if (firstName) {
  console.log(`\n=== get_component_props (name: ${firstName}) ===\n` + (await call("get_component_props", { name: firstName })));
}

console.log("\n[e2e] TAMAM — process kapatılıyor.");
await client.close();
process.exit(0);
