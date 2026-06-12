const zod = require('zod');

const newProductSchema = zod.object({
  title: zod.string().min(1, 'Title is required'),
  description: zod.string().optional(),
  price: zod.number().positive('Price must be a greater than 0'),
  qty: zod.number().int().nonnegative('Quantity must be a non-negative integer'),
  vendor: zod.string().optional(),
  sku: zod.string(),
  status: zod.enum(['active', 'draft', 'archived']).default('draft'),
});


// Variants Schemas
const createVariantSchema = zod.object({
    title: zod.string().min(1, 'Title is required'),
    price: zod.number().positive('Price must be a greater than 0'),
    sku: zod.string(),
    options: zod.array(zod.string()).optional(),
})

module.exports = {
    newProductSchema,
    createVariantSchema
}