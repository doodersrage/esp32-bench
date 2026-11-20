// Stands in for "node:module" in the browser bundle. manifold-3d only imports it
// when running under Node, so in a browser this is never called; replacing it
// keeps Vite from warning that it externalized a Node built-in.
export function createRequire(): never {
  throw new Error("node:module is not available in the browser");
}
