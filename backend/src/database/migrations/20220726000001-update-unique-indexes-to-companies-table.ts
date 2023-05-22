import { QueryInterface } from "sequelize";

module.exports = {
  up: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeConstraint("Companies", "Companies_name_key"),
      queryInterface.addConstraint("Companies", ["email"], {
        type: "unique",
        name: "Companies_email_key"
      })
    ]);
  },

  down: (queryInterface: QueryInterface) => {
    return Promise.all([
      queryInterface.removeConstraint("Companies", "Companies_email_key"),
      queryInterface.addConstraint("Companies", ["name"], {
        type: "unique",
        name: "Companies_name_key"
      })
    ]);
  }
};
