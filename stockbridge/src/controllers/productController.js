const shopify = require("../services/shopify");
const db = require("../db");

const getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { rows: products } = await db.query(
      `SELECT * FROM products
       WHERE shop_domain = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [process.env.SHOPIFY_SHOP, limit, offset],
    );

    const { rows: countResult } = await db.query(
      `SELECT COUNT(*) FROM products WHERE shop_domain = $1`,
      [process.env.SHOPIFY_SHOP],
    );

    const total = parseInt(countResult[0].count);

    return res.json({
      message: "Products retrieved successfully",
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
      products,
    });
  } catch (err) {
    console.error("getProducts error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await db.query(
      `SELECT * FROM products WHERE shopify_id = $1 AND shop_domain = $2`,
      [id, process.env.SHOPIFY_SHOP],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({
      message: "Product retrieved successfully",
      product: rows[0],
    });
  } catch (err) {
    console.error("getProduct error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

async function createProduct(req, res) {
  const client = await db.getClient();
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

    await client.query("COMMIT");

    return res.json({
      message: "Product created successfully",
      shopify: product,
      local: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating product:", error);
    await client.query("ROLLBACK");
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

const updateProduct = async (req, res) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { title, vendor, tags } = req.body;
    await client.query("BEGIN");

    // call Shopify
    const response = await shopify.put(`/products/${id}.json`, {
      product: { id, title, vendor, tags },
    });
    const product = response.data.product;

    // update local DB
    await client.query(
      `UPDATE products
       SET title = $1, vendor = $2, tags = $3, synced_at = NOW(), updated_at = NOW()
       WHERE shopify_id = $4`,
      [product.title, product.vendor, product.tags, product.id],
    );

    // log the sync
    await client.query(
      `INSERT INTO sync_log (resource_type, operation, shopify_id, status, shop_domain)
       VALUES ($1, $2, $3, $4, $5)`,
      ["product", "update", product.id, "success", process.env.SHOPIFY_SHOP],
    );

    await client.query("COMMIT");
    return res.json(product);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateProduct error:", err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const syncProducts = async (req, res) => {
  try {
    // respond immediately — don't make the client wait
    res.json({ message: "Sync started", status: "running" });

    // run sync in background
    _runProductSync();
  } catch (err) {
    console.error("syncProducts error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// internal sync function — runs in background
const _runProductSync = async () => {
  console.log("🔄 Product sync started...");
  let pageInfo = null;
  let totalSynced = 0;
  let hasNextPage = true;

  try {
    while (hasNextPage) {
      // Shopify cursor-based pagination
      const params = pageInfo
        ? { limit: 250, page_info: pageInfo }
        : { limit: 250 };

      const response = await shopify.get("/products.json", { params });
      const products = response.data.products;

      if (!products.length) break;

      // batch upsert all products from this page
      for (const product of products) {
        await db.query(
          `INSERT INTO products (shopify_id, title, vendor, status, tags, shop_domain, synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (shopify_id)
           DO UPDATE SET
             title = EXCLUDED.title,
             vendor = EXCLUDED.vendor,
             status = EXCLUDED.status,
             tags = EXCLUDED.tags,
             synced_at = NOW(),
             updated_at = NOW()`,
          [
            product.id,
            product.title,
            product.vendor,
            product.status,
            product.tags,
            process.env.SHOPIFY_SHOP,
          ],
        );
      }

      totalSynced += products.length;
      console.log(`✅ Synced ${totalSynced} products so far...`);

      // check if there is a next page via Link header
      const linkHeader = response.headers["link"];
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/page_info=([^&>]+).*rel="next"/);
        pageInfo = match ? match[1] : null;
        hasNextPage = !!pageInfo;
      } else {
        hasNextPage = false;
      }
    }

    // log completed sync
    await db.query(
      `INSERT INTO sync_log (resource_type, operation, shopify_id, status, shop_domain)
       VALUES ($1, $2, $3, $4, $5)`,
      ["product", "sync", null, "success", process.env.SHOPIFY_SHOP],
    );

    console.log(`✅ Product sync complete. Total synced: ${totalSynced}`);
  } catch (err) {
    console.error("❌ Product sync failed:", err.message);
    await db.query(
      `INSERT INTO sync_log (resource_type, operation, shopify_id, status, error_message, shop_domain)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        "product",
        "sync",
        null,
        "failed",
        err.message,
        process.env.SHOPIFY_SHOP,
      ],
    );
  }
};

// Create variants on product
const createVariant = async (req, res) => {
    const client = await db.getClient();

  try {
    const { sku, price, options = [] } = req.body
    const product_id = req.params.productId;

    if (!options.length) {
      return res.status(400).json({ error: 'options array is required' })
    }

    // step 1 — fetch the product
    const productRes = await shopify.get(`/products/${product_id}.json`)
    const product = productRes.data.product

    // map options array to option1, option2, option3
    const [option1 = null, option2 = null, option3 = null] = options

    // step 2 — check if Default Title product
    const isDefault =
      product.options?.length === 1 &&
      product.options[0]?.name === 'Title' &&
      product.variants?.length === 1 &&
      product.variants[0]?.title === 'Default Title'

    if (isDefault) {
      // step 3 — build real options from what was passed
      // e.g. ["Medium", "Red", "Cotton"] → options: [{name:"Option 1"},{name:"Option 2"},{name:"Option 3"}]
      const productOptions = options.map((_, i) => ({
        name: `Option ${i + 1}`,
      }))

      // convert product + update the existing Default Title variant
      await shopify.put(`/products/${product_id}.json`, {
        product: {
          id: product_id,
          options: productOptions,
          variants: [
            {
              id: product.variants[0].id,
              option1,
              option2,
              option3,
              sku,
              price,
            },
          ],
        },
      })

      const updated = await shopify.get(`/products/${product_id}.json`)
      const updatedVariant = updated.data.product.variants[0]
      
      await client.query("BEGIN");

      const localProduct = await client.query(
        `SELECT id FROM products WHERE shopify_id = $1`,
        [product_id]
      )

      await client.query(
        `INSERT INTO variants (shopify_id, product_id, sku, price, title, shop_domain, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (shopify_id)
         DO UPDATE SET sku = EXCLUDED.sku, price = EXCLUDED.price, synced_at = NOW()`,
        [
          updatedVariant.id,
          localProduct.rows[0].id,
          updatedVariant.sku,
          updatedVariant.price,
          updatedVariant.title,
          process.env.SHOPIFY_SHOP,
        ]
      )

      await client.query(
        `INSERT INTO sync_log (resource_type, operation, shopify_id, status, shop_domain)
         VALUES ($1, $2, $3, $4, $5)`,
        ['variant', 'convert_and_create', updatedVariant.id, 'success', process.env.SHOPIFY_SHOP]
      )
    
      await client.query("COMMIT");
      return res.status(201).json({
        message: 'Product converted from Default Title and variant updated',
        shopify: updatedVariant,
      })
    }

    // step 4 — product already has real options, add variant normally
    const variantRes = await shopify.post(
      `/products/${product_id}/variants.json`,
      {
        variant: {
          option1,
          option2,
          option3,
          sku,
          price,
        },
      }
    )
    const variant = variantRes.data.variant

    const localProduct = await client.query(
      `SELECT id FROM products WHERE shopify_id = $1`,
      [product_id]
    )

    await client.query(
      `INSERT INTO variants (shopify_id, product_id, sku, price, title, shop_domain, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [
        variant.id,
        localProduct.rows[0].id,
        variant.sku,
        variant.price,
        variant.title,
        process.env.SHOPIFY_SHOP,
      ]
    )

    await client.query(
      `INSERT INTO sync_log (resource_type, operation, shopify_id, status, shop_domain)
       VALUES ($1, $2, $3, $4, $5)`,
      ['variant', 'create', variant.id, 'success', process.env.SHOPIFY_SHOP]
    )

    res.status(201).json({ shopify: variant })
  } catch (err) {
    console.error('createVariant error:', err.message, err.response?.data)
    res.status(500).json({ error: err.message })
  }
}

module.exports = {
  getProducts,
  createProduct,
  getProduct,
  updateProduct,
  syncProducts,
  createVariant,
};
