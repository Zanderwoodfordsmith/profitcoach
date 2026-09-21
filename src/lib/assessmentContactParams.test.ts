import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPersonalisedAssessmentLink,
  getResultsContactPrompt,
  isPersonalisedAssessmentEntry,
  normalizeAssessmentResultsEmail,
  parseAssessmentContactParams,
  type AssessmentContactFromUrl,
} from "./assessmentContactParams";
import { normalizeAssessmentInviteToken } from "./assessmentInviteToken";

const emptyContact: AssessmentContactFromUrl = {
  firstName: null,
  lastName: null,
  fullName: null,
  email: null,
  phone: null,
  businessName: null,
  inviteToken: null,
};

function contact(
  patch: Partial<AssessmentContactFromUrl>
): AssessmentContactFromUrl {
  return { ...emptyContact, ...patch };
}

describe("isPersonalisedAssessmentEntry", () => {
  it("is false for a bare assessment URL", () => {
    assert.equal(isPersonalisedAssessmentEntry(emptyContact), false);
  });

  it("is true when a name, email, phone, or business is on the link", () => {
    assert.equal(
      isPersonalisedAssessmentEntry(contact({ firstName: "Alex" })),
      true
    );
    assert.equal(
      isPersonalisedAssessmentEntry(contact({ businessName: "Acme" })),
      true
    );
    assert.equal(
      isPersonalisedAssessmentEntry(contact({ email: "a@b.com" })),
      true
    );
    assert.equal(
      isPersonalisedAssessmentEntry(
        contact({ inviteToken: "11111111-1111-4111-8111-111111111111" })
      ),
      true
    );
  });
});

describe("getResultsContactPrompt", () => {
  it("does not ask after the landing opt-in, even without email on the URL", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        fromLanding: true,
        urlContact: contact({ firstName: "Alex" }),
      }),
      { show: false, askEmail: false, askPhone: false }
    );
  });

  it("does not ask on a generic scorecard-only link", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        fromLanding: false,
        urlContact: emptyContact,
      }),
      { show: false, askEmail: false, askPhone: false }
    );
  });

  it("asks for email and optional phone on a personalised link with neither", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        fromLanding: false,
        urlContact: contact({ firstName: "Alex" }),
      }),
      { show: true, askEmail: true, askPhone: true }
    );
  });

  it("skips the step when the personalised link already has email", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        fromLanding: false,
        urlContact: contact({ firstName: "Alex", email: "alex@acme.com" }),
      }),
      { show: false, askEmail: false, askPhone: false }
    );
  });

  it("skips the step when email is already known in state", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        fromLanding: false,
        urlContact: contact({ firstName: "Alex" }),
        email: "alex@acme.com",
      }),
      { show: false, askEmail: false, askPhone: false }
    );
  });

  it("asks for email only when phone is already on the link", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        fromLanding: false,
        urlContact: contact({ firstName: "Alex", phone: "+447700900123" }),
      }),
      { show: true, askEmail: true, askPhone: false }
    );
  });

  it("skips the step when the invite token already has email on file", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        fromLanding: false,
        urlContact: contact({
          firstName: "Alex",
          inviteToken: "11111111-1111-4111-8111-111111111111",
        }),
        inviteHasEmail: true,
      }),
      { show: false, askEmail: false, askPhone: false }
    );
  });
});

describe("normalizeAssessmentResultsEmail", () => {
  it("accepts a trimmed, lowercased address", () => {
    assert.equal(
      normalizeAssessmentResultsEmail("  Alex@Acme.com "),
      "alex@acme.com"
    );
  });

  it("rejects missing or malformed addresses", () => {
    assert.equal(normalizeAssessmentResultsEmail(""), null);
    assert.equal(normalizeAssessmentResultsEmail("not-an-email"), null);
    assert.equal(normalizeAssessmentResultsEmail("a@b"), null);
  });
});

describe("parseAssessmentContactParams", () => {
  it("reads personalised query params", () => {
    const params = new URLSearchParams(
      "first_name=Alex&business=Acme&email=Alex@Acme.com"
    );
    assert.deepEqual(parseAssessmentContactParams(params), {
      firstName: "Alex",
      lastName: null,
      fullName: "Alex",
      email: "alex@acme.com",
      phone: null,
      businessName: "Acme",
      inviteToken: null,
    });
  });

  it("reads a valid invite token and ignores a junk one", () => {
    const token = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const withToken = new URLSearchParams(`first_name=Alex&c=${token}`);
    assert.equal(parseAssessmentContactParams(withToken).inviteToken, token);
    const junk = new URLSearchParams("first_name=Alex&c=not-a-uuid");
    assert.equal(parseAssessmentContactParams(junk).inviteToken, null);
  });
});

describe("buildPersonalisedAssessmentLink", () => {
  it("puts the invite token on ?c=", () => {
    const token = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const url = buildPersonalisedAssessmentLink({
      coachSlug: "pam",
      firstName: "Alex",
      inviteToken: token,
    });
    assert.equal(
      url,
      `/assessment/pam?first_name=Alex&c=${token}`
    );
  });
});

describe("normalizeAssessmentInviteToken", () => {
  it("accepts a uuid and rejects other strings", () => {
    assert.equal(
      normalizeAssessmentInviteToken("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE"),
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
    );
    assert.equal(normalizeAssessmentInviteToken("linkedin.com/in/alex"), null);
  });
});
