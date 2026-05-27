"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = __importDefault(require("../config/db"));
const user_model_1 = require("../models/user.model");
const getArgValue = (name) => {
    var _a;
    const prefix = `--${name}=`;
    const directValue = process.argv.find((arg) => arg.startsWith(prefix));
    if (directValue)
        return directValue.slice(prefix.length).trim();
    const index = process.argv.indexOf(`--${name}`);
    if (index !== -1)
        return (_a = process.argv[index + 1]) === null || _a === void 0 ? void 0 : _a.trim();
    return "";
};
const getInput = () => {
    const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
    const positionalEmail = positionalArgs[0] || "";
    const positionalPassword = positionalArgs[1] || "";
    const positionalName = positionalArgs.slice(2).join(" ");
    const fullName = getArgValue("name") ||
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
const createAdmin = () => __awaiter(void 0, void 0, void 0, function* () {
    const input = getInput();
    yield (0, db_1.default)();
    const hashedPassword = yield bcryptjs_1.default.hash(input.password, 10);
    const existingUser = yield user_model_1.User.findOne({ email: input.email }).select("+password");
    if (existingUser) {
        existingUser.fullName = input.fullName;
        existingUser.password = hashedPassword;
        existingUser.role = user_model_1.UserRole.ADMIN;
        existingUser.isVerified = true;
        existingUser.emailVerificationToken = undefined;
        existingUser.emailVerificationExpires = undefined;
        yield existingUser.save();
        console.log(`Admin account updated: ${input.email}`);
        return;
    }
    yield user_model_1.User.create({
        fullName: input.fullName,
        email: input.email,
        password: hashedPassword,
        role: user_model_1.UserRole.ADMIN,
        isVerified: true,
    });
    console.log(`Admin account created: ${input.email}`);
});
createAdmin()
    .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
})
    .finally(() => __awaiter(void 0, void 0, void 0, function* () {
    yield mongoose_1.default.disconnect();
}));
