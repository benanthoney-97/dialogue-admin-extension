const { doImport } = require("./import-sitemap-core");

const main = async () => {
  const indexUrl = process.argv[2];
  if (!indexUrl) {
    console.error("Usage: node document-seeder/import-sitemap.cjs <sitemap_index_url>");
    process.exit(1);
  }
  try {
    await doImport(indexUrl);
    console.log("Import complete");
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}
