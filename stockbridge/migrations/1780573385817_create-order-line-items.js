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
    "order_line_items",
    {
      id: {
        type: "uuid",
        primaryKey: true,
        default: pgm.func("gen_random_uuid()"),
      },
      order_id: {
        type: "uuid",
        notNull: true,
        references: '"orders"',
        onDelete: "CASCADE",
      },
      variant_shopify_id: { type: "bigint" },
      title: { type: "varchar(255)" },
      quantity: { type: "integer", notNull: true },
      price: { type: "decimal(10,2)" },
      sku: { type: "varchar(255)" },
    },
    {
      ifNotExists: true,
    },
  );
  pgm.addIndex("order_line_items", "order_id");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("order_line_items");
};
