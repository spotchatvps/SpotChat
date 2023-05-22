import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Companies", "archived", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      }),
      queryInterface.addColumn("Companies", "archivedAt", {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Companies", "archived"),
      queryInterface.removeColumn("Companies", "archivedAt")
    ]);
  }
};
