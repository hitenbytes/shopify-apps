require('dotenv').config()
const express = require('express');
const cookieParser = require('cookie-parser');

const productRoutes = require('./routes/products')
const variantRoutes = require('./routes/variants')
// const inventoryRoutes = require('./routes/inventory')
// const customerRoutes = require('./routes/customers')
// const orderRoutes = require('./routes/orders')
// const graphqlRoutes = require('./routes/graphql')
const webhookRoutes = require('./routes/webhooks')

const app = express()
app.use('/webhooks', webhookRoutes)

app.use(express.json())
app.use(
  cookieParser(
    process.env.COOKIE_SECRET ||
      process.env.SHOPIFY_API_SECRET ||
      process.env.SHOPIFY_CLIENT_SECRET ||
      'stockbridge-dev-cookie-secret'
  )
)
app.use('/auth', require('./routes/auth'))
app.use('/api/products', productRoutes)
app.use('/api/variants', variantRoutes)
// app.use('/api/inventory', inventoryRoutes)
// app.use('/api/customers', customerRoutes)
// app.use('/api/orders', orderRoutes)
// app.use('/graphql', graphqlRoutes)

app.get('/', (req, res) => {
  res.json({ message: 'StockBridge is running' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
   
  console.log(`StockBridge running on http://localhost:${PORT}`)
})