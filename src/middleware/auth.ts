import { RequestHandler } from "express";
import { sendErrorResp } from "src/utils/helper";
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import UserModel from "src/models/user";
import passResetTokenModel from "src/models/passwordResetToken";

interface UserProfile{
  id: string;
  name:string;
  email:string;
  verified:boolean,
  avatar?: string
}
declare global{
  namespace Express{
    interface Request{
      user:UserProfile
    }
  }

}
const JWT_SECRET = process.env.JWT_SECRET!
export const isAuth: RequestHandler = async (req, res, next) => {
  try {
    const authToken = req.headers.authorization;
    if (!authToken) return sendErrorResp(res, "Unauthorized request!", 403);

    const token = authToken.split('Bearer ')[1];
    if (!token) return sendErrorResp(res, "Unauthorized request!", 403);

    const payload = jwt.verify(token, JWT_SECRET) as { id: string };

    const user = await UserModel.findById(payload.id);
    if (!user) return sendErrorResp(res, "Unauthorized request, User doesn't exist", 403);

    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      verified: user.verified,
    };

    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return sendErrorResp(res, "Session Expired", 403);
    }
    if (error instanceof JsonWebTokenError) {
      return sendErrorResp(res, "Invalid Token", 403);
    }
    next(error);
  }
};

export const isValidPassResetToken: RequestHandler = async (req, res, next) => {
  const { id, token } = req.body;

  // Assuming passResetTokenModel has a method findOne to find the token by user ID
  const resetPassToken = await passResetTokenModel.findOne({ owner: id });

  // Check if token for the user ID exists
  if (!resetPassToken) {
    return sendErrorResp(res, "Unauthorized request, token not found", 403);
  }

  // Compare the token provided in the request with the stored token
  const matched = resetPassToken.compareToken(token);

  // If tokens do not match, send a 403 Forbidden response
  if (!matched) {
    return sendErrorResp(res, "Unauthorized request, token not matched", 403);
  }

  // If tokens match, proceed to the next middleware or route handler
  next();
};
