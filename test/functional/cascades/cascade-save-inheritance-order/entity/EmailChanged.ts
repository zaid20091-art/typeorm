import { ChildEntity } from "../../../../../src/index"
import { ChangeLog } from "./ChangeLog"

// STI child entity — no additional columns
export class Email {}

@ChildEntity()
export class EmailChanged extends ChangeLog<Email> {}
