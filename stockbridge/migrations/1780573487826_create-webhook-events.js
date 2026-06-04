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
    "webhook_events",
    {
      id: {
        type: "uuid",
        primaryKey: true,
        default: pgm.func("gen_random_uuid()"),
      },
      topic: { type: "varchar(100)", notNull: true },
      shop_domain: { type: "varchar(255)", notNull: true },
      payload: { type: "jsonb", notNull: true },
      status: { type: "varchar(20)", notNull: true, default: "'received'" },
      error_message: { type: "text" },
      received_at: {
        type: "timestamp",
        notNull: true,
        default: pgm.func("current_timestamp"),
      },
      processed_at: { type: "timestamp" },
    },
    {
      ifNotExists: true,
    },
  );
  pgm.addIndex("webhook_events", "topic");
  pgm.addIndex("webhook_events", "shop_domain");
  pgm.addIndex("webhook_events", "status");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
  pgm.dropTable("webhook_events");
};
