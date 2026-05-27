"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const product_routes_1 = __importDefault(require("./routes/product.routes"));
const wishlist_routes_1 = __importDefault(require("./routes/wishlist.routes"));
const cart_routes_1 = __importDefault(require("./routes/cart.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const conversation_routes_1 = __importDefault(require("./routes/conversation.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const earning_routes_1 = __importDefault(require("./routes/earning.routes"));
const vendor_routes_1 = __importDefault(require("./routes/vendor.routes"));
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Base Route
app.get('/', (req, res) => {
    res.send('E-commerce API is running...');
});
// Routes will be imported and used here
app.use('/api/v1/auth', auth_routes_1.default);
app.use('/api/v1/products', product_routes_1.default);
app.use('/api/v1/wishlist', wishlist_routes_1.default);
app.use('/api/v1/cart', cart_routes_1.default);
app.use('/api/v1/orders', order_routes_1.default);
app.use('/api/v1/conversations', conversation_routes_1.default);
app.use('/api/v1/dashboard', dashboard_routes_1.default);
app.use('/api/v1/reviews', review_routes_1.default);
app.use('/api/v1/admin', admin_routes_1.default);
app.use('/api/v1/earnings', earning_routes_1.default);
app.use('/api/v1/vendors', vendor_routes_1.default);
// Global Error Handler Middleware
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});
exports.default = app;
