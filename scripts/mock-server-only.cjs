/**
 * CJS require hook so Node tests can import modules that use `import "server-only"`.
 * Next.js webpack still resolves the real package for Client Component boundaries.
 */
const Module = require("module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad.apply(this, arguments);
};
