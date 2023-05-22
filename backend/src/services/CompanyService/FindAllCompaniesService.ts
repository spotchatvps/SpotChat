import Company from "../../models/Company";
import Setting from "../../models/Setting";

const FindAllCompanyService = async (): Promise<Company[]> => {
  const companies = await Company.findAll({
    order: [["name", "ASC"]],
    include: [
      { model: Setting, as: "settings" }
    ]
  });
  return companies;
};

export default FindAllCompanyService;
