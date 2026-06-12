const express = require('express');
const webhookController = require('../controllers/webhookController');
const { verifyWebhook } = require('../middleware/verifyWebhook')
const router = express.Router();

router.get('/', webhookController.getWebhooks);
// router.post('/orders/create', express.raw({ type: 'application/json' }), verifyWebhook, webhookController.handleOrdersCreate)
// router.post('/orders/updated', express.raw({ type: 'application/json' }), verifyWebhook, webhookController.handleOrdersUpdated)
// router.post('/products/create', express.raw({ type: 'application/json' }), verifyWebhook, webhookController.handleProductsCreate)
// router.post('/products/update', express.raw({ type: 'application/json' }), verifyWebhook, webhookController.handleProductsUpdate)
router.post('/customers/create', express.raw({ type: 'application/json' }), verifyWebhook, webhookController.handleCustomersCreate)
// router.post('/app/uninstalled', express.raw({ type: 'application/json' }), verifyWebhook, webhookController.handleAppUninstalled)


module.exports = router;