const crypto = require('crypto')
require('dotenv').config()

const verifyWebhook = (req, res, next) => {
  try {
    const hmacHeader = req.headers['x-shopify-hmac-sha256']
    const topic = req.headers['x-shopify-topic']
    const shopDomain = req.headers['x-shopify-shop-domain']

    if (!hmacHeader) {
      console.warn('⚠️ Webhook missing HMAC header')
      return res.status(401).json({ error: 'Missing HMAC header' })
    }

    // compute HMAC from raw body using client secret
    const generatedHmac = crypto
      .createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
      .update(req.body) // req.body is raw buffer here
      .digest('base64')

    // constant-time comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(generatedHmac),
      Buffer.from(hmacHeader)
    )

    if (!isValid) {
      console.warn(`⚠️ Invalid HMAC for topic: ${topic} from ${shopDomain}`)
      return res.status(401).json({ error: 'Invalid HMAC signature' })
    }

    // parse body and attach to req for controller use
    req.shopifyTopic = topic
    req.shopifyDomain = shopDomain
    req.webhookBody = JSON.parse(req.body.toString('utf8'))

    console.log(`✅ Webhook verified — topic: ${topic} shop: ${shopDomain}`)
    next()
  } catch (err) {
    console.error('verifyWebhook error:', err.message)
    res.status(500).json({ error: 'Webhook verification failed' })
  }
}

module.exports = { verifyWebhook }