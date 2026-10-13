import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assessmentResultsContactError,
  buildPersonalisedAssessmentLink,
  getResultsContactPrompt,
  isPersonalisedAssessmentEntry,
  normalizeAssessmentResultsEmail,
  parseAssessmentContactParams,
  resolveSubmittedAssessmentIdentity,
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
  it("asks for name, email, and optional phone when nothing is known", () => {
    assert.deepEqual(getResultsContactPrompt({}), {
      show: true,
      askName: true,
      askEmail: true,
      askPhone: true,
    });
  });

  it("asks for email and optional phone when only a name is known", () => {
    assert.deepEqual(getResultsContactPrompt({ fullName: "Alex Morgan" }), {
      show: true,
      askName: false,
      askEmail: true,
      askPhone: true,
    });
  });

  it("asks for a name when email is already known", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        email: "alex@acme.com",
        phone: "+447700900123",
      }),
      { show: true, askName: true, askEmail: false, askPhone: false }
    );
  });

  it("skips the step when name and email are already known", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        fullName: "Alex Morgan",
        email: "alex@acme.com",
      }),
      { show: false, askName: false, askEmail: false, askPhone: false }
    );
  });

  it("does not treat Unknown or a placeholder inbox as identity", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        fullName: "Unknown",
        email: "unknown+abc@noemail.local",
      }),
      { show: true, askName: true, askEmail: true, askPhone: true }
    );
  });

  it("skips the step when the invite already has a name and email", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        inviteHasName: true,
        inviteHasEmail: true,
      }),
      { show: false, askName: false, askEmail: false, askPhone: false }
    );
  });

  it("still asks for a name when the invite only has email", () => {
    assert.deepEqual(
      getResultsContactPrompt({
        inviteHasEmail: true,
        inviteHasPhone: true,
      }),
      { show: true, askName: true, askEmail: false, askPhone: false }
    );
  });
});

describe("assessmentResultsContactError", () => {
  it("names the missing required field", () => {
    assert.equal(
      assessmentResultsContactError(
        { askName: true, askEmail: true },
        { fullName: " ", email: "alex@acme.com" }
      ),
      "Please enter your name."
    );
    assert.equal(
      assessmentResultsContactError(
        { askName: false, askEmail: true },
        { fullName: "Alex Morgan", email: "not-an-email" }
      ),
      "Please enter a valid email so we can send your results."
    );
    assert.equal(
      assessmentResultsContactError(
        { askName: false, askEmail: false },
        { fullName: "Alex Morgan", email: "alex@acme.com" }
      ),
      null
    );
  });
});

describe("resolveSubmittedAssessmentIdentity", () => {
  it("requires a real name and email from the submission", () => {
    assert.equal(
      resolveSubmittedAssessmentIdentity({ fullName: "Unknown", email: "" }),
      null
    );
    assert.deepEqual(
      resolveSubmittedAssessmentIdentity({
        fullName: "Alex Morgan",
        email: " Alex@Acme.com ",
      }),
      { fullName: "Alex Morgan", email: "alex@acme.com" }
    );
  });

  it("uses the invited contact when the submission omits identity", () => {
    assert.deepEqual(
      resolveSubmittedAssessmentIdentity({
        invitedFullName: "Unknown",
        invitedFirstName: "Alex",
        invitedLastName: "Morgan",
        invitedEmail: "alex@acme.com",
      }),
      { fullName: "Alex Morgan", email: "alex@acme.com" }
    );
  });

  it("rejects a placeholder invited email", () => {
    assert.equal(
      resolveSubmittedAssessmentIdentity({
        invitedFullName: "Alex Morgan",
        invitedEmail: "unknown+abc@noemail.local",
      }),
      null
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
