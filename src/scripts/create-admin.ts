import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectDB from "../config/db";
import { User, UserRole } from "../models/user.model";

type AdminInput = {
  fullName: string;
  email: string;
  password: string;
};

const getArgValue = (name: string) => {
  const prefix = `--${name}=`;
  const directValue = process.argv.find((arg) => arg.startsWith(prefix));

  if (directValue) return directValue.slice(prefix.length).trim();

  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1) return process.argv[index + 1]?.trim();

  return "";
};

const getInput = (): AdminInput => {
  const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const positionalEmail = positionalArgs[0] || "";
  const positionalPassword = positionalArgs[1] || "";
  const positionalName = positionalArgs.slice(2).join(" ");
  const fullName =
    getArgValue("name") ||
    positionalName ||
    process.env.ADMIN_FULL_NAME ||
    "VendorLink Admin";
  const email = (getArgValue("email") || positionalEmail || process.env.ADMIN_EMAIL || "")
    .toLowerCase()
    .trim();
  const password = getArgValue("password") || positionalPassword || process.env.ADMIN_PASSWORD || "";

  if (!email) {
    throw new Error("Admin email is required. Pass --email or set ADMIN_EMAIL.");
  }

  if (!password || password.length < 8) {
    throw new Error("Admin password is required and must be at least 8 characters.");
  }

  return { fullName, email, password };
};

const createAdmin = async () => {
  const input = getInput();
  await connectDB();

  const hashedPassword = await bcrypt.hash(input.password, 10);
  const existingUser = await User.findOne({ email: input.email }).select("+password");

  if (existingUser) {
    existingUser.fullName = input.fullName;
    existingUser.password = hashedPassword;
    existingUser.role = UserRole.ADMIN;
    existingUser.isVerified = true;
    existingUser.emailVerificationToken = undefined;
    existingUser.emailVerificationExpires = undefined;
    await existingUser.save();

    console.log(`Admin account updated: ${input.email}`);
    return;
  }

  await User.create({
    fullName: input.fullName,
    email: input.email,
    password: hashedPassword,
    role: UserRole.ADMIN,
    isVerified: true,
  });

  console.log(`Admin account created: ${input.email}`);
};

createAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
