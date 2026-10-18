import {
	type AnySQLiteColumn,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
	disabledAt: integer('disabled_at'),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		expiresAt: integer('expires_at').notNull(),
		createdAt: integer('created_at').notNull()
	},
	(t) => [index('session_user_id_idx').on(t.userId)]
);

export const batch = sqliteTable(
	'batch',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		actor: text('actor', { enum: ['ui', 'agent', 'system'] }).notNull(),
		label: text('label').notNull(),
		createdAt: integer('created_at').notNull()
	},
	(t) => [index('batch_user_id_created_at_idx').on(t.userId, t.createdAt)]
);

export const change = sqliteTable(
	'change',
	{
		id: text('id').primaryKey(),
		batchId: text('batch_id')
			.notNull()
			.references(() => batch.id),
		seq: integer('seq').notNull(),
		entity: text('entity').notNull(),
		entityId: text('entity_id').notNull(),
		op: text('op', { enum: ['create', 'update', 'archive', 'unarchive', 'delete'] }).notNull(),
		before: text('before'),
		after: text('after'),
		shape: integer('shape').notNull(),
		reverts: text('reverts').references((): AnySQLiteColumn => change.id)
	},
	(t) => [
		index('change_batch_id_seq_idx').on(t.batchId, t.seq),
		index('change_entity_entity_id_idx').on(t.entity, t.entityId),
		index('change_reverts_idx').on(t.reverts)
	]
);

const named = {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	name: text('name').notNull(),
	nameKey: text('name_key').notNull(),
	archivedAt: integer('archived_at'),
	version: integer('version').notNull(),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
};

export const customer = sqliteTable('customer', { ...named }, (t) => [
	index('customer_user_id_idx').on(t.userId),
	uniqueIndex('customer_user_id_name_key_unq').on(t.userId, t.nameKey)
]);

export const project = sqliteTable(
	'project',
	{
		...named,
		customerId: text('customer_id')
			.notNull()
			.references(() => customer.id)
	},
	(t) => [
		index('project_user_id_idx').on(t.userId),
		uniqueIndex('project_customer_id_name_key_unq').on(t.customerId, t.nameKey)
	]
);

export const activity = sqliteTable('activity', { ...named }, (t) => [
	index('activity_user_id_idx').on(t.userId),
	uniqueIndex('activity_user_id_name_key_unq').on(t.userId, t.nameKey)
]);

export const location = sqliteTable('location', { ...named }, (t) => [
	index('location_user_id_idx').on(t.userId),
	uniqueIndex('location_user_id_name_key_unq').on(t.userId, t.nameKey)
]);

export const entry = sqliteTable(
	'entry',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		projectId: text('project_id')
			.notNull()
			.references(() => project.id),
		activityId: text('activity_id').references(() => activity.id),
		locationId: text('location_id').references(() => location.id),
		startAt: integer('start_at').notNull(),
		startZone: text('start_zone').notNull(),
		endAt: integer('end_at'),
		endZone: text('end_zone'),
		reference: text('reference'),
		description: text('description'),
		version: integer('version').notNull(),
		createdAt: integer('created_at').notNull(),
		updatedAt: integer('updated_at').notNull()
	},
	(t) => [
		index('entry_user_id_start_at_idx').on(t.userId, t.startAt),
		index('entry_user_id_end_at_idx').on(t.userId, t.endAt),
		index('entry_project_id_idx').on(t.projectId)
	]
);

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Batch = typeof batch.$inferSelect;
export type Change = typeof change.$inferSelect;
export type Customer = typeof customer.$inferSelect;
export type Project = typeof project.$inferSelect;
export type Activity = typeof activity.$inferSelect;
export type Location = typeof location.$inferSelect;
export type Entry = typeof entry.$inferSelect;
