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
exports.sendWithdrawalStatusEmail = exports.sendOrderStatusEmail = exports.sendVerificationEmail = exports.sendWelcomeEmail = exports.sendEmail = void 0;
const brevoApiUrl = "https://api.brevo.com/v3/smtp/email";
const getSender = () => ({
    name: process.env.BREVO_SENDER_NAME || "VendorLink",
    email: process.env.BREVO_SENDER_EMAIL || "noreply@vendorlink.local",
});
const sendEmail = (_a) => __awaiter(void 0, [_a], void 0, function* ({ to, subject, htmlContent, textContent, }) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.warn("BREVO_API_KEY is not configured. Skipping transactional email.");
        return;
    }
    const response = yield fetch(brevoApiUrl, {
        method: "POST",
        headers: {
            accept: "application/json",
            "api-key": apiKey,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            sender: getSender(),
            to,
            subject,
            htmlContent,
            textContent,
        }),
    });
    if (!response.ok) {
        const errorBody = yield response.text();
        throw new Error(`Brevo email failed with status ${response.status}: ${errorBody}`);
    }
});
exports.sendEmail = sendEmail;
const sendWelcomeEmail = (_a) => __awaiter(void 0, [_a], void 0, function* ({ email, fullName, role, storeName, }) {
    const isVendor = role === "VENDOR";
    const subject = isVendor
        ? "Your VendorLink store registration was received"
        : "Welcome to VendorLink";
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="color: #2a2059;">Welcome to VendorLink, ${fullName}</h2>
      <p>
        ${isVendor
        ? `Your vendor account${storeName ? ` for <strong>${storeName}</strong>` : ""} has been created successfully. You can now start preparing your digital storefront.`
        : "Your customer account has been created successfully. You can now discover and buy products from local vendors."}
      </p>
      <p>Thank you for joining our local marketplace.</p>
    </div>
  `;
    yield (0, exports.sendEmail)({
        to: [{ email, name: fullName }],
        subject,
        htmlContent,
        textContent: `Welcome to VendorLink, ${fullName}. Your ${isVendor ? "vendor" : "customer"} account has been created successfully.`,
    });
});
exports.sendWelcomeEmail = sendWelcomeEmail;
const sendVerificationEmail = (_a) => __awaiter(void 0, [_a], void 0, function* ({ email, fullName, verificationUrl, }) {
    yield (0, exports.sendEmail)({
        to: [{ email, name: fullName }],
        subject: "Verify your VendorLink email",
        htmlContent: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #2a2059;">Verify your email address</h2>
        <p>Hello ${fullName},</p>
        <p>Confirm your email address to activate your VendorLink account.</p>
        <p>
          <a href="${verificationUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 18px; border-radius: 8px; text-decoration: none; font-weight: 700;">
            Verify Email
          </a>
        </p>
        <p>This link expires in 24 hours.</p>
      </div>
    `,
        textContent: `Hello ${fullName}, verify your VendorLink account here: ${verificationUrl}`,
    });
});
exports.sendVerificationEmail = sendVerificationEmail;
const sendOrderStatusEmail = (_a) => __awaiter(void 0, [_a], void 0, function* ({ email, fullName, orderNumber, status, orderUrl, note, itemNames, }) {
    const itemSummary = (itemNames === null || itemNames === void 0 ? void 0 : itemNames.length)
        ? itemNames.slice(0, 3).join(", ")
        : "your order items";
    yield (0, exports.sendEmail)({
        to: [{ email, name: fullName }],
        subject: `Order ${orderNumber} is now ${status}`,
        htmlContent: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #171714;">Order status updated</h2>
        <p>Hello ${fullName},</p>
        <p>Your VendorLink order <strong>${orderNumber}</strong> has a new status:</p>
        <div style="background: #fff1e8; color: #9f3e17; display: inline-block; padding: 10px 14px; border-radius: 999px; font-weight: 700;">
          ${status}
        </div>
        <p style="margin-top: 18px;">This update applies to <strong>${itemSummary}</strong>.</p>
        ${note
            ? `<p style="background: #f7f7f5; padding: 12px 14px; border-radius: 12px;"><strong>Seller note:</strong> ${note}</p>`
            : ""}
        <p>
          <a href="${orderUrl}" style="display: inline-block; background: #171714; color: #ffffff; padding: 12px 18px; border-radius: 12px; text-decoration: none; font-weight: 700;">
            View Order
          </a>
        </p>
        <p style="color: #6b7280;">Thank you for shopping with local vendors on VendorLink.</p>
      </div>
    `,
        textContent: `Hello ${fullName}, your VendorLink order ${orderNumber} is now ${status}. View it here: ${orderUrl}`,
    });
});
exports.sendOrderStatusEmail = sendOrderStatusEmail;
const sendWithdrawalStatusEmail = (_a) => __awaiter(void 0, [_a], void 0, function* ({ email, fullName, amount, status, bankName, accountNumber, note, }) {
    const formattedAmount = new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
    }).format(amount);
    const isRejected = status === "Rejected";
    yield (0, exports.sendEmail)({
        to: [{ email, name: fullName }],
        subject: `Withdrawal request ${status.toLowerCase()}`,
        htmlContent: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #171714;">Withdrawal request ${status.toLowerCase()}</h2>
        <p>Hello ${fullName},</p>
        <p>Your VendorLink withdrawal request for <strong>${formattedAmount}</strong> has been <strong>${status.toLowerCase()}</strong>.</p>
        <div style="background: ${isRejected ? "#fef2f2" : "#ecfdf5"}; color: ${isRejected ? "#991b1b" : "#047857"}; display: inline-block; padding: 10px 14px; border-radius: 999px; font-weight: 700;">
          ${status}
        </div>
        <p style="margin-top: 18px;">Destination account: <strong>${bankName}</strong> ending in <strong>${accountNumber.slice(-4)}</strong>.</p>
        ${note
            ? `<p style="background: #f7f7f5; padding: 12px 14px; border-radius: 12px;"><strong>Admin note:</strong> ${note}</p>`
            : ""}
        <p style="color: #6b7280;">You can view your latest payout history from your VendorLink seller dashboard.</p>
      </div>
    `,
        textContent: `Hello ${fullName}, your VendorLink withdrawal request for ${formattedAmount} has been ${status.toLowerCase()}.`,
    });
});
exports.sendWithdrawalStatusEmail = sendWithdrawalStatusEmail;
