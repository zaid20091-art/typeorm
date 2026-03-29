import { expect } from "chai"
import "reflect-metadata"
import { DataSource } from "../../../../src/data-source/DataSource"
import type { Repository } from "../../../../src/repository/Repository"
import { setupSingleTestingConnection } from "../../../utils/test-utils"
import { Category } from "./entity/Category"
import { CategoryMetadata } from "./entity/CategoryMetadata"
import { Post } from "./entity/Post"

describe("persistence > custom-column-names", function () {
    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    // connect to db
    let dataSource: DataSource
    before(async () => {
        const options = setupSingleTestingConnection("mysql", {
            entities: [Post, Category, CategoryMetadata],
        })
        if (!options) return

        dataSource = new DataSource(options)
    })
    after(() => dataSource.destroy())

    // clean up database before each test
    function reloadDatabase() {
        if (!dataSource) return
        return dataSource.synchronize(true).catch((e) => {
            throw e
        })
    }

    let postRepository: Repository<Post>
    let categoryRepository: Repository<Category>
    let metadataRepository: Repository<CategoryMetadata>
    before(() => {
        if (!dataSource) return
        postRepository = dataSource.getRepository(Post)
        categoryRepository = dataSource.getRepository(Category)
        metadataRepository = dataSource.getRepository(CategoryMetadata)
    })

    // -------------------------------------------------------------------------
    // Specifications
    // -------------------------------------------------------------------------

    describe("attach exist entity to exist entity with many-to-one relation", function () {
        if (!dataSource) return
        let newPost: Post, newCategory: Category, loadedPost: Post

        before(reloadDatabase)

        before(async () => {
            newCategory = categoryRepository.create()
            newCategory.name = "Animals"
            await categoryRepository.save(newCategory)
        })

        before(async () => {
            newPost = postRepository.create()
            newPost.title = "All about animals"
            await postRepository.save(newPost)
        })

        before(async () => {
            newPost.category = newCategory
            await postRepository.save(newPost)
        })

        before(async () => {
            const post = await postRepository.findOne({
                where: { id: 1 },
                relations: { category: true },
            })
            loadedPost = post!
        })

        it("should contain attached category", function () {
            expect(loadedPost).not.to.be.undefined
            expect(loadedPost.category).not.to.be.undefined
            expect(loadedPost.categoryId).not.to.be.undefined
        })
    })

    describe("attach new entity to exist entity with many-to-one relation", function () {
        if (!dataSource) return
        let newPost: Post, newCategory: Category, loadedPost: Post

        before(reloadDatabase)

        before(async () => {
            newCategory = categoryRepository.create()
            newCategory.name = "Animals"
            await categoryRepository.save(newCategory)
        })

        before(async () => {
            newPost = postRepository.create()
            newPost.title = "All about animals"
            newPost.category = newCategory
            await postRepository.save(newPost)
        })

        before(async () => {
            const post = await postRepository.findOne({
                where: { id: 1 },
                relations: { category: true },
            })
            loadedPost = post!
        })

        it("should contain attached category", function () {
            expect(loadedPost).not.to.be.undefined
            expect(loadedPost.category).not.to.be.undefined
            expect(loadedPost.categoryId).not.to.be.undefined
        })
    })

    describe("attach new entity to new entity with many-to-one relation", function () {
        if (!dataSource) return
        let newPost: Post, newCategory: Category, loadedPost: Post

        before(reloadDatabase)

        before(async () => {
            newCategory = categoryRepository.create()
            newCategory.name = "Animals"
            newPost = postRepository.create()
            newPost.title = "All about animals"
            newPost.category = newCategory
            await postRepository.save(newPost)
        })

        before(async () => {
            const post = await postRepository.findOne({
                where: { id: 1 },
                relations: { category: true },
            })
            loadedPost = post!
        })

        it("should contain attached category", function () {
            expect(loadedPost).not.to.be.undefined
            expect(loadedPost.category).not.to.be.undefined
            expect(loadedPost.categoryId).not.to.be.undefined
        })
    })

    describe("attach exist entity to exist entity with one-to-one relation", function () {
        if (!dataSource) return
        let newPost: Post,
            newCategory: Category,
            newMetadata: CategoryMetadata,
            loadedPost: Post

        before(reloadDatabase)

        before(async () => {
            newPost = postRepository.create()
            newPost.title = "All about animals"
            await postRepository.save(newPost)
        })

        before(async () => {
            newCategory = categoryRepository.create()
            newCategory.name = "Animals"
            await categoryRepository.save(newCategory)
        })

        before(async () => {
            newMetadata = metadataRepository.create()
            newMetadata.keyword = "animals"
            await metadataRepository.save(newMetadata)
        })

        before(async () => {
            newCategory.metadata = newMetadata
            newPost.category = newCategory
            await postRepository.save(newPost)
        })

        before(async () => {
            const post = await postRepository.findOne({
                where: { id: 1 },
                relations: { category: { metadata: true } },
            })
            loadedPost = post!
        })

        it("should contain attached category and metadata in the category", function () {
            expect(loadedPost).not.to.be.undefined
            expect(loadedPost.category).not.to.be.undefined
            expect(loadedPost.categoryId).not.to.be.undefined
            expect(loadedPost.category.metadata).not.to.be.undefined
            expect(loadedPost.category.metadataId).not.to.be.undefined
        })
    })

    describe("attach new entity to exist entity with one-to-one relation", function () {
        if (!dataSource) return
        let newPost: Post,
            newCategory: Category,
            newMetadata: CategoryMetadata,
            loadedPost: Post

        before(reloadDatabase)

        before(async () => {
            newPost = postRepository.create()
            newPost.title = "All about animals"
            await postRepository.save(newPost)
        })

        before(async () => {
            newMetadata = metadataRepository.create()
            newMetadata.keyword = "animals"
            newCategory = categoryRepository.create()
            newCategory.name = "Animals"
            newCategory.metadata = newMetadata
            await categoryRepository.save(newCategory)
        })

        before(async () => {
            newPost.category = newCategory
            await postRepository.save(newPost)
        })

        before(async () => {
            const post = await postRepository.findOne({
                where: { id: 1 },
                relations: { category: { metadata: true } },
            })
            loadedPost = post!
        })

        it("should contain attached category and metadata in the category", function () {
            expect(loadedPost).not.to.be.undefined
            expect(loadedPost.category).not.to.be.undefined
            expect(loadedPost.categoryId).not.to.be.undefined
            expect(loadedPost.category.metadata).not.to.be.undefined
            expect(loadedPost.category.metadataId).not.to.be.undefined
        })
    })
})
