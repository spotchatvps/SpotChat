import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Tickets", "protocol", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: ""
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return queryInterface.removeColumn("Tickets", "protocol");
  }
};
