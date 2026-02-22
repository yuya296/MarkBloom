const MIN_NODE = { major: 22, minor: 0, patch: 0 };

function parseVersion(raw) {
  const normalized = raw.replace(/^v/, "");
  const [major = "0", minor = "0", patch = "0"] = normalized.split(".");
  return {
    major: Number.parseInt(major, 10) || 0,
    minor: Number.parseInt(minor, 10) || 0,
    patch: Number.parseInt(patch, 10) || 0,
  };
}

function isGte(actual, minimum) {
  if (actual.major !== minimum.major) {
    return actual.major > minimum.major;
  }
  if (actual.minor !== minimum.minor) {
    return actual.minor > minimum.minor;
  }
  return actual.patch >= minimum.patch;
}

const current = parseVersion(process.version);
if (!isGte(current, MIN_NODE)) {
  const minText = `${MIN_NODE.major}.${MIN_NODE.minor}.${MIN_NODE.patch}`;
  console.error(
    `[markbloom] Node ${minText}+ is required. Current: ${process.version}`
  );
  console.error(
    "[markbloom] Please upgrade Node (nvm use, volta, or your preferred manager) and retry."
  );
  process.exit(1);
}
