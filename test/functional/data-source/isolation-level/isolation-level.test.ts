import "reflect-metadata"
import {
    closeTestingConnections,
    createTestingConnections,
} from "../../../utils/test-utils"
import { IsolationLevels } from "../../../../src/driver/types/IsolationLevel"
import { MysqlDriver } from "../../../../src/driver/mysql/MysqlDriver"
import { PostgresDriver } from "../../../../src/driver/postgres/PostgresDriver"
import { CockroachDriver } from "../../../../src/driver/cockroachdb/CockroachDriver"
import { SqlServerDriver } from "../../../../src/driver/sqlserver/SqlServerDriver"
import { OracleDriver } from "../../../../src/driver/oracle/OracleDriver"
import { SapDriver } from "../../../../src/driver/sap/SapDriver"
import { AbstractSqliteDriver } from "../../../../src/driver/sqlite-abstract/AbstractSqliteDriver"
import { SpannerDriver } from "../../../../src/driver/spanner/SpannerDriver"
import type { DatabaseType } from "../../../../src/driver/types/DatabaseType"
import type { IsolationLevel } from "../../../../src/driver/types/IsolationLevel"

const driverConfigs: {
    enabledDrivers: DatabaseType[]
    supportedLevels: readonly IsolationLevel[]
}[] = [
    {
        enabledDrivers: ["mysql"],
        supportedLevels: MysqlDriver.supportedIsolationLevels,
    },
    {
        enabledDrivers: ["postgres"],
        supportedLevels: PostgresDriver.supportedIsolationLevels,
    },
    {
        enabledDrivers: ["cockroachdb"],
        supportedLevels: CockroachDriver.supportedIsolationLevels,
    },
    {
        enabledDrivers: ["mssql"],
        supportedLevels: SqlServerDriver.supportedIsolationLevels,
    },
    {
        enabledDrivers: ["oracle"],
        supportedLevels: OracleDriver.supportedIsolationLevels,
    },
    {
        enabledDrivers: ["sap"],
        supportedLevels: SapDriver.supportedIsolationLevels,
    },
    {
        enabledDrivers: ["better-sqlite3", "sqljs"],
        supportedLevels: AbstractSqliteDriver.supportedIsolationLevels,
    },
    {
        enabledDrivers: ["spanner"],
        supportedLevels: SpannerDriver.supportedIsolationLevels,
    },
]

describe("data source > isolation level", () => {
    for (const { enabledDrivers, supportedLevels } of driverConfigs) {
        const driverName = enabledDrivers.join(" / ")
        const unsupportedLevels = IsolationLevels.filter(
            (level) => !supportedLevels.includes(level),
        )

        describe(driverName, () => {
            describe("supported", () => {
                for (const level of supportedLevels) {
                    it(level, async () => {
                        const dataSources = await createTestingConnections({
                            entities: [],
                            enabledDrivers,
                            driverSpecific: {
                                isolationLevel: level,
                            },
                        })
                        await closeTestingConnections(dataSources)
                    })
                }
            })

            describe("unsupported", () => {
                for (const level of unsupportedLevels) {
                    it(level, async () => {
                        await createTestingConnections({
                            entities: [],
                            enabledDrivers,
                            driverSpecific: {
                                isolationLevel: level,
                            },
                        }).should.be.rejectedWith("is not supported")
                    })
                }
            })
        })
    }
})
