#!/bin/bash

echo "==================================="
echo "PostgreSQL Database Search POC Setup Script"
echo "==================================="

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Database credentials
read -p "Enter PostgreSQL username (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -sp "Enter PostgreSQL password: " DB_PASS
echo

read -p "Enter PostgreSQL host (default: localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Enter PostgreSQL port (default: 5432): " DB_PORT
DB_PORT=${DB_PORT:-5432}

# Create database
echo "Creating database..."
PGPASSWORD="$DB_PASS" createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" person_search_db

if [ $? -ne 0 ]; then
    echo "Failed to create database. It may already exist or check your PostgreSQL credentials."
    echo "Continuing with schema setup..."
fi

# Run schema
echo "Creating tables, extensions, and functions..."
PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d person_search_db -f schema.sql

if [ $? -ne 0 ]; then
    echo "Failed to create schema. Please check the schema.sql file and your permissions."
    exit 1
fi

echo ""
echo "Setup complete! Database and tables created successfully."
echo ""
echo "Next steps:"
echo "1. Update DB_CONFIG in populate_database.py and search_queries.py with your credentials"
echo "2. For TypeScript: Update DB_CONFIG in db_config.ts"
echo "3. Run: npm run populate (to populate 10000 mock data)"
echo "4. Run: npm run search"