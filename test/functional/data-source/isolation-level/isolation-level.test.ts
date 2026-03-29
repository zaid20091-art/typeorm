import "reflect-metadata"
import {
    closeTestingConnections,
    createTestingConnections,
} from "../../../utils/test-utils"
import { IsolationLevels } from "../../../../src/driver/types/IsolationLevel"
import { DataSource } from "../../../../src/data-source/DataSource"

describe("data source > isolation level", () => {
    let dataSources: DataSource[]
    before(async () => {
        dataSources = await createTestingConnections({
            entities: [],
        })
    })
    after(() => closeTestingConnections(dataSources))

    it("should accept supported isolation levels at initialization", () =>
        Promise.all(
            dataSources.map(async (dataSource) => {
                for (const level of dataSource.driver
                    .supportedIsolationLevels) {
                    const ds = new DataSource({
                        ...dataSource.options,
                        isolationLevel: level,
                    })
                    await ds.initialize()
                    await ds.destroy()
                }
            }),
        ))

    it("should reject unsupported isolation levels at initialization", () =>
        Promise.all(
            dataSources.map(async (dataSource) => {
                const unsupported = IsolationLevels.filter(
                    (level) =>
                        !dataSource.driver.supportedIsolationLevels.includes(
                            level,
                        ),
                )

                for (const level of unsupported) {
                    const ds = new DataSource({
                        ...dataSource.options,
                        isolationLevel: level,
                    })
                    await ds
                        .initialize()
                        .should.be.rejectedWith("is not supported")
                }
            }),
        ))
})
