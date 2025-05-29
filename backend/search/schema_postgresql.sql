-- PostgreSQL schema with advanced text search capabilities

-- Create extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Drop table if exists
DROP TABLE IF EXISTS persons;

-- Create persons table
CREATE TABLE persons (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(200),
    email VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient searching
CREATE INDEX idx_first_name ON persons(first_name);
CREATE INDEX idx_last_name ON persons(last_name);
CREATE INDEX idx_full_name ON persons(full_name);

-- Create trigram indexes for fuzzy matching
CREATE INDEX idx_first_name_trgm ON persons USING gin(first_name gin_trgm_ops);
CREATE INDEX idx_last_name_trgm ON persons USING gin(last_name gin_trgm_ops);
CREATE INDEX idx_full_name_trgm ON persons USING gin(full_name gin_trgm_ops);

-- Create full text search indexes
CREATE INDEX idx_fulltext_search ON persons USING gin(to_tsvector('english', 
    coalesce(first_name, '') || ' ' || coalesce(last_name, '') || ' ' || coalesce(full_name, '')));

-- Example queries for PostgreSQL:
-- 
-- 1. Trigram similarity search (handles spaces, punctuation well):
-- SELECT *, similarity(full_name, 'Mary Ann') as sim 
-- FROM persons 
-- WHERE full_name % 'Mary Ann'
-- ORDER BY sim DESC;
--
-- 2. Levenshtein distance:
-- SELECT *, levenshtein(lower(full_name), lower('MaryAnn')) as distance
-- FROM persons
-- WHERE levenshtein(lower(full_name), lower('MaryAnn')) <= 3
-- ORDER BY distance;
--
-- 3. Soundex matching:
-- SELECT * FROM persons
-- WHERE soundex(first_name) = soundex('DSouza')
--    OR soundex(last_name) = soundex('DSouza');
--
-- 4. Full text search:
-- SELECT * FROM persons
-- WHERE to_tsvector('english', full_name) @@ to_tsquery('english', 'Mary & Ann'); 