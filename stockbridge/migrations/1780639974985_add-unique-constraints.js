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
  pgm.addConstraint(
    "customers",
    "customers_shopify_id_unique",
    "UNIQUE (shopify_id)",
  );
  pgm.addConstraint(
    "orders",
    "orders_shopify_id_unique",
    "UNIQUE (shopify_id)",
  );
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropConstraint("customers", "customers_shopify_id_unique");
  pgm.dropConstraint("orders", "orders_shopify_id_unique");
};
