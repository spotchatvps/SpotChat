import User from "../../models/User";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Company from "../../models/Company";

const ShowUserService = async (id: string | number): Promise<User> => {
  if (id === null) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const user = await User.findByPk(id, {
    attributes: [
      "name",
      "id",
      "email",
      "companyId",
      "profile",
      "super",
      "selectedCompanyId",
      "tokenVersion"
    ],
    include: [
      { model: Queue, as: "queues", attributes: ["id", "name", "color"] },
      {
        model: Queue,
        as: "selectedCompanyQueues",
        attributes: ["id", "name", "color"]
      },
      { model: Company, as: "company", attributes: ["id", "name"] }
    ]
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  return user;
};

export default ShowUserService;
