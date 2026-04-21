/**
 * Single content-script bundle for MV3 (load order: editor exports, then wiki UI).
 * Replaces separate editor-bundle.js + main.js to avoid duplicate bundles and simplify the build.
 */
import './editor-bundle';
import './main';
