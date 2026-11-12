import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  buildCoachInvoice,
  invoiceNumberFor,
  paymentHasInvoice,
} from "./coachInvoice";
import { renderInvoicePdf } from "./renderInvoicePdf";

const payment = {
  id: "21c8ef9e-0562-4bd1-9000-000000000000",
  amount_cents: 260000,
  currency: "gbp",
  paid_at: "2026-04-08T09:00:00Z",
  customer_email: "coach@example.com",
};

describe("paymentHasInvoice", () => {
  it("covers paid payments through BCA's own routes", () => {
    for (const source of ["stripe", "revolut_merchant", "revolut_direct"]) {
      assert.equal(paymentHasInvoice({ status: "succeeded", payment_source: source }), true);
    }
  });

  it("leaves out failed, refunded and StryvX US payments", () => {
    assert.equal(paymentHasInvoice({ status: "failed", payment_source: "stripe" }), false);
    assert.equal(paymentHasInvoice({ status: "refunded", payment_source: "stripe" }), false);
    assert.equal(
      paymentHasInvoice({ status: "succeeded", payment_source: "stripe_stryv_us" }),
      false
    );
  });
});

describe("invoiceNumberFor", () => {
  it("is the same every time and can't clash with hand-made numbers", () => {
    assert.equal(invoiceNumberFor(payment.id, payment.paid_at), "BCA-2026-21C8EF9E");
  });
});

describe("buildCoachInvoice", () => {
  it("bills the business, for the attention of the coach, once they add one", () => {
    const invoice = buildCoachInvoice({
      payment,
      billingKind: "installment",
      coachName: "Harriet Molyneaux",
      businessName: "Intero Studio Ltd",
      details: {
        business_name: "Intero Studio Ltd",
        address: "167 Great Portland Street\n\nLondon\nW1W 5PF",
        company_number: "16689957",
        vat_number: null,
      },
    });
    assert.equal(invoice.billedToName, "Intero Studio Ltd");
    assert.deepEqual(invoice.billedToLines, [
      "FAO Harriet Molyneaux",
      "167 Great Portland Street",
      "London",
      "W1W 5PF",
    ]);
    assert.deepEqual(invoice.billedToSmall, ["Company number 16689957"]);
    assert.equal(invoice.amountLabel, "£2,600.00");
    assert.equal(invoice.dateLabel, "8 April 2026");
    assert.equal(invoice.thankYouName, "Harriet");
  });

  it("falls back to the name and email when nothing is added", () => {
    const invoice = buildCoachInvoice({
      payment,
      billingKind: null,
      coachName: "Andrew Hayward",
      businessName: null,
      details: null,
    });
    assert.equal(invoice.billedToName, "Andrew Hayward");
    assert.deepEqual(invoice.billedToLines, ["coach@example.com"]);
  });
});

describe("renderInvoicePdf", () => {
  it("makes a one-page PDF, even with letters the font doesn't have", async () => {
    const invoice = buildCoachInvoice({
      payment: { ...payment, currency: "usd" },
      billingKind: "recurring",
      coachName: "Łukasz Müller 李",
      businessName: "A very long business name that needs to wrap on to a second line Ltd",
      details: {
        business_name: null,
        address: "1 Long Road\nSomewhere\nA Town\nA County\nA Country\nAB1 2CD",
        company_number: "1",
        vat_number: "GB1",
      },
    });
    const pdf = await PDFDocument.load(await renderInvoicePdf(invoice));
    assert.equal(pdf.getPageCount(), 1);
  });
});
