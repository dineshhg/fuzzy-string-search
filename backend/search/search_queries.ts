import mysql from 'mysql2/promise';
import * as readline from 'readline';
import { DB_CONFIG, Person } from './db_config';

interface SearchResult extends Person {
  score?: number;
  foundBy?: string[];
}

export default class PersonSearch {
  connection: mysql.Connection | null = null;

  async connect(): Promise<boolean> {
    try {
      this.connection = await mysql.createConnection(DB_CONFIG);
      return true;
    } catch (error) {
      console.error('Error connecting to MySQL:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
    }
  }

  normalizeString(s: string): string {
    // Only remove spaces and convert to lowercase, keep apostrophes
    return s.replace(/\s+/g, '').toLowerCase();
  }

  async exactSearch(searchTerm: string): Promise<Person[]> {
    const query = `
      SELECT * FROM persons 
      WHERE full_name = ?
      LIMIT 10
    `;
    
    const [rows] = await this.connection!.execute(query, [searchTerm]);
    return rows as Person[];
  }

  async wildcardSearch(searchTerm: string): Promise<Person[]> {
    // Handle both versions of the name (with and without apostrophe)
    const normalizedTerm = searchTerm.replace("'", "");
    const query = `
      SELECT * FROM persons 
      WHERE LOWER(full_name) LIKE LOWER(?) 
         OR LOWER(full_name) LIKE LOWER(?)
      LIMIT 20
    `;
    
    const [rows] = await this.connection!.execute(query, [`%${searchTerm}%`, `%${normalizedTerm}%`]);
    return rows as Person[];
  }

  async normalizedSearch(searchTerm: string): Promise<Person[]> {
    // Split search term into words and create LIKE conditions
    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const likeConditions = searchWords.map(word => `LOWER(full_name) LIKE ?`).join(' AND ');
    
    const query = `
      SELECT * FROM persons 
      WHERE ${likeConditions}
      LIMIT 20
    `;
    
    // Create parameters array with %word% for each search word
    const params = searchWords.map(word => `%${word}%`);
    
    const [rows] = await this.connection!.execute(query, params);
    return rows as Person[];
  }

  async fulltextSearch(searchTerm: string): Promise<Person[]> {
    // Still using the existing fulltext index on all fields, but only checking full_name
    const query = `
      SELECT *, MATCH(first_name, last_name, full_name) AGAINST(?) as relevance
      FROM persons 
      WHERE MATCH(first_name, last_name, full_name) AGAINST(?)
        AND full_name LIKE CONCAT('%', ?, '%')
      ORDER BY relevance DESC
      LIMIT 20
    `;
    
    const [rows] = await this.connection!.execute(query, [searchTerm, searchTerm, searchTerm]);
    return rows as Person[];
  }

  async soundexSearch(searchTerm: string): Promise<Person[]> {
    // More flexible: handle phonetically similar first letters
    const firstChar = searchTerm.substring(0, 1).toLowerCase();
    const firstTwoChars = searchTerm.substring(0, 2).toLowerCase();
    
    // Define phonetically equivalent letters
    const phoneticGroups: { [key: string]: string[] } = {
      'c': ['c', 'k', 's'],
      'k': ['k', 'c'],
      's': ['s', 'c', 'z'],
      'z': ['z', 's'],
      'f': ['f', 'ph'],
      'j': ['j', 'g'],
      'g': ['g', 'j'],
      'x': ['x', 'z'],
      'q': ['q', 'k'],
      'v': ['v', 'w'],
      'w': ['w', 'v']
    };
    
    // Get phonetic equivalents for the first character
    // const equivalentChars = phoneticGroups[firstChar] || [firstChar];
    const equivalentChars = [firstChar];
    const firstCharConditions = equivalentChars.map(char => 
      `(LOWER(SUBSTRING(full_name, 1, 1)) = ? AND SUBSTRING(SOUNDEX(full_name), 2) = SUBSTRING(SOUNDEX(?), 2))`
    ).join(' OR ');
    
    const query = `
      SELECT * FROM persons 
      WHERE ${firstCharConditions}
         OR (SOUNDEX(full_name) = SOUNDEX(?) AND LOWER(SUBSTRING(full_name, 1, 2)) = ?)
      LIMIT 20
    `;
    
    // Build parameters array
    const params: string[] = [];
    equivalentChars.forEach(char => {
      params.push(char, searchTerm);
    });
    params.push(searchTerm, firstTwoChars);
    
    const [rows] = await this.connection!.execute(query, params);
    return rows as Person[];
  }

  async levenshteinSearch(searchTerm: string, maxDistance: number = 2): Promise<Person[]> {
    // More strict: reduced from 3 to 2, and added percentage threshold
    const firstChars = searchTerm.length >= 3 ? searchTerm.substring(0, 3) : searchTerm;
    const query = `
      SELECT * FROM persons 
      WHERE full_name LIKE ?
    `;
    
    const [candidates] = await this.connection!.execute(query, [`${firstChars}%`]);
    
    // Calculate Levenshtein distance for each candidate
    const results: Person[] = [];
    
    for (const candidate of candidates as Person[]) {
      if (candidate.full_name) {
        // Calculate distance using MySQL function
        const distQuery = "SELECT LEVENSHTEIN(?, ?) as distance";
        const [distResult] = await this.connection!.execute(distQuery, 
          [searchTerm.toLowerCase(), candidate.full_name.toLowerCase()]);
        const distance = (distResult as any)[0].distance;
        
        // Calculate percentage threshold - distance should be less than 30% of the longer string
        const maxLength = Math.max(searchTerm.length, candidate.full_name.length);
        const percentageThreshold = Math.ceil(maxLength * 0.3);
        
        if (distance <= Math.min(maxDistance, percentageThreshold)) {
          candidate.levenshtein_distance = distance;
          results.push(candidate);
        }
      }
    }
    
    // Sort by distance
    results.sort((a, b) => (a.levenshtein_distance || 0) - (b.levenshtein_distance || 0));
    return results.slice(0, 20);
  }

  async strictLevenshteinSearch(searchTerm: string, maxDistance: number = 3): Promise<Person[]> {
    const query = `
      SELECT *, LEVENSHTEIN(full_name, ?) AS distance
      FROM persons
      HAVING distance <= ?
      ORDER BY distance ASC
      LIMIT 20
    `;
    const [rows] = await this.connection!.execute(query, [
      searchTerm.toLowerCase(),
      Math.min(maxDistance, Math.ceil(searchTerm.length * 0.3)),
    ]);
    return rows as Person[];
  }

  async strictSoundexSearch(searchTerm: string, maxDistance: number = 3): Promise<Person[]> {
    const query = `
      SELECT *, LEVENSHTEIN(full_name, ?) AS distance
      FROM persons 
      WHERE SOUNDEX(full_name) = SOUNDEX(?)
      HAVING distance <= ?
      ORDER BY distance ASC
      LIMIT 20
    `; // distance should be dynamic based on the search term length
    const [rows] = await this.connection!.execute(query, [searchTerm, searchTerm, Math.min(maxDistance, Math.ceil(searchTerm.length * 0.3)),    ]);
    return rows as Person[];
  }

  async combinedSearch(searchTerm: string): Promise<SearchResult[]> {
    const results: Map<number, SearchResult> = new Map();
    const scores: Map<number, number> = new Map();
    const foundBy: Map<number, Set<string>> = new Map();
    
    // 1. Exact search (highest priority)
    const exactResults = await this.exactSearch(searchTerm);
    for (const r of exactResults) {
      results.set(r.id, r);
      scores.set(r.id, (scores.get(r.id) || 0) + 10);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add('Exact');
    }
    
    // 2. Normalized search (high priority for handling spaces/apostrophes)
    const normalizedResults = await this.normalizedSearch(searchTerm);
    for (const r of normalizedResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      scores.set(r.id, (scores.get(r.id) || 0) + 8);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add('Normalized');
    }
    
    // 3. Strict Soundex search (high priority - exact soundex match)
    const strictSoundexResults = await this.strictSoundexSearch(searchTerm, searchTerm.replace(/\s/g,'').length * 0.6);
    for (const r of strictSoundexResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      scores.set(r.id, (scores.get(r.id) || 0) + 4);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add('Soundex');
    }
    
    // 5. Wildcard search (low priority)
    const wildcardResults = await this.wildcardSearch(searchTerm);
    for (const r of wildcardResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      scores.set(r.id, (scores.get(r.id) || 0) + 2);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add('Wildcard');
    }
    
    const strictLevenshteinResults = await this.strictLevenshteinSearch(searchTerm, searchTerm.replace(/\s/g,'').length * 0.6);
    for (const r of strictLevenshteinResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      // Increased base score since it's more strict now
      scores.set(r.id, (scores.get(r.id) || 0) + 6);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add(`Levenshtein`);
    }
    
    // Sort by score
    const sortedResults = Array.from(results.entries())
      .map(([id, person]) => ({ 
        ...person, 
        score: scores.get(id) || 0,
        foundBy: Array.from(foundBy.get(id) || [])
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    return sortedResults;
  }

  displayResults(results: SearchResult[], searchTerm: string, method: string): void {
    console.log('\n' + '='.repeat(80));
    console.log(`Search Method: ${method}`);
    console.log(`Search Term: '${searchTerm}'`);
    console.log(`Results Found: ${results.length}`);
    console.log('='.repeat(80));
    
    if (results.length === 0) {
      console.log('No results found.');
      return;
    }
    
    console.log(`\n${'ID'.padEnd(6)} ${'Full Name'.padEnd(40)} ${'Score'.padEnd(10)} ${'Found By'.padEnd(30)}`);
    console.log(`${'-'.repeat(6)} ${'-'.repeat(40)} ${'-'.repeat(10)} ${'-'.repeat(30)}`);
    
    for (const r of results.slice(0, 10)) {
      const foundByStr = r.foundBy ? r.foundBy.join(', ') : '';
      const score = r.score ? r.score.toFixed(2) : '0.00';
      console.log(`${r.id.toString().padEnd(6)} ${r.full_name.padEnd(40)} ${score.padEnd(10)} ${foundByStr.padEnd(30)}`);
    }
  }

  async debugSoundex(searchTerm: string, compareTerms: string[]): Promise<void> {
    console.log('\n--- Soundex Debug ---');
    console.log(`Search term: "${searchTerm}"`);
    
    // Get soundex of search term
    const [searchSoundex] = await this.connection!.execute(
      'SELECT SOUNDEX(?) as soundex', 
      [searchTerm]
    );
    console.log(`Soundex of "${searchTerm}": ${(searchSoundex as any)[0].soundex}`);
    
    console.log('\nComparing with:');
    for (const term of compareTerms) {
      const [termSoundex] = await this.connection!.execute(
        'SELECT SOUNDEX(?) as soundex', 
        [term]
      );
      console.log(`  "${term}": ${(termSoundex as any)[0].soundex}`);
    }
  }
}

async function runTestSearches(): Promise<void> {
  const search = new PersonSearch();
  
  if (!await search.connect()) {
    console.log('Failed to connect to database');
    return;
  }
  
  const testCases: [string, string][] = [
    ["MaryAnn", "Mary Ann"],
    ["Mary Ann", "MaryAnn"],
    ["D'Souza", "DSouza"],
    ["DSouza", "D'Souza"],
    ["Mirage Air Craft", "Mirage AirCraft"],
    ["Mirage AirCraft", "Mirage Air Craft"],
    ["Jean-Pierre", "JeanPierre"],
    ["O'Brien", "OBrien"],
    ["MacDonald", "Mac Donald"],
  ];
  
  console.log('\n' + '='.repeat(80));
  console.log('RUNNING TEST SEARCHES');
  console.log('='.repeat(80));
  
  for (const [searchTerm, expected] of testCases) {
    console.log('\n\n' + '*'.repeat(80));
    console.log(`SEARCHING FOR: '${searchTerm}' (expecting to find variations like '${expected}')`);
    console.log('*'.repeat(80));
    
    // Run combined search (best approach)
    const results = await search.combinedSearch(searchTerm);
    search.displayResults(results, searchTerm, "COMBINED SEARCH (Best Results)");
    
    // Also show individual search methods for comparison
    console.log('\n--- Individual Search Methods for Comparison ---');
    
    // Normalized search (good for spaces/apostrophes)
    const normResults = await search.normalizedSearch(searchTerm);
    if (normResults.length > 0) {
      console.log(`\nNormalized Search found ${normResults.length} results`);
    }
    
    // Soundex search
    const soundexResults = await search.soundexSearch(searchTerm);
    if (soundexResults.length > 0) {
      console.log(`Soundex Search found ${soundexResults.length} results`);
    }
    
    // Levenshtein search
    const levResults = await search.levenshteinSearch(searchTerm);
    if (levResults.length > 0) {
      console.log(`Levenshtein Search found ${levResults.length} results`);
    }
  }
  
  await search.close();
}

async function interactiveSearch(): Promise<void> {
  const search = new PersonSearch();
  
  if (!await search.connect()) {
    console.log('Failed to connect to database');
    return;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('INTERACTIVE PERSON SEARCH');
  console.log('='.repeat(80));
  console.log("Type 'quit' to exit");
  console.log("Type 'debug soundex <term1> <term2> ...' to debug soundex values");
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const askQuestion = (): Promise<void> => {
    return new Promise((resolve) => {
      rl.question('\nEnter search term: ', async (input) => {
        const trimmedInput = input.trim();
        
        if (trimmedInput.toLowerCase() === 'quit') {
          rl.close();
          await search.close();
          console.log('\nGoodbye!');
          resolve();
          return;
        }
        
        // Check for debug command
        if (trimmedInput.toLowerCase().startsWith('debug soundex ')) {
          const terms = trimmedInput.substring(14).split(' ').filter(t => t.length > 0);
          if (terms.length > 0) {
            const [searchTerm, ...compareTerms] = terms;
            await search.debugSoundex(searchTerm, compareTerms);
          }
        } else if (trimmedInput) {
          // Use combined search for best results
          const results = await search.combinedSearch(trimmedInput);
          search.displayResults(results, trimmedInput, "COMBINED SEARCH");
        }
        
        // Continue asking
        resolve(askQuestion());
      });
    });
  };
  
  await askQuestion();
}

async function main(): Promise<void> {
  // Run test searches
  // await runTestSearches();
  
  // Run interactive search
  console.log('\n\n');
  await interactiveSearch();
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
} 