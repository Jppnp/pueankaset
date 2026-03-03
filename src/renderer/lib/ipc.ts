// Typed IPC wrappers - simply re-export window.api for convenience
// This module exists so components can import from a single place

export function getApi() {
  return window.api
}
