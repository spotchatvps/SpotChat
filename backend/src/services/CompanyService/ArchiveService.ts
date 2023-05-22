import moment from "moment";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";

interface ArchiveData {
  id: number | string;
  archived: boolean;
}

export async function ArchiveService(data: ArchiveData) {
  const { id, archived } = data;
  const company = await Company.findOne({ where: { id } });

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  if (archived === true) {
    await company.update({ archived, archivedAt: moment(), status: false });
  }

  if (archived === false) {
    await company.update({ archived, archivedAt: null });
  }

  return company;
}
