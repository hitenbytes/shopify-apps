const express = require('express');
const validateBody = require('../middleware/validateBody');
const { createVariantSchema } = require('../schemas/product');
const productController = require('../controllers/productController');
const router = express.Router();

router.post('/:productId', validateBody(createVariantSchema), productController.createVariant);
// router.get('/:id', productController.getProduct);
// router.post('/', validateBody(newProductSchema), productController.createProduct);
// router.put('/:id', validateBody(newProductSchema.partial()), productController.updateProduct);
// router.post('/sync', productController.syncProducts);

module.exports = router;