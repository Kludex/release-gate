import {
  type AuthenticationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  type RegistrationResponseJSON,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { findAuthenticatorById } from "passkey-authenticator-aaguids";
import {
  type Challenge,
  type Credential,
  consumeChallenge,
  getCredential,
  insertChallenge,
  insertCredential,
  listCredentials,
  recordCredentialUse,
} from "@/db/credentials";
import type { Env, User } from "@/env";
import { type Body, fail, stringField } from "@/http";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const REGISTRATION_PURPOSE = /^(register|bootstrap|invite:[0-9a-f]{64})$/;

export type Ceremony = { challengeId: string; options: unknown };

export async function authenticationChallenge(
  env: Env,
  user: User,
  purpose: string,
  requestId: string | null = null,
): Promise<Ceremony> {
  const credentials = await listCredentials(env.DB, user.id);
  if (credentials.length === 0) fail(400, "Register a passkey first");
  const options = await generateAuthenticationOptions({
    rpID: new URL(env.PUBLIC_ORIGIN).hostname,
    userVerification: "required",
    allowCredentials: credentials.map(descriptor),
  });
  return {
    challengeId: await saveChallenge(env, user, purpose, requestId, options.challenge),
    options,
  };
}

/** Verifies a passkey assertion and returns the credential id and the challenge purpose. */
export async function verifyAuthentication(
  env: Env,
  user: User,
  body: Body,
  purposes: string[],
  requestId: string | null = null,
): Promise<{ credentialId: string; purpose: string }> {
  const challenge = await takeChallenge(env, user, body, (p) => purposes.includes(p));
  if (challenge.request_id !== requestId) fail(403, "This challenge belongs to another request");
  const response = body.response as AuthenticationResponseJSON;
  const credential = await getCredential(env.DB, String(response.id));
  if (!credential || credential.github_user_id !== user.id) {
    fail(403, "This passkey is not registered to your account");
  }
  const { origin, hostname } = new URL(env.PUBLIC_ORIGIN);
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: hostname,
    requireUserVerification: true,
    credential: {
      id: credential.credential_id,
      publicKey: new Uint8Array(credential.public_key),
      counter: credential.counter,
    },
  }).catch((error: Error) => fail(403, `Passkey check failed: ${error.message}`));
  if (!result.verified) fail(403, "Passkey check failed");
  await recordCredentialUse(env.DB, credential.credential_id, result.authenticationInfo.newCounter);
  return { credentialId: credential.credential_id, purpose: challenge.purpose };
}

export async function registrationChallenge(
  env: Env,
  user: User,
  purpose: string,
): Promise<Ceremony> {
  const existing = await listCredentials(env.DB, user.id);
  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: new URL(env.PUBLIC_ORIGIN).hostname,
    userName: user.login,
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: "none",
    excludeCredentials: existing.map(descriptor),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  return { challengeId: await saveChallenge(env, user, purpose, null, options.challenge), options };
}

/** Verifies a new passkey and returns the challenge purpose plus the statement that stores it. */
export async function verifyRegistration(
  env: Env,
  user: User,
  body: Body,
): Promise<{ purpose: string; save: D1PreparedStatement }> {
  const challenge = await takeChallenge(env, user, body, (p) => REGISTRATION_PURPOSE.test(p));
  const { origin, hostname } = new URL(env.PUBLIC_ORIGIN);
  const result = await verifyRegistrationResponse({
    response: body.response as RegistrationResponseJSON,
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: hostname,
    requireUserVerification: true,
  }).catch((error: Error) => fail(403, `Passkey registration failed: ${error.message}`));
  if (!result.verified) fail(403, "Passkey registration failed");
  const { credential, aaguid } = result.registrationInfo;
  const transports = credential.transports ?? [];
  const typed = typeof body.name === "string" ? body.name.trim() : "";
  const name =
    typed ||
    findAuthenticatorById({ authenticatorId: aaguid })?.name ||
    (transports.some((t) => ["usb", "nfc", "ble"].includes(t)) ? "Security key" : "Passkey");
  const save = insertCredential(env.DB, {
    credential_id: credential.id,
    github_user_id: user.id,
    public_key: credential.publicKey,
    counter: credential.counter,
    transports: JSON.stringify(transports),
    name: name.slice(0, 64),
  });
  return { purpose: challenge.purpose, save };
}

async function takeChallenge(
  env: Env,
  user: User,
  body: Body,
  accepts: (purpose: string) => boolean,
): Promise<Challenge> {
  if (typeof body.response !== "object" || body.response === null)
    fail(400, "Missing field: response");
  const challenge = await consumeChallenge(env.DB, stringField(body, "challengeId"), user.id);
  if (!challenge) fail(403, "Unknown or already used challenge");
  if (challenge.expires_at < Date.now()) fail(403, "This challenge has expired");
  if (!accepts(challenge.purpose)) fail(403, "This challenge was issued for another action");
  return challenge;
}

async function saveChallenge(
  env: Env,
  user: User,
  purpose: string,
  requestId: string | null,
  challenge: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await insertChallenge(env.DB, {
    id,
    github_user_id: user.id,
    purpose,
    request_id: requestId,
    challenge,
    expires_at: Date.now() + CHALLENGE_TTL_MS,
  });
  return id;
}

function descriptor(credential: Credential): { id: string; transports: string[] } {
  return { id: credential.credential_id, transports: JSON.parse(credential.transports) };
}
