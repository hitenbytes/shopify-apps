const express = require('express');
const validateBody = require('../middleware/validateBody');
const { newProductSchema } = require('../schemas/newProduct');
const productController = require('../controllers/productController');
const router = express.Router();

router.get('/', productController.getProducts);
router.post('/', validateBody(newProductSchema), productController.createProduct)
module.exports = router;