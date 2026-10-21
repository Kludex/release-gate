import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { isoBase64URL, isoCBOR } from "@simplewebauthn/server/helpers";

const ORIGIN = "https://gate.test";
const RP_ID = "gate.test";
const UP_UV = 0x01 | 0x04;
const ATTESTED = 0x40;

/** A software passkey that produces real ES256 WebAuthn responses. */
export class Authenticator {
  counter = 0;
  transports: RegistrationResponseJSON["response"]["transports"] = ["internal"];

  private constructor(
    readonly id: string,
    private readonly keys: CryptoKeyPair,
  ) {}

  static async create(): Promise<Authenticator> {
    const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    return new Authenticator(
      isoBase64URL.fromBuffer(crypto.getRandomValues(new Uint8Array(16))),
      keys,
    );
  }

  /** Same credential id, different key: its signatures must not verify. */
  async impostor(): Promise<Authenticator> {
    return new Authenticator(this.id, (await Authenticator.create()).keys);
  }

  async register(
    options: { challenge: string },
    { forgedAttestation = false } = {},
  ): Promise<RegistrationResponseJSON> {
    const jwk = (await crypto.subtle.exportKey("jwk", this.keys.publicKey)) as JsonWebKey;
    const cose = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, isoBase64URL.toBuffer(jwk.x as string)],
        [-3, isoBase64URL.toBuffer(jwk.y as string)],
      ]),
    );
    const credentialId = isoBase64URL.toBuffer(this.id);
    const authData = concat(
      await rpIdHash(),
      [UP_UV | ATTESTED],
      uint32(this.counter),
      new Uint8Array(16),
      [credentialId.length >> 8, credentialId.length & 0xff],
      credentialId,
      cose,
    );
    // A packed self-attestation signed over the wrong data.
    const attStmt = forgedAttestation
      ? new Map<string, number | Uint8Array>([
          ["alg", -7],
          ["sig", toDER(new Uint8Array(await this.sign(new Uint8Array([1]))))],
        ])
      : new Map<string, never>();
    const attestationObject = isoCBOR.encode(
      new Map<string, string | Uint8Array | Map<string, number | Uint8Array>>([
        ["fmt", forgedAttestation ? "packed" : "none"],
        ["attStmt", attStmt],
        ["authData", authData],
      ]),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientData("webauthn.create", options.challenge),
        attestationObject: isoBase64URL.fromBuffer(attestationObject),
        transports: this.transports,
      },
    };
  }

  async authenticate(options: { challenge: string }): Promise<AuthenticationResponseJSON> {
    this.counter += 1;
    const authData = concat(await rpIdHash(), [UP_UV], uint32(this.counter));
    const clientDataJSON = clientData("webauthn.get", options.challenge);
    const clientDataHash = await sha256(
      isoBase64URL.toBuffer(clientDataJSON) as Uint8Array<ArrayBuffer>,
    );
    const raw = await this.sign(concat(authData, clientDataHash));
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON,
        authenticatorData: isoBase64URL.fromBuffer(authData),
        signature: isoBase64URL.fromBuffer(toDER(new Uint8Array(raw))),
      },
    };
  }

  private sign(data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
    return crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, this.keys.privateKey, data);
  }
}

function clientData(type: string, challenge: string): string {
  const json = JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false });
  return isoBase64URL.fromBuffer(new TextEncoder().encode(json));
}

async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

async function rpIdHash(): Promise<Uint8Array> {
  return sha256(new TextEncoder().encode(RP_ID));
}

function uint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}

function concat(...parts: ArrayLike<number>[]): Uint8Array<ArrayBuffer> {
  return new Uint8Array(parts.flatMap((part) => Array.from(part)));
}

/** WebCrypto signs ECDSA as raw r||s; WebAuthn expects ASN.1 DER. */
function toDER(raw: Uint8Array): Uint8Array<ArrayBuffer> {
  const integer = (bytes: Uint8Array): number[] => {
    let start = 0;
    while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
    const body = Array.from(bytes.slice(start));
    if ((body[0] as number) >= 0x80) body.unshift(0);
    return [0x02, body.length, ...body];
  };
  const r = integer(raw.slice(0, 32));
  const s = integer(raw.slice(32));
  return new Uint8Array([0x30, r.length + s.length, ...r, ...s]);
}
