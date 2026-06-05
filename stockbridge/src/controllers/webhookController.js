const shopify = require('../services/shopify');

async function getWebhooks(req, res) {
    const response = await shopify.get("/webhooks.json");
    const webhooks = response.data;

    return res.json({
        message: 'Webhooks retrieved successfully',
        webhooks
    })
}


module.exports = {
    getWebhooks
}