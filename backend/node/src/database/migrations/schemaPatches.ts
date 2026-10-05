import { DataTypes } from 'sequelize';
import { sequelize } from '../../models/index.js';
import { logger } from '../../utils/logger.js';

interface ColumnPatch {
  table: string;
  column: string;
  definition: Parameters<ReturnType<typeof sequelize.getQueryInterface>['addColumn']>[2];
}

/**
 * Columns added after the first release. `sequelize.sync()` only creates missing
 * tables, so existing databases get new columns from here. Idempotent.
 */
const COLUMN_PATCHES: ColumnPatch[] = [
  {
    table: 'investment_plans',
    column: 'is_featured',
    definition: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    table: 'investment_plans',
    column: 'featured_tagline',
    definition: { type: DataTypes.STRING(160), allowNull: true },
  },
];

/**
 * Must run BEFORE `sequelize.sync()`: sync creates indexes on new columns and
 * fails if the column is missing. Tables that do not exist yet are skipped;
 * sync creates them complete.
 */
export async function applySchemaPatches(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  const existingTables = new Set(
    (await queryInterface.showAllTables()).map((t: any) => (typeof t === 'string' ? t : t.tableName))
  );
  const described = new Map<string, Record<string, unknown>>();

  for (const patch of COLUMN_PATCHES) {
    if (!existingTables.has(patch.table)) continue;
    if (!described.has(patch.table)) {
      described.set(patch.table, await queryInterface.describeTable(patch.table));
    }
    const columns = described.get(patch.table)!;
    if (columns[patch.column]) continue;

    await queryInterface.addColumn(patch.table, patch.column, patch.definition);
    columns[patch.column] = {};
    logger.info(`[SCHEMA] Added column ${patch.table}.${patch.column}`);
  }
}
