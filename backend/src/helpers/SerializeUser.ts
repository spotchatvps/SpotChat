import Queue from "../models/Queue";
import Company from "../models/Company";
import User from "../models/User";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  companyId: number;
  company: Company | null;
  super: boolean;
  queues: Queue[];
}

export const SerializeUser = async (user: User): Promise<SerializedUser> => {
  const companyId = user.selectedCompanyId || user.companyId;

  let queues = user.queues;

  if (user.selectedCompanyId) {
    await user.reload({
      include: [{ model: Queue, as: "selectedCompanyQueues" }]
    });
    queues = user.selectedCompanyQueues;
  }

  const company = await Company.findByPk(companyId);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: companyId,
    company: company,
    super: user.super,
    queues
  };
};
