import {
    Column,
    Entity,
    OneToOne,
    PrimaryGeneratedColumn,
} from "../../../../../src"

@Entity()
export class Details {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    comment: string

    @OneToOne("Post", "details")
    post: any
}
