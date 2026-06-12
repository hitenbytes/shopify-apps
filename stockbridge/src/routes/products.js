const express = require('express');
const validateBody = require('../middleware/validateBody');
const { newProductSchema } = require('../schemas/product');
const productController = require('../controllers/productController');
const router = express.Router();

router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);
router.post('/', validateBody(newProductSchema), productController.createProduct);
router.put('/:id', validateBody(newProductSchema.partial()), productController.updateProduct);
router.post('/sync', productController.syncProducts);

module.exports = router;