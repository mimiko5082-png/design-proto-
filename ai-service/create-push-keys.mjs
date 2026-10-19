// Run on a trusted computer. Private key is written outside the static website.
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { base64url } from "./web-push.mjs";

const target = resolve(process.argv[2] || "/tmp/basho-push-keys");
const checkout = fileURLToPath(new URL("../", import.meta.url));
const rel = relative(checkout, target);
if (!rel || (!rel.startsWith("..") && !rel.startsWith("/"))) throw new Error("Choose a directory outside the static checkout.");
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = publicKey.export({ format: "jwk" });
const decode = value => Buffer.from(value, "base64url");
const raw = Buffer.concat([Buffer.from([4]), decode(jwk.x), decode(jwk.y)]);
mkdirSync(target, { recursive: true, mode: 0o700 });
writeFileSync(resolve(target, "VAPID_PUBLIC_KEY.txt"), base64url(raw), { mode: 0o600, flag: "wx" });
writeFileSync(resolve(target, "VAPID_PRIVATE_KEY.txt"), base64url(privateKey.export({ format: "der", type: "pkcs8" })), { mode: 0o600, flag: "wx" });
console.log("Created VAPID_PUBLIC_KEY.txt and VAPID_PRIVATE_KEY.txt in " + target);
console.log("Keep the private file private. Do not paste it into chat or the repository.");
