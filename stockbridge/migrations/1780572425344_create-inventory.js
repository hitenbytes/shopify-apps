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
    "inventory",
    {
      id: {
        type: "uuid",
        primaryKey: true,
        default: pgm.func("gen_random_uuid()"),
      },
      shopify_inventory_item_id: { type: "bigint", notNull: true },
      location_id: { type: "bigint", notNull: true },
      variant_id: {
        type: "uuid",
        notNull: true,
        references: '"variants"',
        onDelete: "CASCADE",
      },
      available: { type: "integer", default: 0 },
      shop_domain: { type: "varchar(255)", notNull: true },
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
  pgm.addIndex("inventory", "variant_id");
  pgm.addIndex("inventory", "shopify_inventory_item_id");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("inventory");
};
