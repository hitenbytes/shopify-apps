
const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const db = require("../db");
const { verifyHmac, isValidShop } = require("../utils/hmac");
const { updateEnv } = require("../utils/envUpdater");
const { registerWebhooks } = require("../services/registerWebhook");

const router = express.Router();
const DEFAULT_SCOPES = "read_products";

function getCredentials() {
  const clientId = process.env.SHOPIFY_API_KEY || process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Shopify app credentials (SHOPIFY_API_KEY/API_SECRET or SHOPIFY_CLIENT_ID/CLIENT_SECRET)");
  }

  return { clientId, clientSecret };
}

function getRedirectUri(req) {
  return process.env.SHOPIFY_REDIRECT_URI || `${req.protocol}://${req.get("host")}/auth/shopify/callback`;
}

function buildAuthorizationUrl({ shop, nonce, clientId, scopes, redirectUri }) {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state: nonce,
  });

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

router.get("/shopify", (req, res) => {
  const { shop, hmac } = req.query;

  if (!shop) {
    return res.status(400).json({
      error: "Missing 'shop' query parameter",
      example: "/auth/shopify?shop=my-store.myshopify.com",
    });
  }

  if (!isValidShop(shop)) {
    return res.status(400).json({
      error: "Invalid shop hostname",
      received: shop,
      expected: "something.myshopify.com",
    });
  }

  let credentials;
  try {
    credentials = getCredentials();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  if (hmac && !verifyHmac(req.query, credentials.clientSecret)) {
    return res.status(403).json({ error: "HMAC verification failed" });
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  res.cookie("shopify_oauth_state", nonce, {
    httpOnly: true,
    signed: true,
    maxAge: 10 * 60 * 1000,
    sameSite: "lax",
  });

  const scopes = process.env.SHOPIFY_SCOPES || DEFAULT_SCOPES;
  const redirectUri = getRedirectUri(req);
  const authUrl = buildAuthorizationUrl({
    shop,
    nonce,
    clientId: credentials.clientId,
    scopes,
    redirectUri,
  });

  return res.redirect(authUrl);
});

router.get("/shopify/callback", async (req, res) => {
  const { code, shop, state } = req.query;

  let credentials;
  try {
    credentials = getCredentials();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!verifyHmac(req.query, credentials.clientSecret)) {
    return res.status(403).json({ error: "HMAC verification failed" });
  }

  const storedNonce = req.signedCookies?.shopify_oauth_state;
  if (!storedNonce || storedNonce !== state) {
    return res.status(403).json({
      error: "State/nonce mismatch",
      hint: "Retry auth: GET /auth/shopify?shop=your-shop.myshopify.com",
    });
  }
  res.clearCookie("shopify_oauth_state");

  if (!isValidShop(shop)) {
    return res.status(400).json({ error: "Invalid shop hostname" });
  }

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const tokenResponse = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        code,
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const { access_token, scope, expires_in } = tokenResponse.data;
    const expiredAt = new Date();
    expiredAt.setSeconds(expiredAt.getSeconds() + expires_in);

    const storeHandle = shop.replace(/\.myshopify\.com$/i, "");

    db.query("INSERT INTO sessions (shop_domain, access_token, expires_at) VALUES ($1, $2, $3) ON CONFLICT (shop_domain) DO UPDATE SET access_token = EXCLUDED.access_token, expires_at = EXCLUDED.expires_at", [
      shop,
      access_token,
      expiredAt,
    ]);

    updateEnv({
      SHOPIFY_ACCESS_TOKEN: access_token,
      SHOPIFY_SHOP: shop,
      SHOPIFY_STORE: storeHandle,
    });

    await registerWebhooks(shop, access_token);

    return res.status(200).json({
      message: "Shopify access token saved successfully",
      shop,
      scope,
    }).redirect(`https://${shop}/admin/apps/${process.env.SHOPIFY_API_KEY}`); // Redirect to home or dashboard after successful auth
  } catch (error) {
    return res.status(500).json({
      error: "Token exchange failed",
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;