import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  ForeignKey
} from "sequelize-typescript";
import Queue from "./Queue";
import User from "./User";

@Table({ tableName: "UserCompanySelectedQueues" })
class UserCompanySelectedQueue extends Model<UserCompanySelectedQueue> {
  @ForeignKey(() => User)
  @Column
  userId: number;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default UserCompanySelectedQueue;
