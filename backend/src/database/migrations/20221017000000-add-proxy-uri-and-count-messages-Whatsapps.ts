import { QueryInterface, DataTypes, Sequelize } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.addColumn("Whatsapps", "proxy_uri", {
        type: DataTypes.TEXT,
        allowNull: true
      }),
      queryInterface.addColumn("Whatsapps", "proxy_set_at", {
        type: DataTypes.DATE,
        allowNull: true
      }),
      queryInterface.addColumn("Whatsapps", "count_messages", {
        type: DataTypes.INTEGER,
        defaultValue: 0
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeColumn("Whatsapps", "proxy_uri"),
      queryInterface.removeColumn("Whatsapps", "proxy_set_at"),
      queryInterface.removeColumn("Whatsapps", "count_messages")
    ]);
  }
};
