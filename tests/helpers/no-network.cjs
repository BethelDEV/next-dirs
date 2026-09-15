// Every local test fails closed if code accidentally calls an external service.
const { syncBuiltinESMExports } = require("node:module");
function blocked() {
  throw new Error(
    "Network is disabled for local tests; inject a provider double",
  );
}
globalThis.fetch = blocked;
require("node:http").request = blocked;
require("node:http").get = blocked;
require("node:https").request = blocked;
require("node:https").get = blocked;
syncBuiltinESMExports();
