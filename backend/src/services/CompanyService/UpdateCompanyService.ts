import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Setting from "../../models/Setting";

interface CompanyData {
  name: string;
  id?: number | string;
  phone?: string;
  email?: string;
  status?: boolean;
  dueDate?: string;
  recurrence?: string;
  document?: string;
  paymentMethod?: string;
}

const UpdateCompanyService = async (
  companyData: CompanyData
): Promise<Company> => {
  const company = await Company.findByPk(companyData.id);
  const {
    name,
    phone,
    email,
    status,
    dueDate,
    recurrence,
    document,
    paymentMethod,
  } = companyData;

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  await company.update({
    name,
    phone,
    email,
    status,
    dueDate,
    recurrence,
    document,
    paymentMethod
  });

  return company;
};

export default UpdateCompanyService;
