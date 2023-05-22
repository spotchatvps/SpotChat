import { sign } from "jsonwebtoken";
import authConfig from "../config/auth";
import User from "../models/User";

export const createAccessToken = (user: User): string => {
  const { secret, expiresIn } = authConfig;

  const companyId = user.selectedCompanyId || user.companyId;

  return sign(
    {
      usarname: user.name,
      profile: user.profile,
      id: user.id,
      companyId
    },
    secret,
    {
      expiresIn
    }
  );
};

export const createRefreshToken = (user: User): string => {
  const { refreshSecret, refreshExpiresIn } = authConfig;

  const companyId = user.selectedCompanyId || user.companyId;

  return sign(
    { id: user.id, tokenVersion: user.tokenVersion, companyId },
    refreshSecret,
    {
      expiresIn: refreshExpiresIn
    }
  );
};
