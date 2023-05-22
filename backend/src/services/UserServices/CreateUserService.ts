import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";
import Company from "../../models/Company";

interface Request {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  companyId?: number;
  profile?: string;
  selectedCompanyId?: number;
  selectedCompanyQueues?: number[];
}

interface Response {
  email: string;
  name: string;
  id: number;
  profile: string;
}

const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  companyId,
  profile = "admin",
  selectedCompanyId,
  selectedCompanyQueues = []
}: Request): Promise<Response> => {
  const usersLimit = +process.env.USERS || 1;
  const usersCount = await User.count({
    where: {
      companyId
    }
  });

  if (usersCount >= usersLimit) {
    throw new AppError(`Número máximo de usuários já alcançado: ${usersLimit}`);
  }

  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    email: Yup.string()
      .email()
      .required()
      .test(
        "Check-email",
        "An user with this email already exists.",
        async value => {
          if (!value) return false;
          const emailExists = await User.findOne({
            where: { email: value }
          });
          return !emailExists;
        }
      ),
    password: Yup.string().required().min(5)
  });

  try {
    await schema.validate({ email, password, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  const user = await User.create(
    {
      email,
      password,
      name,
      companyId,
      profile,
      selectedCompanyId
    },
    { include: ["queues", "company"] }
  );

  await user.$set("queues", queueIds);
  await user.$set("selectedCompanyQueues", selectedCompanyQueues);

  await user.reload();

  const serializedUser = SerializeUser(user);

  return serializedUser;
};

export default CreateUserService;
