/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
  pgm.createTable(
    "orders",
    {
      id: {
        type: "uuid",
        primaryKey: true,
        default: pgm.func("gen_random_uuid()"),
      },
      shopify_id: { type: "bigint", notNull: true },
      order_number: { type: "varchar(50)" },
      customer_shopify_id: { type: "bigint" },
      financial_status: { type: "varchar(50)" },
      fulfillment_status: { type: "varchar(50)" },
      total_price: { type: "decimal(10,2)" },
      currency: { type: "varchar(10)" },
      shop_domain: { type: "varchar(255)", notNull: true },
      shopify_created_at: { type: "timestamp" },
      synced_at: { type: "timestamp" },
      created_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
    },
    {
      ifNotExists: true,
    },
  );
  pgm.addIndex("orders", "shopify_id");
  pgm.addIndex("orders", "customer_shopify_id");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("orders");
};
