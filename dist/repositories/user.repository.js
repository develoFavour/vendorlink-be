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
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const user_model_1 = require("../models/user.model");
class UserRepository {
    create(userData) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = new user_model_1.User(userData);
            return yield user.save();
        });
    }
    findByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            // Include password field explicitly since it's select: false in schema
            return yield user_model_1.User.findOne({ email }).select("+password");
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield user_model_1.User.findById(id);
        });
    }
    findByVerificationToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield user_model_1.User.findOne({
                emailVerificationToken: token,
                emailVerificationExpires: { $gt: new Date() },
            }).select("+emailVerificationToken +emailVerificationExpires");
        });
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
