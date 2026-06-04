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
  pgm.createExtension("pgcrypto", { ifNotExists: true });
  pgm.createType("product_status", ["draft", "active", "archived"], {
    ifNotExists: true,
  });
  pgm.createTable("products", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    shopify_id: { type: "bigint", notNull: true },
    title: { type: "varchar(255)", notNull: true },
    vendor: { type: "varchar(255)" },
    status: { type: "product_status", default: "draft" },
    tags: { type: "text" },
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
  }, {
    ifNotExists: true,
  });
  pgm.addIndex("products", "shopify_id");
  pgm.addIndex("products", "shop_domain");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable("products");
};
