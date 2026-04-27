import { ApiError } from "./ApiError";

type PaystackInitializePayload = {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

type PaystackInitializeData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

type PaystackVerifyData = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string;
};

type PaystackTransferRecipientPayload = {
  name: string;
  accountNumber: string;
  bankCode: string;
};

type PaystackTransferRecipientData = {
  recipient_code: string;
  name: string;
  details?: {
    account_number?: string;
    account_name?: string;
    bank_code?: string;
    bank_name?: string;
  };
};

type PaystackTransferPayload = {
  amount: number;
  recipient: string;
  reason: string;
  reference: string;
};

type PaystackTransferData = {
  transfer_code: string;
  reference: string;
  status: string;
};

type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const getSecretKey = () => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new ApiError(500, "Paystack secret key is not configured");
  }

  return secretKey;
};

const requestPaystack = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const result = (await response.json()) as PaystackResponse<T>;

  if (!response.ok || !result.status) {
    throw new ApiError(response.status || 502, result.message || "Paystack request failed");
  }

  return result.data;
};

export const paystack = {
  initializeTransaction: (payload: PaystackInitializePayload) =>
    requestPaystack<PaystackInitializeData>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: payload.email,
        amount: payload.amount,
        reference: payload.reference,
        callback_url: payload.callbackUrl,
        metadata: payload.metadata,
      }),
    }),

  verifyTransaction: (reference: string) =>
    requestPaystack<PaystackVerifyData>(
      `/transaction/verify/${encodeURIComponent(reference)}`
    ),

  createTransferRecipient: (payload: PaystackTransferRecipientPayload) =>
    requestPaystack<PaystackTransferRecipientData>("/transferrecipient", {
      method: "POST",
      body: JSON.stringify({
        type: "nuban",
        name: payload.name,
        account_number: payload.accountNumber,
        bank_code: payload.bankCode,
        currency: "NGN",
      }),
    }),

  initiateTransfer: (payload: PaystackTransferPayload) =>
    requestPaystack<PaystackTransferData>("/transfer", {
      method: "POST",
      body: JSON.stringify({
        source: "balance",
        amount: payload.amount,
        recipient: payload.recipient,
        reason: payload.reason,
        reference: payload.reference,
      }),
    }),
};
