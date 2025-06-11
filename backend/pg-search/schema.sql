-- PostgreSQL schema with advanced text search capabilities

-- Create extensions for fuzzy matching (requires superuser or extension privileges)
-- If you get permission errors, run these as a PostgreSQL superuser first:
-- psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
-- psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;"

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Verify extensions are installed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
        RAISE EXCEPTION 'pg_trgm extension is not installed. Please install it first: CREATE EXTENSION pg_trgm;';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'fuzzystrmatch') THEN
        RAISE EXCEPTION 'fuzzystrmatch extension is not installed. Please install it first: CREATE EXTENSION fuzzystrmatch;';
    END IF;
    
    RAISE NOTICE 'All required extensions are installed successfully.';
END
$$;

-- Create database (run this separately if needed)
-- CREATE DATABASE person_search_db;

-- Drop table if exists
DROP TABLE IF EXISTS persons CASCADE;

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

-- Create a function for normalized matching (removes spaces, apostrophes, hyphens)
CREATE OR REPLACE FUNCTION normalize_text(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN REGEXP_REPLACE(LOWER(text_input), '[^a-z0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create index on normalized full name for faster normalized searches
CREATE INDEX idx_full_name_normalized ON persons(normalize_text(full_name));

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
--
-- 5. Normalized search:
-- SELECT * FROM persons
-- WHERE normalize_text(full_name) = normalize_text('Mary Ann'); 