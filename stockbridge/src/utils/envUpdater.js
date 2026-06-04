/**
 * utils/envUpdater.js
 *
 * After OAuth completes, Shopify returns an access token that we need to
 * persist for subsequent API calls. This utility writes/updates key=value
 * pairs directly in the project's .env file so that the token survives
 * server restarts.
 *
 * In production you would use a proper secrets store (AWS Secrets Manager,
 * HashiCorp Vault, a DB, etc.).  For a dev/learning setup, .env is fine.
 */

const fs = require("fs");
const path = require("path");

// Always resolve to the project root .env, regardless of where node is invoked
const ENV_PATH = path.resolve(process.cwd(), ".env");

/**
 * Updates one or more key=value pairs in the .env file.
 * Creates the file if it doesn't exist.
 *
 * @param {Object} updates  - e.g. { SHOPIFY_ACCESS_TOKEN: "shpat_xxx", SHOPIFY_SHOP: "my-store.myshopify.com" }
 */
function updateEnv(updates) {
  // Read existing content (or start with empty string)
  let content = "";
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, "utf8");
  }

  for (const [key, value] of Object.entries(updates)) {
    const lineRegex = new RegExp(`^${key}=.*$`, "m");

    if (lineRegex.test(content)) {
      // Key already exists — overwrite in place
      content = content.replace(lineRegex, `${key}=${value}`);
    } else {
      // Key is new — append to end (with a trailing newline)
      content = content.trimEnd() + `\n${key}=${value}\n`;
    }
  }

  fs.writeFileSync(ENV_PATH, content, "utf8");

  // Also update process.env so the running process picks up the new values
  // without needing a restart
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;
  }
}

module.exports = { updateEnv };