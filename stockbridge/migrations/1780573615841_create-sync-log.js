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
    "sync_log",
    {
      id: {
        type: "uuid",
        primaryKey: true,
        default: pgm.func("gen_random_uuid()"),
      },
      resource_type: { type: "varchar(50)", notNull: true },
      operation: { type: "varchar(20)", notNull: true },
      shopify_id: { type: "bigint" },
      status: { type: "varchar(20)", notNull: true },
      error_message: { type: "text" },
      shop_domain: { type: "varchar(255)", notNull: true },
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
  pgm.addIndex("sync_log", "resource_type");
  pgm.addIndex("sync_log", "status");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("sync_log");
};
