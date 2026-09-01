/** Allow importing Next "server-only" modules from CLI scripts. */
const Module = require("node:module");
const path = require("node:path");
const fs = require("node:fs");

const stubPath = path.join(__dirname, "stub-server-only-empty.js");
if (!fs.existsSync(stubPath)) {
  fs.writeFileSync(stubPath, "module.exports = {};\n");
}

const original = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "server-only") return stubPath;
  return original.call(this, request, parent, isMain, options);
};
