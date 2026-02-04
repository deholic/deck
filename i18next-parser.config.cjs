module.exports = {
  locales: ["ko", "en"],
  input: ["src/**/*.{ts,tsx}"],
  output: "public/locales/$LOCALE/$NAMESPACE.json",
  defaultNamespace: "common",
  defaultValue: "",
  keySeparator: ".",
  namespaceSeparator: ":",
  createOldCatalogs: false,
  keepRemoved: true,
  sort: true
};
