const shopify = require("../services/shopify");
const { getClient } = require("../db");
async function getProducts(req, res) {
  try {
    const { limit = 10 } = req.query;

    const products = await shopify.get("/products.json" + `?limit=${limit}`);
    console.log(
      "Fetching products from Shopify API...",
      JSON.parse(JSON.stringify(products.headers)),
    );
    return res.json({
      message: "Products fetched successfully",
      products: products.data,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    return res.status(status).json({
      message: "Error fetching products",
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data,
      },
    });
  }
}

async function createProduct(req, res) {
  const client = await getClient();
  try {
    const {
      title,
      description,
      price,
      qty,
      vendor,
      sku,
      status = "draft",
    } = req.body;

    const response = await shopify.post("/products.json", {
      product: {
        title,
        body_html: description,
        price,
        vendor,
        sku,
        status,
      },
    });

    const product = response.data.product;

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO products (shopify_id, title, vendor, status, tags, shop_domain, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        product.id,
        product.title,
        product.vendor,
        product.status,
        product.tags,
        process.env.SHOPIFY_SHOP,
      ],
    );

    // log sync
    await client.query(
      `INSERT INTO sync_log (resource_type, operation, shopify_id, status, shop_domain)
       VALUES ($1, $2, $3, $4, $5)`,
      ["product", "create", product.id, "success", process.env.SHOPIFY_SHOP],
    );

    await client.query('COMMIT');

    return res.json({
      message: "Product created successfully",
      shopify: product,
      local: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating product:", error);
    await client.query('ROLLBACK');
    const status = error.response?.status || 500;
    return res.status(status).json({
      message: "Error creating product",
      error: {
        message: error.message,
        status: error.response?.status,
        details: error.response?.data,
      },
    });
  } finally {
    client.release();
  }
}
module.exports = {
  getProducts,
  createProduct,
};
