import "dotenv/config";

const required = ["DATABASE_URL", "JWT_SECRET"];
const optional = [
  "VITE_KAKAO_MAP_APP_KEY",
  "KAKAO_REST_API_KEY",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
];

const configured = key => Boolean(process.env[key]?.trim());
const print = (label, key) => {
  console.log(`${configured(key) ? "OK" : "MISSING"}  ${label}: ${key}`);
};

console.log("Municipal Trip Route local API preflight\n");
console.log("Required for persistent personal use:");
required.forEach(key => print("required", key));

console.log("\nLocal authentication:");
console.log(
  `${process.env.LOCAL_PERSONAL_MODE === "true" ? "OK" : "MISSING"}  development-only: LOCAL_PERSONAL_MODE=true`
);

console.log("\nOptional integrations:");
optional.forEach(key => print("optional", key));

console.log("\nNotes:");
console.log(
  "- Local personal mode is intentionally disabled when NODE_ENV=production."
);
console.log(
  "- Map rendering needs the JavaScript key; address search needs the REST key."
);
console.log(
  "- File upload uses S3-compatible storage when all three S3 credentials are present."
);

if (required.some(key => !configured(key))) {
  console.error(
    "\nPersistent personal use is not ready: configure the required values in .env."
  );
  process.exitCode = 1;
}
