// Automated RLS verification for avatar storage folders and email invitations.
// Creates short-lived test users, exercises representative sender/recipient
// scenarios against the real policies, then cleans everything up.
// Callable only by admins (or with a service-role key).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Check = {
  scenario: string;
  expectation: "allowed" | "denied";
  passed: boolean;
  detail?: string;
};

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function userClient(accessToken: string) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function record(
  checks: Check[],
  scenario: string,
  expectation: Check["expectation"],
  ok: boolean,
  detail?: string,
) {
  checks.push({
    scenario,
    expectation,
    passed: expectation === "allowed" ? ok : !ok,
    detail,
  });
}

async function createTestUser(tag: string) {
  const email = `rls-selftest+${tag}-${crypto.randomUUID()}@paizeiscy.com`;
  const password = crypto.randomUUID() + "Aa1!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS Selftest ${tag}` },
  });
  if (error || !data.user) throw new Error(`createUser(${tag}): ${error?.message}`);

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: session, error: signInError } = await anon.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !session.session) {
    throw new Error(`signIn(${tag}): ${signInError?.message}`);
  }
  return { id: data.user.id, email, token: session.session.access_token };
}

const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);

async function runAvatarChecks(
  checks: Check[],
  sender: { id: string; token: string },
  recipient: { id: string; token: string },
) {
  const senderDb = userClient(sender.token);
  const ownPath = `${sender.id}/avatar.png`;
  const foreignPath = `${recipient.id}/avatar.png`;
  const nestedPath = `${sender.id}/nested/avatar.png`;
  const blob = new Blob([PNG], { type: "image/png" });

  const own = await senderDb.storage.from("avatars").upload(ownPath, blob, { upsert: true });
  record(checks, "owner uploads into own avatar folder", "allowed", !own.error, own.error?.message);

  const foreign = await senderDb.storage.from("avatars").upload(foreignPath, blob, { upsert: true });
  record(
    checks,
    "sender uploads into another user's avatar folder",
    "denied",
    !foreign.error,
    foreign.error?.message,
  );

  const nested = await senderDb.storage.from("avatars").upload(nestedPath, blob, { upsert: true });
  record(
    checks,
    "owner uploads into a nested sub-folder (must stay flat)",
    "denied",
    !nested.error,
    nested.error?.message,
  );

  const venue = await senderDb.storage
    .from("avatars")
    .upload(`venues/${sender.id}/venue.png`, blob, { upsert: true });
  record(
    checks,
    "non-admin uploads into venues/ folder",
    "denied",
    !venue.error,
    venue.error?.message,
  );

  // Public read of a valid image extension is intentionally allowed.
  const publicUrl = admin.storage.from("avatars").getPublicUrl(ownPath).data.publicUrl;
  const publicRead = await fetch(publicUrl);
  record(
    checks,
    "anonymous read of an avatar image",
    "allowed",
    publicRead.ok,
    `status ${publicRead.status}`,
  );

  const recipientDb = userClient(recipient.token);
  const del = await recipientDb.storage.from("avatars").remove([ownPath]);
  const deleted = !del.error && (del.data?.length ?? 0) > 0;
  record(
    checks,
    "other user deletes someone else's avatar",
    "denied",
    deleted,
    del.error?.message,
  );

  const selfDel = await senderDb.storage.from("avatars").remove([ownPath]);
  record(
    checks,
    "owner deletes own avatar",
    "allowed",
    !selfDel.error && (selfDel.data?.length ?? 0) > 0,
    selfDel.error?.message,
  );

  // Cleanup anything that unexpectedly landed.
  await admin.storage.from("avatars").remove([ownPath, foreignPath, nestedPath, `venues/${sender.id}/venue.png`]);
}

async function runInvitationChecks(
  checks: Check[],
  sender: { id: string; token: string; email: string },
  recipient: { id: string; token: string; email: string },
  bystander: { id: string; token: string; email: string },
) {
  const senderDb = userClient(sender.token);
  const recipientDb = userClient(recipient.token);
  const bystanderDb = userClient(bystander.token);
  const createdIds: string[] = [];

  const insert = await senderDb
    .from("email_invitations")
    .insert({
      email: recipient.email,
      invited_by: sender.id,
      invitation_type: "team",
    })
    .select("id")
    .maybeSingle();
  record(
    checks,
    "sender creates an invitation as themselves",
    "allowed",
    !insert.error && !!insert.data,
    insert.error?.message,
  );
  if (insert.data?.id) createdIds.push(insert.data.id);

  const spoof = await senderDb
    .from("email_invitations")
    .insert({
      email: recipient.email,
      invited_by: bystander.id,
      invitation_type: "team",
    })
    .select("id")
    .maybeSingle();
  record(
    checks,
    "sender spoofs invited_by as another user",
    "denied",
    !spoof.error && !!spoof.data,
    spoof.error?.message,
  );
  if (spoof.data?.id) createdIds.push(spoof.data.id);

  const invitationId = insert.data?.id;
  if (invitationId) {
    const senderRead = await senderDb
      .from("email_invitations")
      .select("id")
      .eq("id", invitationId)
      .maybeSingle();
    record(
      checks,
      "sender reads their own invitation",
      "allowed",
      !!senderRead.data,
      senderRead.error?.message,
    );

    const recipientRead = await recipientDb
      .from("email_invitations")
      .select("id")
      .eq("id", invitationId)
      .maybeSingle();
    record(
      checks,
      "recipient reads an invitation addressed to their verified email",
      "allowed",
      !!recipientRead.data,
      recipientRead.error?.message,
    );

    const bystanderRead = await bystanderDb
      .from("email_invitations")
      .select("id")
      .eq("id", invitationId)
      .maybeSingle();
    record(
      checks,
      "unrelated user reads someone else's invitation",
      "denied",
      !!bystanderRead.data,
      bystanderRead.error?.message,
    );

    const recipientUpdate = await recipientDb
      .from("email_invitations")
      .update({ invitation_type: "booking" })
      .eq("id", invitationId)
      .select("id");
    record(
      checks,
      "recipient updates an invitation they did not send",
      "denied",
      !recipientUpdate.error && (recipientUpdate.data?.length ?? 0) > 0,
      recipientUpdate.error?.message,
    );

    const senderUpdate = await senderDb
      .from("email_invitations")
      .update({ invitation_type: "booking" })
      .eq("id", invitationId)
      .select("id");
    record(
      checks,
      "sender updates their own invitation",
      "allowed",
      !senderUpdate.error && (senderUpdate.data?.length ?? 0) > 0,
      senderUpdate.error?.message,
    );

    const bystanderDelete = await bystanderDb
      .from("email_invitations")
      .delete()
      .eq("id", invitationId)
      .select("id");
    record(
      checks,
      "unrelated user deletes an invitation",
      "denied",
      !bystanderDelete.error && (bystanderDelete.data?.length ?? 0) > 0,
      bystanderDelete.error?.message,
    );
  }

  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonRead = await anonClient.from("email_invitations").select("id").limit(1);
  record(
    checks,
    "anonymous visitor lists invitations",
    "denied",
    !anonRead.error && (anonRead.data?.length ?? 0) > 0,
    anonRead.error?.message,
  );

  if (createdIds.length) {
    await admin.from("email_invitations").delete().in("id", createdIds);
  }
  await admin.from("email_invitations").delete().eq("invited_by", sender.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Allow direct service-role invocation (CI), otherwise require an admin user.
  if (token !== SERVICE_ROLE_KEY) {
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .limit(1);
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const checks: Check[] = [];
  const createdUsers: string[] = [];
  try {
    const sender = await createTestUser("sender");
    createdUsers.push(sender.id);
    const recipient = await createTestUser("recipient");
    createdUsers.push(recipient.id);
    const bystander = await createTestUser("bystander");
    createdUsers.push(bystander.id);

    await runAvatarChecks(checks, sender, recipient);
    await runInvitationChecks(checks, sender, recipient, bystander);

    const failed = checks.filter((c) => !c.passed);
    return new Response(
      JSON.stringify({
        ok: failed.length === 0,
        total: checks.length,
        failed: failed.length,
        checks,
      }),
      {
        status: failed.length === 0 ? 200 : 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message, checks }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } finally {
    for (const id of createdUsers) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
  }
});
