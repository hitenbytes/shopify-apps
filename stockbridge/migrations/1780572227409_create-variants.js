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
    "variants",
    {
      id: {
        type: "uuid",
        primaryKey: true,
        default: pgm.func("gen_random_uuid()"),
      },
      shopify_id: { type: "bigint", notNull: true },
      product_id: {
        type: "uuid",
        notNull: true,
        references: '"products"',
        onDelete: "CASCADE",
      },
      sku: { type: "varchar(255)" },
      price: { type: "decimal(10,2)" },
      title: { type: "varchar(255)" },
      inventory_quantity: { type: "integer", default: 0 },
      shop_domain: { type: "varchar(255)", notNull: true },
      synced_at: { type: "timestamp" },
      created_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
      updated_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
    },
    {
      ifNotExists: true,
    },
  );
  pgm.addIndex("variants", "shopify_id");
  pgm.addIndex("variants", "product_id");
  pgm.addIndex("variants", "sku");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("variants");
};
