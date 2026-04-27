type BrevoRecipient = {
  email: string;
  name?: string;
};

type SendEmailInput = {
  to: BrevoRecipient[];
  subject: string;
  htmlContent: string;
  textContent?: string;
};

const brevoApiUrl = "https://api.brevo.com/v3/smtp/email";

const getSender = () => ({
  name: process.env.BREVO_SENDER_NAME || "VendorLink",
  email: process.env.BREVO_SENDER_EMAIL || "noreply@vendorlink.local",
});

export const sendEmail = async ({
  to,
  subject,
  htmlContent,
  textContent,
}: SendEmailInput): Promise<void> => {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    console.warn("BREVO_API_KEY is not configured. Skipping transactional email.");
    return;
  }

  const response = await fetch(brevoApiUrl, {
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
    const errorBody = await response.text();
    throw new Error(`Brevo email failed with status ${response.status}: ${errorBody}`);
  }
};

export const sendWelcomeEmail = async ({
  email,
  fullName,
  role,
  storeName,
}: {
  email: string;
  fullName: string;
  role: "BUYER" | "VENDOR" | "ADMIN";
  storeName?: string;
}): Promise<void> => {
  const isVendor = role === "VENDOR";
  const subject = isVendor
    ? "Your VendorLink store registration was received"
    : "Welcome to VendorLink";

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="color: #2a2059;">Welcome to VendorLink, ${fullName}</h2>
      <p>
        ${
          isVendor
            ? `Your vendor account${storeName ? ` for <strong>${storeName}</strong>` : ""} has been created successfully. You can now start preparing your digital storefront.`
            : "Your customer account has been created successfully. You can now discover and buy products from local vendors."
        }
      </p>
      <p>Thank you for joining our local marketplace.</p>
    </div>
  `;

  await sendEmail({
    to: [{ email, name: fullName }],
    subject,
    htmlContent,
    textContent: `Welcome to VendorLink, ${fullName}. Your ${isVendor ? "vendor" : "customer"} account has been created successfully.`,
  });
};

export const sendVerificationEmail = async ({
  email,
  fullName,
  verificationUrl,
}: {
  email: string;
  fullName: string;
  verificationUrl: string;
}): Promise<void> => {
  await sendEmail({
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
};

export const sendOrderStatusEmail = async ({
  email,
  fullName,
  orderNumber,
  status,
  orderUrl,
  note,
  itemNames,
}: {
  email: string;
  fullName: string;
  orderNumber: string;
  status: string;
  orderUrl: string;
  note?: string;
  itemNames?: string[];
}): Promise<void> => {
  const itemSummary = itemNames?.length
    ? itemNames.slice(0, 3).join(", ")
    : "your order items";

  await sendEmail({
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
        ${
          note
            ? `<p style="background: #f7f7f5; padding: 12px 14px; border-radius: 12px;"><strong>Seller note:</strong> ${note}</p>`
            : ""
        }
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
};

export const sendWithdrawalStatusEmail = async ({
  email,
  fullName,
  amount,
  status,
  bankName,
  accountNumber,
  note,
}: {
  email: string;
  fullName: string;
  amount: number;
  status: "Approved" | "Rejected" | "Paid";
  bankName: string;
  accountNumber: string;
  note?: string;
}): Promise<void> => {
  const formattedAmount = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
  const isRejected = status === "Rejected";

  await sendEmail({
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
        ${
          note
            ? `<p style="background: #f7f7f5; padding: 12px 14px; border-radius: 12px;"><strong>Admin note:</strong> ${note}</p>`
            : ""
        }
        <p style="color: #6b7280;">You can view your latest payout history from your VendorLink seller dashboard.</p>
      </div>
    `,
    textContent: `Hello ${fullName}, your VendorLink withdrawal request for ${formattedAmount} has been ${status.toLowerCase()}.`,
  });
};
