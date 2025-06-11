## PostgreSQL Fuzzy String Search POC

This is a comprehensive fuzzy string search implementation using PostgreSQL with advanced text search capabilities. It includes both TypeScript implementations with multiple search algorithms optimized for PostgreSQL.

## Setup

### Prerequisites

- PostgreSQL 12+ (with pg_trgm and fuzzystrmatch extensions)
- Node.js 16+ (for TypeScript version)

### Installation

1. Clone the repository:

```bash
cd /Users/dkumar/fuzzy-string-search/backend/pg-search
```

### For TypeScript Version:

2. Install Node.js dependencies:

```bash
npm install
```

3. Create the database and schema:

```bash
chmod +x setup.sh
./setup.sh
# or manually create database and run schema.sql
```

4. Update database credentials in `db_config.ts`

5. Populate the database:

```bash
npm run populate
# or: npx ts-node populate_database.ts
```

6. Run the search demo:

```bash
npm run search
# or: npx ts-node search_queries.ts
```

7. Run test cases validation:

```bash
npm run test-cases
# or: npx ts-node test_search_cases.ts
```

## PostgreSQL-Specific Features

### Advanced Extensions Used

- **pg_trgm**: Trigram matching for fuzzy text search
- **fuzzystrmatch**: Levenshtein distance and Soundex/Metaphone functions

### Search Algorithms

1. **Trigram Similarity Search** (PostgreSQL's strength)

   - Uses `similarity()` function and `%` operator
   - Excellent for handling spaces, punctuation, and minor variations
   - Threshold-based matching with configurable similarity scores

2. **Levenshtein Distance**

   - Built-in `levenshtein()` function
   - Dynamic threshold based on string length
   - Percentage-based distance calculations

3. **Full-Text Search**

   - PostgreSQL's `to_tsvector` and `to_tsquery`
   - Ranked results with `ts_rank()`
   - Language-aware text processing

4. **Soundex and Metaphone**

   - Phonetic matching algorithms
   - Multiple metaphone variations for better coverage

5. **Normalized Search**
   - Custom `normalize_text()` function
   - Removes spaces, punctuation, and special characters
   - Indexed for performance

### Combined Search Scoring

The combined search uses weighted scoring:

- Exact match: 10 points
- Normalized match: 8 points
- Trigram similarity: 6 × similarity score
- Strict Levenshtein: 6 points
- Soundex match: 4 points
- Wildcard match: 2 points

Results are sorted by total score, returning the best matches.

## Usage

### Test Cases

The script automatically tests these variations:

- "MaryAnn" vs "Mary Ann" (space variations)
- "D'Souza" vs "DSouza" (apostrophe variations)
- "Mirage Air Craft" vs "Mirage AirCraft" (compound word variations)
- Entity name variations (abbreviations, translations)
- Individual name variations (nicknames, full names)

### Interactive Search

After running test cases, you can search interactively:

```
Enter search term: Mary Ann
```

Special commands:

```
debug soundex Mary Ann MaryAnn
```

## Files Description

### TypeScript Implementation:

- `db_config.ts` - PostgreSQL connection pool configuration
- `populate_database.ts` - Populates database with 10,000 sample entries
- `search_queries.ts` - Main search implementation with all strategies
- `test_search_cases.ts` - Test validation script
- `package.json` - Node.js dependencies (pg, @faker-js/faker)
- `tsconfig.json` - TypeScript configuration

### Common Files:

- `schema.sql` - PostgreSQL schema with extensions, indexes, and functions
- `setup.sh` - Automated setup script for PostgreSQL
- `README.md` - This documentation file

## Performance Optimizations

### Indexes Created:

- B-tree indexes on first_name, last_name, full_name
- GIN trigram indexes for fuzzy matching
- GIN full-text search index
- Functional index on normalized text

### Query Optimizations:

- Connection pooling for TypeScript version
- Batch inserts for data population
- Prepared statements and parameterized queries
- Efficient trigram threshold settings

## Example Output

```
================================================================================
Search Method: COMBINED SEARCH (Best Results)
Search Term: 'MaryAnn'
Results Found: 10
================================================================================

ID     Full Name                     Score      Found By
------ ----------------------------- ---------- ------------------------------
2      MaryAnn Smith                 10.00      Exact
1      Mary Ann                      8.00       Normalized
15     Mary Anne Johnson             4.80       Trigram
```

## PostgreSQL Advantages

1. **Superior Fuzzy Matching**: pg_trgm provides excellent fuzzy matching capabilities
2. **Built-in Functions**: Native Levenshtein, Soundex, and Metaphone support
3. **Advanced Indexing**: GIN indexes for efficient trigram and full-text search
4. **Scalability**: Better performance with large datasets compared to MySQL
5. **Language Support**: Built-in text search with language awareness
6. **Extensibility**: Rich ecosystem of text processing extensions

## Troubleshooting

1. **PostgreSQL Connection Error**: Update DB_CONFIG with correct credentials
2. **Extension Errors**: Ensure pg_trgm and fuzzystrmatch extensions are available
3. **Slow Performance**: Check that indexes are properly created
4. **TypeScript Errors**: Run `npm install` to ensure all dependencies are installed
5. **Permission Errors**: Ensure PostgreSQL user has necessary privileges

## Development

To add new search strategies:

1. Add a new method to the `PersonSearch` class
2. Include it in the `combined_search` method with appropriate scoring
3. Test with edge cases using the test framework

## License

This is a proof of concept for demonstration purposes.
