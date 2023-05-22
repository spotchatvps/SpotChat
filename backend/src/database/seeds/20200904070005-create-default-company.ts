import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(t => {
      return Promise.all([
        queryInterface.bulkInsert(
          "Plans",
          [
            {
              name: "Plano 1",
              users: 10,
              connections: 10,
              queues: 10,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ],
          { transaction: t }
        ),
        queryInterface.bulkInsert(
          "Companies",
          [
            {
              name: "Empresa 1",
              planId: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ],
          { transaction: t }
        ),
        queryInterface.bulkInsert(
          "Settings",
          [
            {
              key: "queuesOptionType",
              value: "TEXT_LIST",
              companyId: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ],
          { transaction: t }
        )
      ]);
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.bulkDelete("Settings", {}),
      queryInterface.bulkDelete("Companies", {}),
      queryInterface.bulkDelete("Plans", {})
    ]);
  }
};
