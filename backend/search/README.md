# SQL Database Search POC

This project demonstrates various search strategies for finding similar entries in a SQL database, handling common variations like spaces, apostrophes, and compound words.

## Features

- **Multiple Search Strategies**: Implements 6 different search approaches
- **Fuzzy Matching**: Handles variations in spacing, punctuation, and spelling
- **10,000 Sample Entries**: Automatically populates database with realistic test data
- **Interactive Search**: Includes both automated tests and interactive search interface
- **TypeScript Support**: Full TypeScript implementation with type safety
- **Comprehensive Test Cases**: Includes entity and individual name variations for testing

## Test Cases Included

### Entity Variations
- Company name abbreviations (Corp → Corporation)
- Translation variations (Zhongguo → China)
- Acronym expansions (IRGC → Islamic Revolutionary Guard Corps)
- Country name variations (Myanmar → Burma, North Korea → DPRK)
- And many more...

### Individual Name Variations
- Spelling variations (Mohammed → Mohammad)
- Name order reversals (Xi Jinping → Jinping Xi)
- Nickname usage (Robert → Bob, Margaret → Maggie)
- Diacritic removal (Erdoğan → Erdogan)
- Title/honorific variations (Sheikh Mohammed → MBZ)
- And many more...

## Search Strategies Implemented

### 1. **Exact Search**
- Direct string matching
- Fastest but least flexible

### 2. **Normalized Search**
- Removes spaces, apostrophes, and special characters
- Converts to lowercase for comparison
- Perfect for matching "MaryAnn" with "Mary Ann" or "D'Souza" with "DSouza"

### 3. **Wildcard Search**
- Uses SQL LIKE operator with % wildcards
- Good for partial matches

### 4. **Soundex Search**
- Phonetic matching algorithm
- Matches words that sound similar
- Good for handling spelling variations

### 5. **Levenshtein Distance Search**
- Calculates edit distance between strings
- Finds strings within a specified number of character changes
- Excellent for typos and minor variations

### 6. **Combined Search**
- Uses all strategies with weighted scoring
- Returns best matches based on multiple criteria
- **This is the recommended approach**

## Setup

### Prerequisites
- MySQL 5.7+ or MariaDB
- Node.js 16+ (for TypeScript version)

### Installation

1. Clone the repository:
```bash
cd /Users/dkumar/search-poc
```

### For TypeScript Version:

2. Install Node.js dependencies:
```bash
npm install
```

3. Create the database and schema:
```bash
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

6. Run test cases validation:
```bash
npm run test-cases
# or: npx ts-node test_search_cases.ts
```

## Usage

### Test Cases
The script automatically tests these variations:
- "MaryAnn" vs "Mary Ann" (space variations)
- "D'Souza" vs "DSouza" (apostrophe variations)
- "Mirage Air Craft" vs "Mirage AirCraft" (compound word variations)

### Interactive Search
After running test cases, you can search interactively:
```
Enter search term: Mary Ann
```

## Files Description

### TypeScript Implementation:
- `db_config.ts` - Database configuration and type definitions
- `populate_database.ts` - Populates database with 1000 sample entries
- `search_queries.ts` - Main search implementation with all strategies
- `package.json` - Node.js dependencies
- `tsconfig.json` - TypeScript configuration

### Common Files:
- `schema.sql` - Database schema with indexes and Levenshtein function
- `schema_postgresql.sql` - PostgreSQL version with better fuzzy matching
- `setup.sh` - Automated setup script

## Search Algorithm Details

### Combined Search Scoring
The combined search uses weighted scoring:
- Exact match: 100 points
- Normalized match: 80 points
- Soundex match: 60 points
- Wildcard match: 40 points
- Levenshtein match: 30/(distance+1) points

Results are sorted by total score, returning the best matches.

## Example Output

```
================================================================================
Search Method: COMBINED SEARCH (Best Results)
Search Term: 'MaryAnn'
Results Found: 10
================================================================================

ID     First Name           Last Name            Full Name                     
------ -------------------- -------------------- ------------------------------
2      MaryAnn              Smith                MaryAnn Smith                 
1      Mary                 Ann                  Mary Ann                      
```

## Performance Considerations

- Indexes are created on first_name, last_name, and full_name for fast lookups
- Full-text index enables efficient text searching
- Levenshtein function is optimized but still computationally intensive for large datasets
- Combined search may query multiple times but provides best results
- TypeScript version uses async/await for better performance handling

## Extending the Search

To add new search strategies:
1. Add a new method to the `PersonSearch` class
2. Include it in the `combined_search` method with appropriate scoring
3. Test with edge cases

## Troubleshooting

1. **MySQL Connection Error**: Update DB_CONFIG with correct credentials
2. **Levenshtein Function Error**: Ensure MySQL version supports stored functions
3. **Slow Performance**: Check indexes are properly created
4. **TypeScript Errors**: Run `npm install` to ensure all dependencies are installed

## License

This is a proof of concept for demonstration purposes. 
