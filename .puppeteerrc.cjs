const { join } = require("path");

// Keep Chrome next to the project instead of $HOME/.cache — the default
// resolves against whatever user runs the process (docker, pm2, CI sandbox),
// so install and runtime disagree and the launch fails with "Could not find Chrome".
module.exports = {
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
