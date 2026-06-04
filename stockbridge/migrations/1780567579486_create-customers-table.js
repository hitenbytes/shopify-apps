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
    pgm.createExtension('pgcrypto', { ifNotExists: true })
    pgm.createTable('customers', {
        id: {type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        shopify_id: 'bigint',
        first_name: {
            type: 'varchar(100)',
        },
        last_name: {
            type: 'varchar(100)',
        },
        email: {
            type: 'varchar(255)',
            notNull: true,
            unique: true,
        },
        phone: {
            type: 'varchar(50)',
        },
        tags: {
            type: 'varchar(255)',
        },
        shop_domain: {
            type: 'varchar(255)',
            notNull: true,
        },
        synced_at: {
            type: 'timestamp',
        },
        created_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp'),
        },
        updated_at: {
            type: 'timestamp',
            default: pgm.func('current_timestamp'),
        },
    })
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable('customers');
};
