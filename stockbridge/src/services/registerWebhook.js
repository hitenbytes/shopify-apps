const shopifyClient = require('./shopify')
const axios = require('axios');

const WEBHOOKS = [
  { topic: 'orders/create',     path: '/webhooks/orders/create' },
  { topic: 'orders/updated',    path: '/webhooks/orders/updated' },
  { topic: 'products/create',   path: '/webhooks/products/create' },
  { topic: 'products/update',   path: '/webhooks/products/update' },
  { topic: 'customers/create',  path: '/webhooks/customers/create' },
  { topic: 'app/uninstalled',   path: '/webhooks/app/uninstalled' },
]


const registerWebhooks = async (shopDomain, accessToken) => {
  const baseUrl = process.env.APP_URL

  const client = axios.create({
    baseURL: `https://${shopDomain}/admin/api/${process.env.SHOPIFY_API_VERSION}`,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  })

  const existing = await client.get('/webhooks.json')
  const existingTopics = existing.data.webhooks.map(w => w.topic)

  for (const webhook of WEBHOOKS) {
    if (existingTopics.includes(webhook.topic)) continue

    await shopifyClient.post('/webhooks.json', {
      webhook: {
        topic: webhook.topic,
        address: `${baseUrl}${webhook.path}`,
        format: 'json',
      },
    })
  }
}

module.exports = { registerWebhooks }