const shopify = require('../services/shopify');
const db = require('../db');
async function getWebhooks(req, res) {
    const response = await shopify.get("/webhooks.json");
    const webhooks = response.data;

    return res.json({
        message: 'Webhooks retrieved successfully',
        webhooks
    })
}

// helper — log every incoming webhook to DB
const logWebhookEvent = async (topic, shopDomain, payload, status = 'received') => {
  return await db.query(
    `INSERT INTO webhook_events (topic, shop_domain, payload, status, received_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id`,
    [topic, shopDomain, JSON.stringify(payload), status]
  )
}

// helper — mark webhook as processed or failed
const updateWebhookStatus = async (topic, shopDomain, status, errorMessage = null) => {
  await db.query(
    `UPDATE webhook_events
     SET status = $1, error_message = $2, processed_at = NOW()
     WHERE topic = $3 AND shop_domain = $4
     AND processed_at IS NULL
     ORDER BY received_at DESC
     LIMIT 1`,
    [status, errorMessage, topic, shopDomain]
  )
}

// ─── orders/create ───────────────────────────────────────────────
const handleOrdersCreate = async (req, res) => {
  // always respond 200 immediately
  // Shopify retries if it doesn't get 200 within 5 seconds

  const { shopifyTopic, shopifyDomain, webhookBody: order } = req

  try {
    await logWebhookEvent(shopifyTopic, shopifyDomain, order)

    // save order to local DB
    await db.query(
      `INSERT INTO orders (
         shopify_id, order_number, customer_shopify_id,
         financial_status, fulfillment_status,
         total_price, currency, shop_domain,
         shopify_created_at, synced_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (shopify_id) DO NOTHING`,
      [
        order.id,
        order.order_number,
        order.customer?.id || null,
        order.financial_status,
        order.fulfillment_status,
        order.total_price,
        order.currency,
        shopifyDomain,
        order.created_at,
      ]
    )

    // save line items
    if (order.line_items?.length) {
      for (const item of order.line_items) {
        await db.query(
          `INSERT INTO order_line_items (order_id, variant_shopify_id, title, quantity, price, sku)
           SELECT id, $1, $2, $3, $4, $5
           FROM orders WHERE shopify_id = $6
           ON CONFLICT DO NOTHING`,
          [item.variant_id, item.title, item.quantity, item.price, item.sku, order.id]
        )
      }
    }

    await updateWebhookStatus(shopifyTopic, shopifyDomain, 'processed')
    console.log(`✅ Order created: #${order.order_number}`)
  } catch (err) {
    console.error('handleOrdersCreate error:', err.message)
    await updateWebhookStatus(shopifyTopic, shopifyDomain, 'failed', err.message)
    res.status(400).send('Error processing webhook');
  }
}

// ─── orders/updated ──────────────────────────────────────────────
const handleOrdersUpdated = async (req, res) => {

  const { shopifyTopic, shopifyDomain, webhookBody: order } = req

  try {
    await logWebhookEvent(shopifyTopic, shopifyDomain, order)

    await db.query(
      `UPDATE orders
       SET financial_status = $1,
           fulfillment_status = $2,
           total_price = $3,
           synced_at = NOW()
       WHERE shopify_id = $4 AND shop_domain = $5`,
      [
        order.financial_status,
        order.fulfillment_status,
        order.total_price,
        order.id,
        shopifyDomain,
      ]
    )

    await updateWebhookStatus(shopifyTopic, shopifyDomain, 'processed')
    console.log(`✅ Order updated: #${order.order_number}`)
  } catch (err) {
    console.error('handleOrdersUpdated error:', err.message)
    await updateWebhookStatus(shopifyTopic, shopifyDomain, 'failed', err.message)
  }
}

// ─── products/create ─────────────────────────────────────────────
const handleProductsCreate = async (req, res) => {

  const { shopifyTopic, shopifyDomain, webhookBody: product } = req

  try {
    await logWebhookEvent(shopifyTopic, shopifyDomain, product)

    await db.query(
      `INSERT INTO products (shopify_id, title, vendor, status, tags, shop_domain, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (shopify_id) DO NOTHING`,
      [product.id, product.title, product.vendor, product.status, product.tags, shopifyDomain]
    )

    await updateWebhookStatus(shopifyTopic, shopifyDomain, 'processed')
    console.log(`✅ Product created via webhook: ${product.title}`)
  } catch (err) {
    console.error('handleProductsCreate error:', err.message)
    await updateWebhookStatus(shopifyTopic, shopifyDomain, 'failed', err.message)
  }
}

// ─── products/update ─────────────────────────────────────────────
const handleProductsUpdate = async (req, res) => {

  const { shopifyTopic, shopifyDomain, webhookBody: product } = req

  try {
    await logWebhookEvent(shopifyTopic, shopifyDomain, product)

    await db.query(
      `UPDATE products
       SET title = $1, vendor = $2, status = $3, tags = $4,
           synced_at = NOW(), updated_at = NOW()
       WHERE shopify_id = $5 AND shop_domain = $6`,
      [product.title, product.vendor, product.status, product.tags, product.id, shopifyDomain]
    )

    await updateWebhookStatus(shopifyTopic, shopifyDomain, 'processed')
    console.log(`✅ Product updated via webhook: ${product.title}`)
  } catch (err) {
    console.error('handleProductsUpdate error:', err.message)
    await updateWebhookStatus(shopifyTopic, shopifyDomain, 'failed', err.message)
  }
}

// ─── customers/create ────────────────────────────────────────────
const handleCustomersCreate = async (req, res) => {
  const { shopifyTopic, shopifyDomain, webhookBody: customer } = req

  try {
    await logWebhookEvent(shopifyTopic, shopifyDomain, customer)

    await db.query(
      `INSERT INTO customers (shopify_id, email, first_name, last_name, phone, tags, shop_domain, synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (shopify_id) DO NOTHING`,
      [
        customer.id,
        customer.email,
        customer.first_name,
        customer.last_name,
        customer.phone,
        customer.tags,
        shopifyDomain,
      ]
    )

    await updateWebhookStatus(shopifyTopic, shopifyDomain, 'processed')
    console.log(`✅ Customer created via webhook: ${customer.email}`)

    res.status(200).send('OK');
  } catch (err) {
    console.error('handleCustomersCreate error:', err.message)
    await updateWebhookStatus(shopifyTopic, shopifyDomain, 'failed', err.message)
    res.status(400).send('Error processing webhook');
  }
}

// ─── app/uninstalled ─────────────────────────────────────────────
const handleAppUninstalled = async (req, res) => {

  const { shopifyTopic, shopifyDomain, webhookBody } = req

  try {
    await logWebhookEvent(shopifyTopic, shopifyDomain, webhookBody)

    // delete all store data in correct FK order
    await db.query(`DELETE FROM sync_log WHERE shop_domain = $1`, [shopifyDomain])
    await db.query(`DELETE FROM webhook_events WHERE shop_domain = $1`, [shopifyDomain])
    await db.query(`
      DELETE FROM order_line_items
      WHERE order_id IN (
        SELECT id FROM orders WHERE shop_domain = $1
      )`, [shopifyDomain]
    )
    await db.query(`DELETE FROM orders WHERE shop_domain = $1`, [shopifyDomain])
    await db.query(`DELETE FROM customers WHERE shop_domain = $1`, [shopifyDomain])
    await db.query(`
      DELETE FROM inventory
      WHERE variant_id IN (
        SELECT v.id FROM variants v
        JOIN products p ON v.product_id = p.id
        WHERE p.shop_domain = $1
      )`, [shopifyDomain]
    )
    await db.query(`
      DELETE FROM variants
      WHERE product_id IN (
        SELECT id FROM products WHERE shop_domain = $1
      )`, [shopifyDomain]
    )
    await db.query(`DELETE FROM products WHERE shop_domain = $1`, [shopifyDomain])
    await db.query(`DELETE FROM sessions WHERE shop_domain = $1`, [shopifyDomain])

    console.log(`🗑️ App uninstalled — all data deleted for ${shopifyDomain}`)
  } catch (err) {
    console.error('handleAppUninstalled error:', err.message)
  }
}

module.exports = {
    getWebhooks,
  handleOrdersCreate,
  handleOrdersUpdated,
  handleProductsCreate,
  handleProductsUpdate,
  handleCustomersCreate,
  handleAppUninstalled,
}