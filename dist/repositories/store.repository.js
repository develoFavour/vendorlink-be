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
exports.storeRepository = exports.StoreRepository = void 0;
const store_model_1 = require("../models/store.model");
class StoreRepository {
    create(storeData) {
        return __awaiter(this, void 0, void 0, function* () {
            const store = new store_model_1.Store(storeData);
            return yield store.save();
        });
    }
    findByVendorId(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield store_model_1.Store.findOne({ vendorId });
        });
    }
    findBySlug(slug) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield store_model_1.Store.findOne({ slug });
        });
    }
}
exports.StoreRepository = StoreRepository;
exports.storeRepository = new StoreRepository();
