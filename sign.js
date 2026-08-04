'use strict';
// No-op code-signing hook for dev/unsigned Windows builds.
// electron-builder's default Windows signer downloads winCodeSign, whose archive
// contains macOS symlinks that cannot be extracted in this environment.
// Providing a custom `sign` hook makes electron-builder call this function
// (a no-op) instead of the default doSign, so NO winCodeSign is downloaded,
// while the icon/version resources (rcedit) are still applied to the EXE.
exports.default = async function sign() {
  // intentionally does nothing: the resulting binaries are left unsigned
};
