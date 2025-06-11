import { Pool } from "pg";
import * as readline from "readline";
import { DB_CONFIG, Person } from "./db_config";

interface SearchResult extends Person {
  score?: number;
  foundBy?: string[];
}

export default class PersonSearch {
  pool: Pool;

  constructor() {
    this.pool = new Pool(DB_CONFIG);
  }

  async connect(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      client.release();
      return true;
    } catch (error) {
      console.error("Error connecting to PostgreSQL:", error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async exactSearch(searchTerm: string): Promise<Person[]> {
    const query = `
      SELECT * FROM persons 
      WHERE full_name = $1
      LIMIT 10
    `;

    const result = await this.pool.query(query, [searchTerm]);
    return result.rows as Person[];
  }

  async wildcardSearch(searchTerm: string): Promise<Person[]> {
    // Handle both versions of the name (with and without apostrophe)
    const normalizedTerm = searchTerm.replace("'", "");
    const query = `
      SELECT * FROM persons 
      WHERE LOWER(full_name) LIKE LOWER($1) 
         OR LOWER(full_name) LIKE LOWER($2)
      LIMIT 20
    `;

    const result = await this.pool.query(query, [
      `%${searchTerm}%`,
      `%${normalizedTerm}%`,
    ]);
    return result.rows as Person[];
  }

  async normalizedSearch(searchTerm: string): Promise<Person[]> {
    // Use the custom normalize_text function for better performance
    const query = `
      SELECT * FROM persons 
      WHERE normalize_text(full_name) = normalize_text($1)
      LIMIT 20
    `;

    try {
      const result = await this.pool.query(query, [searchTerm]);
      return result.rows as Person[];
    } catch (error) {
      console.warn(
        "Normalized search failed, falling back to wildcard search:",
        error,
      );
      return this.wildcardSearch(searchTerm);
    }
  }

  async fulltextSearch(searchTerm: string): Promise<Person[]> {
    // PostgreSQL full-text search with ranking
    const searchTerms = searchTerm.split(/\s+/).join(" & ");
    const query = `
      SELECT *, 
             ts_rank(to_tsvector('english', coalesce(first_name, '') || ' ' || 
                                coalesce(last_name, '') || ' ' || coalesce(full_name, '')), 
                    to_tsquery('english', $1)) as relevance
      FROM persons 
      WHERE to_tsvector('english', coalesce(first_name, '') || ' ' || 
                       coalesce(last_name, '') || ' ' || coalesce(full_name, '')) 
            @@ to_tsquery('english', $1)
      ORDER BY relevance DESC
      LIMIT 20
    `;

    try {
      const result = await this.pool.query(query, [searchTerms]);
      return result.rows as Person[];
    } catch (error) {
      // Fallback to simpler search if tsquery fails
      console.warn(
        "Full-text search failed, falling back to wildcard search:",
        error,
      );
      return this.wildcardSearch(searchTerm);
    }
  }

  async soundexSearch(searchTerm: string): Promise<Person[]> {
    // PostgreSQL soundex search with additional phonetic matching
    const query = `
      SELECT * FROM persons 
      WHERE soundex(first_name) = soundex($1)
         OR soundex(last_name) = soundex($1)
         OR soundex(full_name) = soundex($1)
         OR metaphone(first_name, 10) = metaphone($1, 10)
         OR metaphone(last_name, 10) = metaphone($1, 10)
         OR metaphone(full_name, 10) = metaphone($1, 10)
      LIMIT 20
    `;

    try {
      const result = await this.pool.query(query, [searchTerm]);
      return result.rows as Person[];
    } catch (error) {
      console.warn(
        "Soundex search failed, falling back to wildcard search:",
        error,
      );
      return this.wildcardSearch(searchTerm);
    }
  }

  async metaphoneSearch(searchTerm: string): Promise<Person[]> {
    // Metaphone - phonetic matching algorithm
    const query = `
      SELECT *, 
             metaphone(full_name, 10) as metaphone_code,
             metaphone($1, 10) as search_metaphone_code
      FROM persons 
      WHERE metaphone(full_name, 10) = metaphone($1, 10)
         OR metaphone(first_name, 10) = metaphone($1, 10)
         OR metaphone(last_name, 10) = metaphone($1, 10)
      LIMIT 20000
    `;

    try {
      const result = await this.pool.query(query, [searchTerm]);
      return result.rows.map((row) => ({
        ...row,
        metaphone_code: row.metaphone_code,
        search_metaphone_code: row.search_metaphone_code,
      })) as Person[];
    } catch (error) {
      console.warn(
        "Metaphone search failed, falling back to soundex search:",
        error,
      );
      return this.soundexSearch(searchTerm);
    }
  }

  async strictMetaphoneSearch(
    searchTerm: string,
    maxDistance: number = 3,
  ): Promise<Person[]> {
    // Strict Metaphone search with Levenshtein distance filtering
    const searchTermNoSpaces = searchTerm.replace(/\s/g, "");
    const dynamicMaxDistance = Math.min(
      maxDistance,
      Math.ceil(searchTermNoSpaces.length * 0.6),
    );

    const query = `
      SELECT *, 
             levenshtein(full_name, $1) AS distance,
             metaphone(full_name, 10) as metaphone_code
      FROM persons 
      WHERE metaphone(full_name, 10) = metaphone($1, 10)
        AND levenshtein(full_name, $1) <= $2
      ORDER BY distance ASC
      LIMIT 20
    `;

    try {
      const result = await this.pool.query(query, [
        searchTerm,
        Math.floor(dynamicMaxDistance),
      ]);
      return result.rows.map((row) => ({
        ...row,
        levenshtein_distance: row.distance,
        metaphone_code: row.metaphone_code,
      })) as Person[];
    } catch (error) {
      console.warn(
        "Strict Metaphone search failed, falling back to regular search:",
        error,
      );
      return this.metaphoneSearch(searchTerm);
    }
  }

  async dmetaphoneSearch(searchTerm: string): Promise<Person[]> {
    // Double Metaphone - superior phonetic matching algorithm
    // More sophisticated than regular Metaphone, handles multiple pronunciations
    const query = `
      SELECT *, 
             dmetaphone(full_name) as dm_codes,
             dmetaphone($1) as search_dm_codes
      FROM persons 
      WHERE (
        dmetaphone(full_name) = dmetaphone($1)
        OR dmetaphone_alt(full_name) = dmetaphone($1)
        OR dmetaphone(full_name) = dmetaphone_alt($1)
        OR dmetaphone_alt(full_name) = dmetaphone_alt($1)
      )
      LIMIT 200000
    `;

    try {
      const result = await this.pool.query(query, [searchTerm]);
      return result.rows.map((row) => ({
        ...row,
        dm_codes: row.dm_codes,
        search_dm_codes: row.search_dm_codes,
      })) as Person[];
    } catch (error) {
      console.warn(
        "Double Metaphone search failed, falling back to soundex search:",
        error,
      );
      return this.soundexSearch(searchTerm);
    }
  }

  async strictDMetaphoneSearch(
    searchTerm: string,
    maxDistance: number = 3,
  ): Promise<Person[]> {
    // Strict Double Metaphone search with Levenshtein distance filtering
    const searchTermNoSpaces = searchTerm.replace(/\s/g, "");
    const dynamicMaxDistance = Math.min(
      maxDistance,
      Math.ceil(searchTermNoSpaces.length * 0.6),
    );

    const query = `
      SELECT *, 
             levenshtein(full_name, $1) AS distance,
             dmetaphone(full_name) as dm_codes
      FROM persons 
      WHERE (
        dmetaphone(full_name) = dmetaphone($1)
        OR dmetaphone_alt(full_name) = dmetaphone($1)
        OR dmetaphone(full_name) = dmetaphone_alt($1)
        OR dmetaphone_alt(full_name) = dmetaphone_alt($1)
      )
      AND levenshtein(full_name, $1) <= $2
      ORDER BY distance ASC
      LIMIT 20
    `;

    try {
      const result = await this.pool.query(query, [
        searchTerm,
        Math.floor(dynamicMaxDistance),
      ]);
      return result.rows.map((row) => ({
        ...row,
        levenshtein_distance: row.distance,
        dm_codes: row.dm_codes,
      })) as Person[];
    } catch (error) {
      console.warn(
        "Strict Double Metaphone search failed, falling back to regular search:",
        error,
      );
      return this.dmetaphoneSearch(searchTerm);
    }
  }

  async levenshteinSearch(
    searchTerm: string,
    maxDistance: number = 2,
  ): Promise<Person[]> {
    // PostgreSQL Levenshtein distance with percentage threshold
    const maxLength = Math.max(searchTerm.length, 10); // assume minimum name length of 10
    const percentageThreshold = Math.ceil(maxLength * 0.3);
    const finalMaxDistance = Math.min(maxDistance, percentageThreshold);

    const query = `
      SELECT *, levenshtein(LOWER(full_name), LOWER($1)) as distance
      FROM persons
      WHERE levenshtein(LOWER(full_name), LOWER($1)) <= $2
        AND LENGTH(full_name) > 0
      ORDER BY distance ASC
      LIMIT 20
    `;

    try {
      const result = await this.pool.query(query, [
        searchTerm,
        finalMaxDistance,
      ]);
      return result.rows.map((row) => ({
        ...row,
        levenshtein_distance: row.distance,
      })) as Person[];
    } catch (error) {
      console.warn(
        "Levenshtein search failed, falling back to wildcard search:",
        error,
      );
      return this.wildcardSearch(searchTerm);
    }
  }

  async trigramSearch(
    searchTerm: string,
    threshold: number = 0.3,
  ): Promise<Person[]> {
    // PostgreSQL trigram similarity search - excellent for handling spaces, punctuation
    const query = `
      SELECT *, similarity(full_name, $1) as sim
      FROM persons
      WHERE similarity(full_name, $1) >= $2
      ORDER BY sim DESC
      LIMIT 20000
    `;

    try {
      const result = await this.pool.query(query, [searchTerm, threshold]);
      return result.rows.map((row) => ({
        ...row,
        similarity: row.sim,
      })) as Person[];
    } catch (error) {
      console.warn(
        "Trigram search failed, falling back to wildcard search:",
        error,
      );
      return this.wildcardSearch(searchTerm);
    }
  }

  async strictTrigramSearch(
    searchTerm: string,
    threshold: number = 0.6,
  ): Promise<Person[]> {
    // More strict trigram search with higher threshold and additional constraints
    const query = `
      SELECT *, similarity(full_name, $1) as sim
      FROM persons
      WHERE similarity(full_name, $1) > $2
        AND length(full_name) BETWEEN $3 AND $4  -- Length similarity constraint
        AND substr(lower(full_name), 1, 1) = substr(lower($1), 1, 1)  -- First letter match
      ORDER BY sim DESC
      LIMIT 10
    `;

    const minLength = Math.max(1, searchTerm.length - 3);
    const maxLength = searchTerm.length + 3;

    try {
      const result = await this.pool.query(query, [
        searchTerm,
        threshold,
        minLength,
        maxLength,
      ]);
      return result.rows.map((row) => ({
        ...row,
        similarity: row.sim,
      })) as Person[];
    } catch (error) {
      console.warn(
        "Strict trigram search failed, falling back to wildcard search:",
        error,
      );
      return this.wildcardSearch(searchTerm);
    }
  }

  async adaptiveTrigramSearch(searchTerm: string): Promise<Person[]> {
    // Adaptive threshold based on search term length
    let threshold: number;
    if (searchTerm.length <= 4) {
      threshold = 0.8; // Very strict for short terms
    } else if (searchTerm.length <= 8) {
      threshold = 0.6; // Moderately strict for medium terms
    } else {
      threshold = 0.4; // More lenient for long terms
    }

    const query = `
      SELECT *, 
             similarity(full_name, $1) as sim,
             levenshtein(lower(full_name), lower($1)) as distance
      FROM persons
      WHERE similarity(full_name, $1) > $2
        AND levenshtein(lower(full_name), lower($1)) <= $3
      ORDER BY sim DESC, distance ASC
      LIMIT 15
    `;

    const maxDistance = Math.ceil(searchTerm.length * 0.3);

    try {
      const result = await this.pool.query(query, [
        searchTerm,
        threshold,
        maxDistance,
      ]);
      return result.rows.map((row) => ({
        ...row,
        similarity: row.sim,
        levenshtein_distance: row.distance,
      })) as Person[];
    } catch (error) {
      console.warn(
        "Adaptive trigram search failed, falling back to wildcard search:",
        error,
      );
      return this.wildcardSearch(searchTerm);
    }
  }

  async preciseTrigramSearch(searchTerm: string): Promise<Person[]> {
    // Most precise trigram search with multiple constraints
    const threshold = 0.7;
    const query = `
      SELECT *, 
             similarity(full_name, $1) as sim,
             word_similarity(full_name, $1) as word_sim
      FROM persons
      WHERE similarity(full_name, $1) > $2
        AND word_similarity(full_name, $1) > $3
        AND length(full_name) BETWEEN $4 AND $5
        AND (
          -- Ensure significant character overlap
          similarity(full_name, $1) > 0.7 
          OR (
            levenshtein(lower(full_name), lower($1)) <= 2 
            AND similarity(full_name, $1) > 0.5
          )
        )
      ORDER BY sim DESC, word_sim DESC
      LIMIT 8
    `;

    const wordThreshold = 0.6;
    const minLength = Math.max(1, searchTerm.length - 2);
    const maxLength = searchTerm.length + 2;

    try {
      const result = await this.pool.query(query, [
        searchTerm,
        threshold,
        wordThreshold,
        minLength,
        maxLength,
      ]);
      return result.rows.map((row) => ({
        ...row,
        similarity: row.sim,
        word_similarity: row.word_sim,
      })) as Person[];
    } catch (error) {
      console.warn(
        "Precise trigram search failed, falling back to strict trigram search:",
        error,
      );
      return this.strictTrigramSearch(searchTerm);
    }
  }

  async strictLevenshteinSearch(
    searchTerm: string,
    maxDistance: number = 3,
  ): Promise<Person[]> {
    const searchTermNoSpaces = searchTerm.replace(/\s/g, "");
    const dynamicMaxDistance = Math.min(
      maxDistance,
      Math.ceil(searchTermNoSpaces.length * 0.6),
    );

    const query = `
      SELECT *, levenshtein(full_name, $1) AS distance
      FROM persons
      WHERE levenshtein(full_name, $1) <= $2
      ORDER BY distance ASC
      LIMIT 20000
    `;

    try {
      const result = await this.pool.query(query, [
        searchTerm,
        Math.floor(dynamicMaxDistance),
      ]);
      return result.rows as Person[];
    } catch (error) {
      console.warn(
        "Strict Levenshtein search failed, falling back to wildcard search:",
        error,
      );
      return this.wildcardSearch(searchTerm);
    }
  }

  async strictSoundexSearch(
    searchTerm: string,
    maxDistance: number = 3,
  ): Promise<Person[]> {
    const searchTermNoSpaces = searchTerm.replace(/\s/g, "");
    const dynamicMaxDistance = Math.min(
      maxDistance,
      Math.ceil(searchTermNoSpaces.length * 0.6),
    );

    const query = `
      SELECT *, levenshtein(full_name, $1) AS distance
      FROM persons 
      WHERE soundex(full_name) = soundex($1)
        AND levenshtein(full_name, $1) <= $2
      ORDER BY distance ASC
      LIMIT 20
    `;

    try {
      const result = await this.pool.query(query, [
        searchTerm,
        Math.floor(dynamicMaxDistance),
      ]);
      return result.rows as Person[];
    } catch (error) {
      console.warn(
        "Strict Soundex search failed, falling back to wildcard search:",
        error,
      );
      return this.wildcardSearch(searchTerm);
    }
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
      foundBy.get(r.id)!.add("Exact");
    }

    // 2. Normalized search (high priority for handling spaces/apostrophes)
    const normalizedResults = await this.normalizedSearch(searchTerm);
    for (const r of normalizedResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      scores.set(r.id, (scores.get(r.id) || 0) + 8);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add("Normalized");
    }

    // 3. Trigram search (high priority - excellent for PostgreSQL)
    const trigramResults = await this.trigramSearch(searchTerm, 0.6);
    for (const r of trigramResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      // Score based on similarity
      const similarityScore = (r.similarity || 0) * 6;
      scores.set(r.id, (scores.get(r.id) || 0) + similarityScore);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add("Trigram");
    }

    // 4. Strict Soundex search (medium priority - exact soundex match)
    const searchTermNoSpaces = searchTerm.replace(/\s/g, "");
    const maxSoundexDistance = Math.floor(searchTermNoSpaces.length * 0.6);
    const strictSoundexResults = await this.strictSoundexSearch(
      searchTerm,
      maxSoundexDistance,
    );
    for (const r of strictSoundexResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      scores.set(r.id, (scores.get(r.id) || 0) + 4);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add("Soundex");
    }

    // 4.2. Metaphone search (medium priority - phonetic matching)
    const metaphoneResults = await this.strictMetaphoneSearch(searchTerm);
    for (const r of metaphoneResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      scores.set(r.id, (scores.get(r.id) || 0) + 4.5);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add("Metaphone");
    }

    // 4.5. DMetaphone search (medium-high priority - advanced phonetic matching)
    const dmetaphoneResults = await this.strictDMetaphoneSearch(searchTerm);
    for (const r of dmetaphoneResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      scores.set(r.id, (scores.get(r.id) || 0) + 5);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add("DMetaphone");
    }

    // 5. Wildcard search (low priority)
    const wildcardResults = await this.wildcardSearch(searchTerm);
    for (const r of wildcardResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      scores.set(r.id, (scores.get(r.id) || 0) + 2);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add("Wildcard");
    }

    // 6. Strict Levenshtein search
    const maxLevenshteinDistance = Math.floor(searchTermNoSpaces.length * 0.3);
    const strictLevenshteinResults = await this.strictLevenshteinSearch(
      searchTerm,
      maxLevenshteinDistance,
    );
    for (const r of strictLevenshteinResults) {
      if (!results.has(r.id)) {
        results.set(r.id, r);
      }
      scores.set(r.id, (scores.get(r.id) || 0) + 6);
      if (!foundBy.has(r.id)) foundBy.set(r.id, new Set());
      foundBy.get(r.id)!.add("Levenshtein");
    }

    // Sort by score
    const sortedResults = Array.from(results.entries())
      .map(([id, person]) => ({
        ...person,
        score: scores.get(id) || 0,
        foundBy: Array.from(foundBy.get(id) || []),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    return sortedResults;
  }

  displayResults(
    results: SearchResult[],
    searchTerm: string,
    method: string,
  ): void {
    console.log("\n" + "=".repeat(80));
    console.log(`Search Method: ${method}`);
    console.log(`Search Term: '${searchTerm}'`);
    console.log(`Results Found: ${results.length}`);
    console.log("=".repeat(80));

    if (results.length === 0) {
      console.log("No results found.");
      return;
    }

    console.log(
      `\n${"ID".padEnd(6)} ${"Full Name".padEnd(40)} ${"Score".padEnd(10)} ${"Found By".padEnd(30)}`,
    );
    console.log(
      `${"-".repeat(6)} ${"-".repeat(40)} ${"-".repeat(10)} ${"-".repeat(30)}`,
    );

    for (const r of results.slice(0, 10)) {
      const foundByStr = r.foundBy ? r.foundBy.join(", ") : "";
      const score = r.score ? r.score.toFixed(2) : "0.00";
      console.log(
        `${r.id.toString().padEnd(6)} ${r.full_name.padEnd(40)} ${score.padEnd(10)} ${foundByStr.padEnd(30)}`,
      );
    }
  }

  async debugSoundex(
    searchTerm: string,
    compareTerms: string[],
  ): Promise<void> {
    console.log("\n--- Soundex Debug ---");
    console.log(`Search term: "${searchTerm}"`);

    // Get soundex of search term
    const searchResult = await this.pool.query(
      "SELECT soundex($1) as soundex",
      [searchTerm],
    );
    console.log(`Soundex of "${searchTerm}": ${searchResult.rows[0].soundex}`);

    console.log("\nComparing with:");
    for (const term of compareTerms) {
      const termResult = await this.pool.query(
        "SELECT soundex($1) as soundex",
        [term],
      );
      console.log(`  "${term}": ${termResult.rows[0].soundex}`);
    }
  }

  async debugMetaphone(
    searchTerm: string,
    compareTerms: string[],
  ): Promise<void> {
    console.log("\n--- Metaphone Debug ---");
    console.log(`Search term: "${searchTerm}"`);

    // Get metaphone of search term
    const searchResult = await this.pool.query(
      "SELECT metaphone($1, 10) as metaphone_code",
      [searchTerm],
    );
    console.log(
      `Metaphone code of "${searchTerm}": ${searchResult.rows[0].metaphone_code}`,
    );

    console.log("\nComparing with:");
    for (const term of compareTerms) {
      const termResult = await this.pool.query(
        "SELECT metaphone($1, 10) as metaphone_code",
        [term],
      );
      console.log(`  "${term}": ${termResult.rows[0].metaphone_code}`);
    }
  }

  async debugDMetaphone(
    searchTerm: string,
    compareTerms: string[],
  ): Promise<void> {
    console.log("\n--- DMetaphone Debug ---");
    console.log(`Search term: "${searchTerm}"`);

    // Get DMetaphone codes of search term
    const searchResult = await this.pool.query(
      "SELECT dmetaphone($1) as dm_codes",
      [searchTerm],
    );
    console.log(
      `DMetaphone codes of "${searchTerm}": ${JSON.stringify(searchResult.rows[0].dm_codes)}`,
    );

    console.log("\nComparing with:");
    for (const term of compareTerms) {
      const termResult = await this.pool.query(
        "SELECT dmetaphone($1) as dm_codes",
        [term],
      );
      console.log(
        `  "${term}": ${JSON.stringify(termResult.rows[0].dm_codes)}`,
      );
    }
  }
}

async function runTestSearches(): Promise<void> {
  const search = new PersonSearch();

  if (!(await search.connect())) {
    console.log("Failed to connect to database");
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

  console.log("\n" + "=".repeat(80));
  console.log("RUNNING TEST SEARCHES");
  console.log("=".repeat(80));

  for (const [searchTerm, expected] of testCases) {
    console.log("\n\n" + "*".repeat(80));
    console.log(
      `SEARCHING FOR: '${searchTerm}' (expecting to find variations like '${expected}')`,
    );
    console.log("*".repeat(80));

    // Run combined search (best approach)
    const results = await search.combinedSearch(searchTerm);
    search.displayResults(
      results,
      searchTerm,
      "COMBINED SEARCH (Best Results)",
    );

    // Also show individual search methods for comparison
    console.log("\n--- Individual Search Methods for Comparison ---");

    // Normalized search (good for spaces/apostrophes)
    const normResults = await search.normalizedSearch(searchTerm);
    if (normResults.length > 0) {
      console.log(`\nNormalized Search found ${normResults.length} results`);
    }

    // Trigram search (excellent for PostgreSQL)
    const trigramResults = await search.trigramSearch(searchTerm);
    if (trigramResults.length > 0) {
      console.log(`Trigram Search found ${trigramResults.length} results`);
    }

    // Soundex search
    const soundexResults = await search.soundexSearch(searchTerm);
    if (soundexResults.length > 0) {
      console.log(`Soundex Search found ${soundexResults.length} results`);
    }

    // Metaphone search (phonetic matching)
    const metaphoneResults = await search.metaphoneSearch(searchTerm);
    if (metaphoneResults.length > 0) {
      console.log(`Metaphone Search found ${metaphoneResults.length} results`);
    }

    // DMetaphone search (advanced phonetic matching)
    const dmetaphoneResults = await search.dmetaphoneSearch(searchTerm);
    if (dmetaphoneResults.length > 0) {
      console.log(
        `DMetaphone Search found ${dmetaphoneResults.length} results`,
      );
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

  if (!(await search.connect())) {
    console.log("Failed to connect to database");
    return;
  }

  console.log("\n" + "=".repeat(80));
  console.log("INTERACTIVE PERSON SEARCH");
  console.log("=".repeat(80));
  console.log("Type 'quit' to exit");
  console.log(
    "Type 'debug soundex <term1> <term2> ...' to debug soundex values",
  );
  console.log(
    "Type 'debug metaphone <term1> <term2> ...' to debug metaphone codes",
  );
  console.log(
    "Type 'debug dmetaphone <term1> <term2> ...' to debug DMetaphone codes",
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = (): Promise<void> => {
    return new Promise((resolve) => {
      rl.question("\nEnter search term: ", async (input) => {
        const trimmedInput = input.trim();

        if (trimmedInput.toLowerCase() === "quit") {
          rl.close();
          await search.close();
          console.log("\nGoodbye!");
          resolve();
          return;
        }

        // Check for debug commands
        if (trimmedInput.toLowerCase().startsWith("debug soundex ")) {
          const terms = trimmedInput
            .substring(14)
            .split(" ")
            .filter((t) => t.length > 0);
          if (terms.length > 0) {
            const [searchTerm, ...compareTerms] = terms;
            await search.debugSoundex(searchTerm, compareTerms);
          }
        } else if (trimmedInput.toLowerCase().startsWith("debug metaphone ")) {
          const terms = trimmedInput
            .substring(16)
            .split(" ")
            .filter((t) => t.length > 0);
          if (terms.length > 0) {
            const [searchTerm, ...compareTerms] = terms;
            await search.debugMetaphone(searchTerm, compareTerms);
          }
        } else if (trimmedInput.toLowerCase().startsWith("debug dmetaphone ")) {
          const terms = trimmedInput
            .substring(17)
            .split(" ")
            .filter((t) => t.length > 0);
          if (terms.length > 0) {
            const [searchTerm, ...compareTerms] = terms;
            await search.debugDMetaphone(searchTerm, compareTerms);
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
  console.log("\n\n");
  await interactiveSearch();
}

// Run if this is the main module
if (require.main === module) {
  main().catch(console.error);
}
