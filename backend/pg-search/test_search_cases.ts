import { Pool } from "pg";
import { DB_CONFIG, Person } from "./db_config";

// Test cases for entities
const entityTestPairs: [string, string][] = [
  ["Mirage Aircraft Services", "Mirage Aircraft Service"],
  ["Global Energy Corp", "Global Energy Corporation"],
  ["Al-Barakat Trading Company", "Al Barakat Trading Co"],
  ["Zhongguo Investment Ltd", "China Investment Limited"],
  ["North Korea Shipping Corporation", "DPRK Shipping Corp"],
  ["St. Petersburg Oil Trading", "Saint Petersburg Oil Trading"],
  ["Bank Melli Iran", "Melli Bank Iran"],
  ["Sberbank of Russia", "Sberbank Rossii"],
  ["Gazprom Neft", "Gazprom Oil"],
  ["Myanmar Economic Holdings", "Burma Economic Holdings"],
  ["First Abu Dhabi Bank", "FAB Bank"],
  ["Islamic Revolutionary Guard Corps", "IRGC"],
  ["Deutsche Waffenfabrik GmbH", "German Weapons Factory Ltd"],
  ["China North Industries Group", "Norinco Group"],
  ["Emirates NBD", "Emirates National Bank of Dubai"],
];

// Test cases for individuals
const individualTestPairs: [string, string][] = [
  ["Mohammed Al-Farsi", "Mohammad Al Farsi"],
  ["Vladimir Vladimirovich Putin", "Vladimir Putin"],
  ["Kim Jong-un", "Kim Jong Un"],
  ["Xi Jinping", "Jinping Xi"],
  ["Sergei Viktorovich Lavrov", "Sergey Lavrov"],
  ["Robert Gabriel Mugabe", "Bob Mugabe"],
  ["Aung San Suu Kyi", "Suu Kyi, Aung San"],
  ["Hassan Nasrallah", "Hassan Nasr Allah"],
  ["Mahmoud Abbas (Abu Mazen)", "Abu Mazen"],
  ["Margaret Hilda Thatcher", "Maggie Thatcher"],
  ["Recep Tayyip Erdoğan", "Recep Tayyip Erdogan"],
  ["Muammar Muhammad Abu Minyar al-Gaddafi", "Moammar Gadhafi"],
  ["Bashar Hafez al-Assad", "Bashar al Assad"],
  ["Sheikh Mohammed bin Zayed Al Nahyan", "MBZ"],
  ["Joseph Robinette Biden Jr.", "Joe Biden"],
];

async function createPool(): Promise<Pool | null> {
  try {
    const pool = new Pool(DB_CONFIG);
    // Test connection
    const client = await pool.connect();
    client.release();
    return pool;
  } catch (error) {
    console.error("Error connecting to PostgreSQL:", error);
    return null;
  }
}

async function searchFullName(
  pool: Pool,
  searchTerm: string,
): Promise<Person[]> {
  // Simple wildcard search for testing
  const query = `
    SELECT * FROM persons 
    WHERE full_name ILIKE $1
    LIMIT 20
  `;

  const result = await pool.query(query, [`%${searchTerm}%`]);
  return result.rows as Person[];
}

async function testSearchPair(
  pool: Pool,
  original: string,
  variation: string,
): Promise<void> {
  console.log(`\nTesting: "${original}" → "${variation}"`);
  console.log("-".repeat(60));

  // Search for the variation
  const results = await searchFullName(pool, variation);

  // Check if we found the original
  const foundOriginal = results.some(
    (r) =>
      r.full_name.toLowerCase().includes(original.toLowerCase()) ||
      original.toLowerCase().includes(r.full_name.toLowerCase()),
  );

  if (foundOriginal) {
    console.log(`✓ SUCCESS: Found match for "${original}"`);
  } else {
    console.log(
      `✗ FAILED: Did not find "${original}" when searching for "${variation}"`,
    );
  }

  // Show what was found
  if (results.length > 0) {
    console.log(`Found ${results.length} results:`);
    results.slice(0, 3).forEach((r) => {
      console.log(`  - ${r.full_name}`);
    });
    if (results.length > 3) {
      console.log(`  ... and ${results.length - 3} more`);
    }
  } else {
    console.log("No results found");
  }
}

async function runTests(): Promise<void> {
  const pool = await createPool();
  if (!pool) {
    return;
  }

  try {
    console.log("=".repeat(80));
    console.log("ENTITY TEST CASES");
    console.log("=".repeat(80));

    for (const [original, variation] of entityTestPairs) {
      await testSearchPair(pool, original, variation);
    }

    console.log("\n\n" + "=".repeat(80));
    console.log("INDIVIDUAL TEST CASES");
    console.log("=".repeat(80));

    for (const [original, variation] of individualTestPairs) {
      await testSearchPair(pool, original, variation);
    }

    // Summary
    console.log("\n\n" + "=".repeat(80));
    console.log("TEST SUMMARY");
    console.log("=".repeat(80));
    console.log(`Entity test cases: ${entityTestPairs.length}`);
    console.log(`Individual test cases: ${individualTestPairs.length}`);
    console.log(
      `Total test cases: ${entityTestPairs.length + individualTestPairs.length}`,
    );
  } catch (error) {
    console.error("Error running tests:", error);
  } finally {
    await pool.end();
  }
}

// Run if this is the main module
if (require.main === module) {
  runTests().catch(console.error);
}
