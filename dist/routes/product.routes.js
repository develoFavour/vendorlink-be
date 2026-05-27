"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const product_controller_1 = require("../controllers/product.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
router.get("/public", product_controller_1.productController.getPublicProducts);
router.get("/public/:id", product_controller_1.productController.getPublicProductById);
router.use(auth_middleware_1.protect);
router
    .route("/")
    .get((0, auth_middleware_1.authorize)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), product_controller_1.productController.getVendorProducts)
    .post((0, auth_middleware_1.authorize)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), upload_middleware_1.productImageUpload, product_controller_1.productController.createProduct);
router
    .route("/:id")
    .get((0, auth_middleware_1.authorize)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), product_controller_1.productController.getProductById)
    .patch((0, auth_middleware_1.authorize)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), upload_middleware_1.productImageUpload, product_controller_1.productController.updateProduct)
    .delete((0, auth_middleware_1.authorize)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), product_controller_1.productController.deleteProduct);
exports.default = router;
