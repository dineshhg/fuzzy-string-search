import mysql from 'mysql2/promise';
import { faker } from '@faker-js/faker';
import { DB_CONFIG } from './db_config';

// Special name variations for testing search functionality
const specialNames: [string, string][] = [
  ["Mary", "Ann"],
  ["MaryAnn", "Smith"],
  ["John", "D'Souza"],
  ["John", "DSouza"],
  ["Mirage Air", "Craft"],
  ["Mirage", "AirCraft"],
  ["Jean-Pierre", "Dubois"],
  ["JeanPierre", "Dubois"],
  ["O'Brien", "Patrick"],
  ["OBrien", "Patrick"],
  ["Anne-Marie", "Johnson"],
  ["AnneMarie", "Johnson"],
  ["Mac", "Donald"],
  ["MacDonald", "James"],
  ["De La", "Cruz"],
  ["DeLa", "Cruz"],
  ["Van Der", "Berg"],
  ["VanDer", "Berg"],
  ["St.", "James"],
  ["Saint", "James"],
];

// Entity test cases - both variations
const entityTestCases: [string, string][] = [
  ["Mirage Aircraft", "Services"],
  ["Mirage Aircraft", "Service"],
  ["Global Energy", "Corp"],
  ["Global Energy", "Corporation"],
  ["Al-Barakat Trading", "Company"],
  ["Al Barakat Trading", "Co"],
  ["Zhongguo Investment", "Ltd"],
  ["China Investment", "Limited"],
  ["North Korea Shipping", "Corporation"],
  ["DPRK Shipping", "Corp"],
  ["St. Petersburg Oil", "Trading"],
  ["Saint Petersburg Oil", "Trading"],
  ["Bank Melli", "Iran"],
  ["Melli Bank", "Iran"],
  ["Sberbank of", "Russia"],
  ["Sberbank", "Rossii"],
  ["Gazprom", "Neft"],
  ["Gazprom", "Oil"],
  ["Myanmar Economic", "Holdings"],
  ["Burma Economic", "Holdings"],
  ["First Abu Dhabi", "Bank"],
  ["FAB", "Bank"],
  ["Islamic Revolutionary Guard", "Corps"],
  ["IRGC", ""],
  ["Deutsche", "Waffenfabrik GmbH"],
  ["German Weapons Factory", "Ltd"],
  ["China North Industries", "Group"],
  ["Norinco", "Group"],
  ["Emirates", "NBD"],
  ["Emirates National Bank of", "Dubai"],
];

// Individual test cases - both variations
const individualTestCases: [string, string][] = [
  ["Mohammed", "Al-Farsi"],
  ["Mohammad", "Al Farsi"],
  ["Vladimir Vladimirovich", "Putin"],
  ["Vladimir", "Putin"],
  ["Kim", "Jong-un"],
  ["Kim", "Jong Un"],
  ["Xi", "Jinping"],
  ["Jinping", "Xi"],
  ["Sergei Viktorovich", "Lavrov"],
  ["Sergey", "Lavrov"],
  ["Robert Gabriel", "Mugabe"],
  ["Bob", "Mugabe"],
  ["Aung San", "Suu Kyi"],
  ["Suu Kyi", "Aung San"],
  ["Hassan", "Nasrallah"],
  ["Hassan", "Nasr Allah"],
  ["Mahmoud Abbas", "(Abu Mazen)"],
  ["Abu", "Mazen"],
  ["Margaret Hilda", "Thatcher"],
  ["Maggie", "Thatcher"],
  ["Recep Tayyip", "Erdoğan"],
  ["Recep Tayyip", "Erdogan"],
  ["Muammar Muhammad Abu Minyar", "al-Gaddafi"],
  ["Moammar", "Gadhafi"],
  ["Bashar Hafez", "al-Assad"],
  ["Bashar", "al Assad"],
  ["Sheikh Mohammed bin Zayed", "Al Nahyan"],
  ["MBZ", ""],
  ["Joseph Robinette", "Biden Jr."],
  ["Joe", "Biden"],
];

async function createConnection(): Promise<mysql.Connection | null> {
  try {
    const connection = await mysql.createConnection(DB_CONFIG);
    return connection;
  } catch (error) {
    console.error('Error connecting to MySQL:', error);
    return null;
  }
}

async function populateDatabase(): Promise<void> {
  const connection = await createConnection();
  if (!connection) {
    return;
  }

  try {
    // Clear existing data
    await connection.execute('TRUNCATE TABLE persons');

    // Prepare insert statement
    const insertQuery = `
      INSERT INTO persons (first_name, last_name, full_name, email) 
      VALUES (?, ?, ?, ?)
    `;

    const data: [string, string, string, string][] = [];

    // Add all special test cases
    const allTestCases = [...specialNames, ...entityTestCases, ...individualTestCases];
    
    for (const [first, last] of allTestCases) {
      const fullName = last ? `${first} ${last}` : first;
      const emailFirst = first.toLowerCase().replace(/ /g, '').replace(/'/g, '').replace(/[()]/g, '');
      const emailLast = last.toLowerCase().replace(/ /g, '').replace(/'/g, '').replace(/[()]/g, '');
      const email = last ? `${emailFirst}.${emailLast}@example.com` : `${emailFirst}@example.com`;
      data.push([first, last || '', fullName, email]);
    }

    // Generate remaining entries to reach 10000
    const remaining = 10000 - allTestCases.length;

    for (let i = 0; i < remaining; i++) {
      let firstName: string;
      let lastName: string;

      // Generate regular names
      if (Math.random() < 0.85) { // 85% regular names
        firstName = faker.person.firstName();
        lastName = faker.person.lastName();
      } else { // 15% names with variations
        // Create some variations
        const variationType = ['compound', 'apostrophe', 'space', 'hyphen', 'title'][Math.floor(Math.random() * 5)];

        if (variationType === 'compound') {
          // Create compound names
          firstName = faker.person.firstName() + faker.person.firstName();
          lastName = faker.person.lastName();
        } else if (variationType === 'apostrophe') {
          // Add apostrophes to names
          firstName = faker.person.firstName();
          lastName = ["O'", "D'", "L'", "M'"][Math.floor(Math.random() * 4)] + faker.person.lastName();
        } else if (variationType === 'space') {
          // Create multi-part names
          firstName = faker.person.firstName() + " " + faker.person.firstName().substring(0, 3);
          lastName = faker.person.lastName();
        } else if (variationType === 'hyphen') {
          // Create hyphenated names
          firstName = faker.person.firstName();
          lastName = faker.person.lastName() + "-" + faker.person.lastName();
        } else {
          // Add titles and suffixes
          const titles = ["Dr.", "Prof.", "Sheikh", "St.", "Rev."];
          const suffixes = ["Jr.", "Sr.", "III", "IV"];
          
          if (Math.random() < 0.5) {
            firstName = titles[Math.floor(Math.random() * titles.length)] + " " + faker.person.firstName();
            lastName = faker.person.lastName();
          } else {
            firstName = faker.person.firstName();
            lastName = faker.person.lastName() + " " + suffixes[Math.floor(Math.random() * suffixes.length)];
          }
        }
      }

      const fullName = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase().replace(/ /g, '').replace(/'/g, '')}.${lastName.toLowerCase().replace(/ /g, '').replace(/'/g, '')}@example.com`;

      data.push([firstName, lastName, fullName, email]);
    }

    // Insert data in batches of 100 for better performance
    const batchSize = 100;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      // Use batch insert
      const values = batch.map(() => '(?, ?, ?, ?)').join(', ');
      const flatData = batch.flat();
      await connection.execute(
        `INSERT INTO persons (first_name, last_name, full_name, email) VALUES ${values}`,
        flatData
      );
      
      // Show progress
      if (i % 1000 === 0) {
        console.log(`Inserted ${i} records...`);
      }
    }

    console.log(`Successfully inserted ${data.length} records into the database`);
  } catch (error) {
    console.error('Error inserting data:', error);
  } finally {
    await connection.end();
  }
}

async function verifyData(): Promise<void> {
  const connection = await createConnection();
  if (!connection) {
    return;
  }

  try {
    // Count records
    const [countRows] = await connection.execute('SELECT COUNT(*) as count FROM persons');
    const count = (countRows as any)[0].count;
    console.log(`\nTotal records in database: ${count}`);

    // Show some test case records
    console.log('\nSample test case records:');
    console.log('-'.repeat(80));
    
    // Show entity examples
    const [entityRows] = await connection.execute(
      "SELECT * FROM persons WHERE full_name IN ('Mirage Aircraft Services', 'Global Energy Corp', 'Bank Melli Iran') LIMIT 5"
    );
    console.log('\nEntity examples:');
    for (const row of entityRows as any[]) {
      console.log(`${row.id.toString().padEnd(5)} ${row.full_name.padEnd(40)}`);
    }
    
    // Show individual examples  
    const [individualRows] = await connection.execute(
      "SELECT * FROM persons WHERE full_name IN ('Vladimir Vladimirovich Putin', 'Kim Jong-un', 'Joe Biden') LIMIT 5"
    );
    console.log('\nIndividual examples:');
    for (const row of individualRows as any[]) {
      console.log(`${row.id.toString().padEnd(5)} ${row.full_name.padEnd(40)}`);
    }
    
    // Show some random records
    const [randomRows] = await connection.execute('SELECT * FROM persons ORDER BY RAND() LIMIT 10');
    console.log('\nRandom sample records:');
    console.log('-'.repeat(80));
    console.log(`${'ID'.padEnd(5)} ${'First Name'.padEnd(20)} ${'Last Name'.padEnd(20)} ${'Full Name'.padEnd(30)}`);
    console.log('-'.repeat(80));

    for (const row of randomRows as any[]) {
      console.log(`${row.id.toString().padEnd(5)} ${row.first_name.padEnd(20)} ${row.last_name.padEnd(20)} ${row.full_name.padEnd(30)}`);
    }
  } catch (error) {
    console.error('Error verifying data:', error);
  } finally {
    await connection.end();
  }
}

async function main(): Promise<void> {
  console.log('Populating database with 10,000 sample entries including test cases...');
  await populateDatabase();
  await verifyData();
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
} 