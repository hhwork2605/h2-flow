/**
 * content/flow.ts — Content script for labs.google/fx (Google Flow).
 *
 * Layer: Content script (ISOLATED world)
 * Owner: providers/flow
 *
 * Phase 0: stub only — registers the script so the manifest match runs.
 * Real DOM bridge (prompt submit, tile watch, slate insert) lands in Phase 2.
 * Reference behaviour: reference-ext/content.js + reference-ext/slate-bridge.js.
 */

console.debug('[h2-flow] flow content script loaded', location.href);

export {};
