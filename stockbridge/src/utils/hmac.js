/**
 * utils/hmac.js
 *
 * Shopify sends an HMAC-SHA256 signature with every request (install redirect,
 * OAuth callback, etc.). We must verify it before trusting the request.
 *
 * Official docs:
 * https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant#step-1-verify-the-installation-request
 *
 * Algorithm:
 *  1. Pull ALL query params into an object
 *  2. Remove the `hmac` key (we're going to re-compute it)
 *  3. Sort remaining keys alphabetically, build "key=value&key=value" string
 *  4. HMAC-SHA256 that string using the app's client secret
 *  5. Compare (in constant-time) to the `hmac` value Shopify sent
 */

const crypto = require("crypto");

/**
 * Verifies that an incoming Shopify request is authentic.
 *
 * @param {Object} query  - req.query from Express (all URL query params)
 * @param {string} secret - SHOPIFY_API_SECRET from .env
 * @returns {boolean}     - true if signature is valid
 */
function verifyHmac(query, secret) {
  const { hmac, ...rest } = query; // separate hmac from the rest

  if (!hmac) return false;

  // Build sorted "key=value" string (Shopify requires alphabetical order)
  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join("&");

  // Compute HMAC-SHA256 using our client secret
  const computedHmac = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  // timingSafeEqual prevents timing-attack leaks
  // Both buffers must be the same length
  const hmacBuffer = Buffer.from(hmac, "hex");
  const computedBuffer = Buffer.from(computedHmac, "hex");

  if (hmacBuffer.length !== computedBuffer.length) return false;

  return crypto.timingSafeEqual(hmacBuffer, computedBuffer);
}

/**
 * Validates that the `shop` param is a real myshopify.com hostname.
 * Rejects anything that could be used for open-redirect attacks.
 *
 * @param {string} shop - e.g. "my-store.myshopify.com"
 * @returns {boolean}
 */
function isValidShop(shop) {
  // Only letters, numbers, and hyphens; must end in .myshopify.com
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

module.exports = { verifyHmac, isValidShop };