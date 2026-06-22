import type { BotIntent } from "@/lib/types";

export const BOT_INTENTS: BotIntent[] = [
  "faq_question",
  "order_start",
  "order_update",
  "price_question",
  "menu_question",
  "delivery_question",
  "payment_question",
  "complaint",
  "refund_request",
  "discount_request",
  "human_request",
  "unknown",
];

export const BOT_INTENT_LABELS: Record<BotIntent, string> = {
  faq_question: "FAQ question",
  order_start: "Order start",
  order_update: "Order update",
  price_question: "Price question",
  menu_question: "Menu question",
  delivery_question: "Delivery question",
  payment_question: "Payment question",
  complaint: "Complaint",
  refund_request: "Refund request",
  discount_request: "Discount request",
  human_request: "Human request",
  unknown: "Unknown",
};
