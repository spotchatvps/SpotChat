import { QueryInterface, DataTypes, Sequelize } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"').then(() => {
        return queryInterface.addColumn("Tickets", "uuid", {
          type: DataTypes.UUID,
          allowNull: true,
          defaultValue: Sequelize.literal('uuid_generate_v4()')
        })
      }),
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Tickets", "uuid");
  }
};
