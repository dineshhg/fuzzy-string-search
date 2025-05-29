#!/bin/bash

echo "==================================="
echo "Database Search POC Setup Script"
echo "==================================="

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "MySQL is not installed. Please install MySQL first."
    exit 1
fi

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Database credentials
read -p "Enter MySQL username (default: root): " DB_USER
DB_USER=${DB_USER:-root}

read -sp "Enter MySQL password: " DB_PASS
echo

# Create database
echo "Creating database..."
mysql -u "$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS person_search_db;"

if [ $? -ne 0 ]; then
    echo "Failed to create database. Please check your MySQL credentials."
    exit 1
fi

# Run schema
echo "Creating tables and functions..."
mysql -u "$DB_USER" -p"$DB_PASS" person_search_db < schema.sql

if [ $? -ne 0 ]; then
    echo "Failed to create schema. Please check the schema.sql file."
    exit 1
fi

echo ""
echo "Setup complete! Database and tables created successfully."
echo ""
echo "Next steps:"
echo "1. Update DB_CONFIG in populate_database.py and search_queries.py with your credentials"
echo "2. Run: python populate_database.py"
echo "3. Run: python search_queries.py" 