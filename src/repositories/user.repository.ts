import { User, IUser } from "../models/user.model";

export class UserRepository {
  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return await user.save();
  }

  async findByEmail(email: string): Promise<IUser | null> {
    // Include password field explicitly since it's select: false in schema
    return await User.findOne({ email }).select("+password");
  }

  async findById(id: string): Promise<IUser | null> {
    return await User.findById(id);
  }

  async findByVerificationToken(token: string): Promise<IUser | null> {
    return await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    }).select("+emailVerificationToken +emailVerificationExpires");
  }
}

export const userRepository = new UserRepository();
