import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default
} from "sequelize-typescript";
import Queue from "./Queue";

@Table
class QueueOption extends Model<QueueOption> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  title: string;

  @AllowNull
  @Column
  message: string;

  @AllowNull
  @Column
  option: string;

  @Default("BUTTON_LIST")
  @Column
  optionType: string;

  @AllowNull
  @Column
  fileType: string;

  @AllowNull
  @Column
  fileName: string;

  @AllowNull
  @Column
  path: string;

  @AllowNull
  @Column
  finalize: boolean;

  @AllowNull
  @Column
  waitTreatment: boolean;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @ForeignKey(() => QueueOption)
  @Column
  parentId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @BelongsTo(() => Queue)
  queue: Queue;

  @BelongsTo(() => QueueOption, { foreignKey: "parentId" })
  parent: QueueOption;
}

export default QueueOption;
