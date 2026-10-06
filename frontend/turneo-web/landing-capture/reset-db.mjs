// Paso previo de `npm run landing:capture`: verifica que los puertos estén
// libres y deja la base demo en cero. Corre ANTES de Playwright porque sus
// webServer arrancan antes que globalSetup, y la API migra la base al iniciar.
import net from "node:net";
import { DEMO_DATABASE, resetDemoDatabase } from "./db.mjs";
import { API_PORT, WEB_PORT } from "./ports.mjs";

/** @param {number} port */
function isPortBusy(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1500, () => { socket.destroy(); resolve(false); });
  });
}

for (const port of [API_PORT, WEB_PORT]) {
  if (await isPortBusy(port)) {
    console.error(`El puerto ${port} está ocupado. Cerrá lo que lo esté usando y volvé a correr.`);
    process.exit(1);
  }
}

resetDemoDatabase();
console.log(`Base ${DEMO_DATABASE} reiniciada.`);
