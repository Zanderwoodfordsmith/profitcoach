import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CreateCoachRecordsInput = {
  userId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  businessName: string | null;
  slug: string;
};

function isStaffSnapshotAccessTierError(error: {
  code?: string;
  message?: string;
  details?: string;
}): boolean {
  return (
    error.code === "23502" &&
    (error.message?.includes("access_tier") === true ||
      error.details?.includes("community_staff_snapshot") === true)
  );
}

async function insertCoachRow(
  userId: string,
  slug: string
): Promise<string | null> {
  const { error } = await supabaseAdmin
    .from("coaches")
    .insert({ id: userId, slug });

  if (!error) return null;

  console.error("createCoachAccountRecords coach insert:", error);
  if (error.code === "23505") {
    return "That slug is already in use. Please choose another.";
  }
  return "Unable to create coach record.";
}

/**
 * Bootstrap coach row before role=coach profile: avoids
 * sync_community_staff_snapshot setting access_tier null when no coaches row exists yet.
 */
async function createCoachProfileAndRowViaBootstrap(
  input: CreateCoachRecordsInput
): Promise<string | null> {
  const profileFields = {
    id: input.userId,
    full_name: input.fullName,
    first_name: input.firstName,
    last_name: input.lastName,
    coach_business_name: input.businessName,
  };

  const { error: bootstrapProfileError } = await supabaseAdmin
    .from("profiles")
    .insert({ ...profileFields, role: "admin" });

  if (bootstrapProfileError) {
    console.error(
      "createCoachAccountRecords bootstrap profile:",
      bootstrapProfileError
    );
    return "Unable to create coach profile.";
  }

  const coachError = await insertCoachRow(input.userId, input.slug);
  if (coachError) {
    await supabaseAdmin.from("profiles").delete().eq("id", input.userId);
    return coachError;
  }

  const { error: roleError } = await supabaseAdmin
    .from("profiles")
    .update({ role: "coach" })
    .eq("id", input.userId);

  if (roleError) {
    console.error("createCoachAccountRecords role update:", roleError);
    await supabaseAdmin.from("coaches").delete().eq("id", input.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", input.userId);
    return "Unable to create coach profile.";
  }

  return null;
}

export async function createCoachProfileAndRow(
  input: CreateCoachRecordsInput
): Promise<string | null> {
  const profileFields = {
    id: input.userId,
    full_name: input.fullName,
    first_name: input.firstName,
    last_name: input.lastName,
    coach_business_name: input.businessName,
  };

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({ ...profileFields, role: "coach" });

  if (profileError) {
    if (isStaffSnapshotAccessTierError(profileError)) {
      return createCoachProfileAndRowViaBootstrap(input);
    }

    console.error("createCoachAccountRecords profile insert:", profileError);
    return "Unable to create coach profile.";
  }

  const coachError = await insertCoachRow(input.userId, input.slug);
  if (coachError) {
    await supabaseAdmin.from("profiles").delete().eq("id", input.userId);
    return coachError;
  }

  return null;
}
