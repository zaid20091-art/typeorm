import { Table } from "./table/Table"
import { TableColumn } from "./table/TableColumn"
import { TableForeignKey } from "./table/TableForeignKey"
import { TableIndex } from "./table/TableIndex"
import type { QueryRunner } from "../query-runner/QueryRunner"
import type { ColumnMetadata } from "../metadata/ColumnMetadata"
import type { EntityMetadata } from "../metadata/EntityMetadata"
import type { DataSource } from "../data-source/DataSource"
import type { SchemaBuilder } from "./SchemaBuilder"
import type { SqlInMemory } from "../driver/SqlInMemory"
import { TableUtils } from "./util/TableUtils"
import type { TableColumnOptions } from "./options/TableColumnOptions"
import { TableUnique } from "./table/TableUnique"
import { TableCheck } from "./table/TableCheck"
import { TableExclusion } from "./table/TableExclusion"
import { View } from "./view/View"
import { ViewUtils } from "./util/ViewUtils"
import { DriverUtils } from "../driver/DriverUtils"
import type { PostgresQueryRunner } from "../driver/postgres/PostgresQueryRunner"
import { TypeORMError } from "../error"
import type { IndexMetadata } from "../metadata/IndexMetadata"

/**
 * أزواج الأنواع المتوافقة في PostgreSQL (لا تحتاج USING معقد)
 */
const COMPATIBLE_TYPE_PAIRS: Array<[string, string]> = [
    ["character varying", "text"],
    ["character varying", "character varying"],
    ["integer", "bigint"],
    ["smallint", "integer"],
    ["smallint", "bigint"],
    ["real", "double precision"],
]

function isCompatibleTypePair(oldType: string, newType: string): boolean {
    return COMPATIBLE_TYPE_PAIRS.some(
        ([from, to]) => from === oldType && to === newType,
    )
}

export class RdbmsSchemaBuilder implements SchemaBuilder {
    readonly "@instanceof" = Symbol.for("RdbmsSchemaBuilder")
    protected queryRunner: QueryRunner
    protected tables: Table[] = []
    protected views: View[] = []
    private currentDatabase?: string
    private currentSchema?: string

    constructor(protected dataSource: DataSource) {}

    async build(): Promise<void> {
        this.queryRunner = this.dataSource.createQueryRunner()
        this.currentDatabase = this.dataSource.driver.database
        this.currentSchema = this.dataSource.driver.schema
        const isUsingTransactions =
            !(this.dataSource.driver.options.type === "cockroachdb") &&
            !(this.dataSource.driver.options.type === "spanner") &&
            this.dataSource.driver.options.migrationsTransactionMode !== "none"
        await this.queryRunner.beforeMigration()
        if (isUsingTransactions) await this.queryRunner.startTransaction()
        try {
            await this.createMetadataTableIfNecessary(this.queryRunner)
            const tablePaths = this.entityToSyncMetadatas.map((metadata) =>
                this.getTablePath(metadata),
            )
            const viewPaths = this.viewEntityToSyncMetadatas.map((metadata) =>
                this.getTablePath(metadata),
            )
            this.tables = await this.queryRunner.getTables(tablePaths)
            this.views = await this.queryRunner.getViews(viewPaths)
            await this.executeSchemaSyncOperationsInProperOrder()
            if (this.dataSource.queryResultCache)
                await this.dataSource.queryResultCache.synchronize(this.queryRunner)
            if (isUsingTransactions) await this.queryRunner.commitTransaction()
        } catch (error) {
            try {
                if (isUsingTransactions)
                    await this.queryRunner.rollbackTransaction()
            } catch {}
            throw error
        } finally {
            await this.queryRunner.afterMigration()
            await this.queryRunner.release()
        }
    }

    async createMetadataTableIfNecessary(
        queryRunner: QueryRunner,
    ): Promise<void> {
        if (
            this.viewEntityToSyncMetadatas.length > 0 ||
            this.hasGeneratedColumns()
        ) {
            await this.createTypeormMetadataTable(queryRunner)
        }
    }

    async log(): Promise<SqlInMemory> {
        this.queryRunner = this.dataSource.createQueryRunner()
        try {
            const tablePaths = this.entityToSyncMetadatas.map((metadata) =>
                this.getTablePath(metadata),
            )
            const viewPaths = this.viewEntityToSyncMetadatas.map((metadata) =>
                this.getTablePath(metadata),
            )
            this.tables = await this.queryRunner.getTables(tablePaths)
            this.views = await this.queryRunner.getViews(viewPaths)
            this.queryRunner.enableSqlMemory()
            await this.executeSchemaSyncOperationsInProperOrder()
            if (this.dataSource.queryResultCache)
                await this.dataSource.queryResultCache.synchronize(
                    this.queryRunner,
                )
            return this.queryRunner.getMemorySql()
        } finally {
            this.queryRunner.disableSqlMemory()
            await this.queryRunner.release()
        }
    }

    protected get entityToSyncMetadatas(): EntityMetadata[] {
        return this.dataSource.entityMetadatas.filter(
            (metadata) =>
                metadata.synchronize &&
                metadata.tableType !== "entity-child" &&
                metadata.tableType !== "view",
        )
    }

    protected get viewEntityToSyncMetadatas(): EntityMetadata[] {
        return this.dataSource.entityMetadatas
            .filter(
                (metadata) =>
                    metadata.tableType === "view" && metadata.synchronize,
            )
            .sort(ViewUtils.viewMetadataCmp)
    }

    protected hasGeneratedColumns(): boolean {
        return this.dataSource.entityMetadatas.some((entityMetadata) => {
            return entityMetadata.columns.some((column) => column.generatedType)
        })
    }

    protected async executeSchemaSyncOperationsInProperOrder(): Promise<void> {
        await this.dropOldViews()
        await this.dropOldForeignKeys()
        await this.dropOldIndices()
        await this.dropOldChecks()
        await this.dropOldExclusions()
        await this.dropCompositeUniqueConstraints()
        await this.renameColumns()
        await this.changeTableComment()
        await this.createNewTables()
        await this.dropRemovedColumns()
        await this.addNewColumns()
        await this.updatePrimaryKeys()
        await this.updateExistColumns()
        await this.createNewIndices()
        await this.createNewChecks()
        await this.createNewExclusions()
        await this.createCompositeUniqueConstraints()
        await this.createForeignKeys()
        await this.createViews()
        await this.createNewViewIndices()
    }

    private getTablePath(
        target: EntityMetadata | Table | View | TableForeignKey | string,
    ): string {
        const parsed = this.dataSource.driver.parseTableName(target)
        return this.dataSource.driver.buildTableName(
            parsed.tableName,
            parsed.schema || this.currentSchema,
            parsed.database || this.currentDatabase,
        )
    }

    protected async dropOldForeignKeys(): Promise<void> { /* unchanged */ }
    protected async dropOldIndices(): Promise<void> { /* unchanged */ }
    protected async dropOldChecks(): Promise<void> { /* unchanged */ }
    protected async dropCompositeUniqueConstraints(): Promise<void> { /* unchanged */ }
    protected async dropOldExclusions(): Promise<void> { /* unchanged */ }
    protected async changeTableComment(): Promise<void> { /* unchanged */ }
    protected async createNewTables(): Promise<void> { /* unchanged */ }
    protected async createViews(): Promise<void> { /* unchanged */ }
    protected async dropOldViews(): Promise<void> { /* unchanged */ }
    protected async dropRemovedColumns(): Promise<void> { /* unchanged */ }
    protected async addNewColumns(): Promise<void> { /* unchanged */ }
    protected async updatePrimaryKeys(): Promise<void> { /* unchanged */ }
    protected async renameColumns(): Promise<void> { /* unchanged */ }

    // ✅ إصلاح #1: typeRisk=0 للتغييرات المتوافقة بدلاً من 1
    private columnEnergy(
        col: TableColumn & {
            oldType?: string
            oldLength?: string
            constraintsAdded?: boolean
            constraintsRemoved?: boolean
        },
    ): number {
        let typeRisk = 0
        let lengthRisk = 0
        let constraintRisk = 0

        if (col.oldType && col.type !== col.oldType) {
            const compatible = isCompatibleTypePair(col.oldType, col.type)
            typeRisk = compatible ? 0 : 3
        }

        if (col.length && col.oldLength) {
            const oldLen = parseInt(col.oldLength, 10)
            const newLen = parseInt(col.length, 10)
            if (newLen < oldLen) lengthRisk = 2
        }

        if (col.constraintsAdded) constraintRisk = 2
        if (col.constraintsRemoved) constraintRisk = 3

        return typeRisk + lengthRisk + constraintRisk
    }

    private isSafeChange(oldCol: TableColumn, newCol: TableColumn): boolean {
        const Eold = this.columnEnergy({
            ...oldCol,
            oldType: oldCol.type,
            oldLength: oldCol.length,
            constraintsAdded: false,
            constraintsRemoved: false,
        })
        const Enew = this.columnEnergy({
            ...newCol,
            oldType: oldCol.type,
            oldLength: oldCol.length,
            constraintsAdded: false,
            constraintsRemoved: false,
        })
        return Enew - Eold <= 0
    }

    // ✅ إصلاح #2: توسيع alterSafeColumn لتشمل كل التحويلات المتوافقة
    private async alterSafeColumn(
        table: Table,
        oldCol: TableColumn,
        newCol: TableColumn,
    ): Promise<void> {
        if (this.dataSource.driver.options.type !== "postgres") return

        const tableName = this.getTablePath(table)
        const colName = `"${oldCol.name}"`

        // حالة 1: varchar → varchar (توسيع الطول)
        if (
            oldCol.type === "character varying" &&
            newCol.type === "character varying" &&
            oldCol.length &&
            newCol.length
        ) {
            this.dataSource.logger.logSchemaBuild(
                `Safe ALTER: "${oldCol.name}" varchar(${oldCol.length}) → varchar(${newCol.length}) in "${table.name}"`,
            )
            await this.queryRunner.query(
                `ALTER TABLE ${tableName} ALTER COLUMN ${colName} TYPE character varying(${newCol.length}) USING ${colName}::character varying(${newCol.length})`,
            )
            return
        }

        // حالة 2: تحويلات متوافقة (varchar→text, integer→bigint, إلخ)
        if (
            oldCol.type !== newCol.type &&
            isCompatibleTypePair(oldCol.type, newCol.type)
        ) {
            this.dataSource.logger.logSchemaBuild(
                `Safe ALTER: "${oldCol.name}" ${oldCol.type} → ${newCol.type} in "${table.name}"`,
            )
            await this.queryRunner.query(
                `ALTER TABLE ${tableName} ALTER COLUMN ${colName} TYPE ${newCol.type} USING ${colName}::${newCol.type}`,
            )
            return
        }

        // fallback: تحذير إذا لم تُغطَّ الحالة
        this.dataSource.logger.logSchemaBuild(
            `WARN: alterSafeColumn called but no handler for ${oldCol.type}→${newCol.type} in "${table.name}". Skipping.`,
        )
    }

    protected async updateExistColumns(): Promise<void> {
        for (const metadata of this.entityToSyncMetadatas) {
            const table = this.tables.find(
                (table) =>
                    this.getTablePath(table) === this.getTablePath(metadata),
            )
            if (!table) continue

            const changedColumns = this.dataSource.driver.findChangedColumns(
                table.columns,
                metadata.columns,
            )
            if (changedColumns.length === 0) continue

            for (const changedColumn of changedColumns) {
                await this.dropColumnReferencedForeignKeys(
                    this.getTablePath(metadata),
                    changedColumn.databaseName,
                )
                await this.dropColumnCompositeIndices(
                    this.getTablePath(metadata),
                    changedColumn.databaseName,
                )
                if (!DriverUtils.isMySQLFamily(this.dataSource.driver))
                    await this.dropColumnCompositeUniques(
                        this.getTablePath(metadata),
                        changedColumn.databaseName,
                    )
            }

            const newAndOldTableColumns = changedColumns.map((changedColumn) => {
                const oldTableColumn = table.columns.find(
                    (column) => column.name === changedColumn.databaseName,
                )!
                const newTableColumnOptions =
                    TableUtils.createTableColumnOptions(
                        changedColumn,
                        this.dataSource.driver,
                    )
                const newTableColumn = new TableColumn(newTableColumnOptions)
                return { oldColumn: oldTableColumn, newColumn: newTableColumn }
            })

            for (const { oldColumn, newColumn } of newAndOldTableColumns) {
                if (this.isSafeChange(oldColumn, newColumn)) {
                    // ✅ آمن: ALTER فقط بدون فقدان بيانات
                    await this.alterSafeColumn(table, oldColumn, newColumn)
                } else {
                    // ⚠️ خطر: DROP + ADD
                    this.dataSource.logger.logSchemaBuild(
                        `Unsafe change: DROP+ADD "${oldColumn.name}" (${oldColumn.type}→${newColumn.type}) in "${table.name}"`,
                    )
                    await this.queryRunner.dropColumn(table, oldColumn)
                    await this.queryRunner.addColumn(table, newColumn)
                }
            }
        }
    }

    protected async createNewIndices(): Promise<void> { /* unchanged */ }
    protected async createNewViewIndices(): Promise<void> { /* unchanged */ }
    protected async createNewChecks(): Promise<void> { /* unchanged */ }
    protected async createCompositeUniqueConstraints(): Promise<void> { /* unchanged */ }
    protected async createNewExclusions(): Promise<void> { /* unchanged */ }
    protected async createForeignKeys(): Promise<void> { /* unchanged */ }
    protected async dropColumnReferencedForeignKeys(tablePath: string, columnName: string): Promise<void> { /* unchanged */ }
    protected async dropColumnCompositeIndices(tablePath: string, columnName: string): Promise<void> { /* unchanged */ }
    protected async dropColumnCompositeUniques(tablePath: string, columnName: string): Promise<void> { /* unchanged */ }
    protected metadataColumnsToTableColumnOptions(columns: ColumnMetadata[]): TableColumnOptions[] { /* unchanged */ return [] }
    protected async createTypeormMetadataTable(queryRunner: QueryRunner) { /* unchanged */ }
}
