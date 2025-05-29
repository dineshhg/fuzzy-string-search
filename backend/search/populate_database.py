import mysql.connector
import random
from faker import Faker

# Initialize Faker for generating realistic names
fake = Faker()

# Database configuration - adjust these as needed
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',  # Change this to your MySQL username
    'password': '',  # Change this to your MySQL password
    'database': 'person_search_db'
}

# Special name variations for testing search functionality
special_names = [
    ("Mary", "Ann"),
    ("MaryAnn", "Smith"),
    ("John", "D'Souza"),
    ("John", "DSouza"),
    ("Mirage Air", "Craft"),
    ("Mirage", "AirCraft"),
    ("Jean-Pierre", "Dubois"),
    ("JeanPierre", "Dubois"),
    ("O'Brien", "Patrick"),
    ("OBrien", "Patrick"),
    ("Anne-Marie", "Johnson"),
    ("AnneMarie", "Johnson"),
    ("Mac", "Donald"),
    ("MacDonald", "James"),
    ("De La", "Cruz"),
    ("DeLa", "Cruz"),
    ("Van Der", "Berg"),
    ("VanDer", "Berg"),
    ("St.", "James"),
    ("Saint", "James"),
]

def create_connection():
    """Create a database connection"""
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except mysql.connector.Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

def populate_database():
    """Populate the database with 1000 sample entries"""
    connection = create_connection()
    if not connection:
        return
    
    cursor = connection.cursor()
    
    # Clear existing data
    cursor.execute("TRUNCATE TABLE persons")
    
    # Prepare insert statement
    insert_query = """
    INSERT INTO persons (first_name, last_name, full_name, email) 
    VALUES (%s, %s, %s, %s)
    """
    
    data = []
    
    # Add special test cases first
    for first, last in special_names:
        full_name = f"{first} {last}"
        email = f"{first.lower().replace(' ', '').replace("'", '')}.{last.lower().replace(' ', '').replace("'", '')}@example.com"
        data.append((first, last, full_name, email))
    
    # Generate remaining entries to reach 1000
    remaining = 1000 - len(special_names)
    
    for _ in range(remaining):
        # Generate regular names
        if random.random() < 0.9:  # 90% regular names
            first_name = fake.first_name()
            last_name = fake.last_name()
        else:  # 10% names with variations
            # Create some variations
            variation_type = random.choice(['compound', 'apostrophe', 'space'])
            
            if variation_type == 'compound':
                # Create compound names
                first_name = fake.first_name() + fake.first_name()
                last_name = fake.last_name()
            elif variation_type == 'apostrophe':
                # Add apostrophes to names
                first_name = fake.first_name()
                last_name = random.choice(["O'", "D'", "L'"]) + fake.last_name()
            else:
                # Create multi-part names
                first_name = fake.first_name() + " " + fake.first_name()[:3]
                last_name = fake.last_name()
        
        full_name = f"{first_name} {last_name}"
        email = f"{first_name.lower().replace(' ', '').replace("'", '')}.{last_name.lower().replace(' ', '').replace("'", '')}@example.com"
        
        data.append((first_name, last_name, full_name, email))
    
    # Insert data in batches
    try:
        cursor.executemany(insert_query, data)
        connection.commit()
        print(f"Successfully inserted {len(data)} records into the database")
    except mysql.connector.Error as e:
        print(f"Error inserting data: {e}")
        connection.rollback()
    finally:
        cursor.close()
        connection.close()

def verify_data():
    """Verify the data was inserted correctly"""
    connection = create_connection()
    if not connection:
        return
    
    cursor = connection.cursor()
    
    # Count records
    cursor.execute("SELECT COUNT(*) FROM persons")
    count = cursor.fetchone()[0]
    print(f"\nTotal records in database: {count}")
    
    # Show some sample records
    cursor.execute("SELECT * FROM persons LIMIT 10")
    print("\nSample records:")
    print("-" * 80)
    print(f"{'ID':<5} {'First Name':<20} {'Last Name':<20} {'Full Name':<30}")
    print("-" * 80)
    
    for row in cursor.fetchall():
        print(f"{row[0]:<5} {row[1]:<20} {row[2]:<20} {row[3]:<30}")
    
    cursor.close()
    connection.close()

if __name__ == "__main__":
    print("Populating database with sample data...")
    populate_database()
    verify_data() 