require('dotenv').config()
const axios = require('axios')


function normalizeShopDomain(shop) {
  if (!shop) {
    throw new Error('Missing Shopify shop configuration (SHOPIFY_SHOP or SHOPIFY_STORE)')
  }
  return shop.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function buildBaseUrl(shop, version) {
  const normalizedShop = normalizeShopDomain(shop)
  const shopDomain = normalizedShop.endsWith('.myshopify.com')
    ? normalizedShop
    : `${normalizedShop}.myshopify.com`
  const normalizedVersion = String(version)
    .replace(/^\/+/, '')
    .replace(/^admin\/api\/?/i, '')
    .replace(/\/+$/, '')

  return `https://${shopDomain}/admin/api/${normalizedVersion}`
}

function getRuntimeConfig() {
  const shop = process.env.SHOPIFY_SHOP || process.env.SHOPIFY_STORE
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2025-10'

  if (!accessToken) {
    throw new Error('Missing Shopify access token (SHOPIFY_ACCESS_TOKEN)')
  }

  return {
    baseURL: buildBaseUrl(shop, apiVersion),
    accessToken,
  }
}

const shopifyClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
})

shopifyClient.interceptors.request.use((config) => {
  const { baseURL, accessToken } = getRuntimeConfig()
  config.baseURL = baseURL
  config.headers = config.headers || {}
  config.headers['X-Shopify-Access-Token'] = accessToken
  return config
})

module.exports = shopifyClient