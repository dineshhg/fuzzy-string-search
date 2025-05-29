import mysql.connector
import re
from difflib import SequenceMatcher

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',  # Change this to your MySQL username
    'password': '',  # Change this to your MySQL password
    'database': 'person_search_db'
}

class PersonSearch:
    def __init__(self):
        self.connection = None
        self.cursor = None
        
    def connect(self):
        """Establish database connection"""
        try:
            self.connection = mysql.connector.connect(**DB_CONFIG)
            self.cursor = self.connection.cursor(dictionary=True)
            return True
        except mysql.connector.Error as e:
            print(f"Error connecting to MySQL: {e}")
            return False
    
    def close(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
    
    def normalize_string(self, s):
        """Normalize string for comparison"""
        # Remove spaces, apostrophes, and convert to lowercase
        return re.sub(r'[^a-zA-Z0-9]', '', s).lower()
    
    def exact_search(self, search_term):
        """Exact match search"""
        query = """
        SELECT * FROM persons 
        WHERE first_name = %s 
           OR last_name = %s 
           OR full_name = %s
        LIMIT 10
        """
        self.cursor.execute(query, (search_term, search_term, search_term))
        return self.cursor.fetchall()
    
    def wildcard_search(self, search_term):
        """Search using SQL wildcards"""
        wildcard_term = f"%{search_term}%"
        query = """
        SELECT * FROM persons 
        WHERE first_name LIKE %s 
           OR last_name LIKE %s 
           OR full_name LIKE %s
        LIMIT 20
        """
        self.cursor.execute(query, (wildcard_term, wildcard_term, wildcard_term))
        return self.cursor.fetchall()
    
    def normalized_search(self, search_term):
        """Search after normalizing strings (removing spaces, apostrophes)"""
        normalized = self.normalize_string(search_term)
        query = """
        SELECT * FROM persons 
        WHERE REPLACE(REPLACE(REPLACE(LOWER(first_name), ' ', ''), "'", ''), '-', '') = %s
           OR REPLACE(REPLACE(REPLACE(LOWER(last_name), ' ', ''), "'", ''), '-', '') = %s
           OR REPLACE(REPLACE(REPLACE(LOWER(full_name), ' ', ''), "'", ''), '-', '') = %s
        LIMIT 20
        """
        self.cursor.execute(query, (normalized, normalized, normalized))
        return self.cursor.fetchall()
    
    def fulltext_search(self, search_term):
        """MySQL Full-text search"""
        query = """
        SELECT *, MATCH(first_name, last_name, full_name) AGAINST(%s) as relevance
        FROM persons 
        WHERE MATCH(first_name, last_name, full_name) AGAINST(%s)
        ORDER BY relevance DESC
        LIMIT 20
        """
        self.cursor.execute(query, (search_term, search_term))
        return self.cursor.fetchall()
    
    def soundex_search(self, search_term):
        """Search using SOUNDEX for phonetic matching"""
        query = """
        SELECT * FROM persons 
        WHERE SOUNDEX(first_name) = SOUNDEX(%s)
           OR SOUNDEX(last_name) = SOUNDEX(%s)
           OR SOUNDEX(CONCAT(first_name, last_name)) = SOUNDEX(REPLACE(%s, ' ', ''))
        LIMIT 20
        """
        self.cursor.execute(query, (search_term, search_term, search_term))
        return self.cursor.fetchall()
    
    def levenshtein_search(self, search_term, max_distance=3):
        """Search using Levenshtein distance"""
        # First get a subset of candidates using wildcard search
        first_chars = search_term[:3] if len(search_term) >= 3 else search_term
        query = """
        SELECT * FROM persons 
        WHERE first_name LIKE %s 
           OR last_name LIKE %s 
           OR full_name LIKE %s
        """
        self.cursor.execute(query, (f"{first_chars}%", f"{first_chars}%", f"{first_chars}%"))
        candidates = self.cursor.fetchall()
        
        # Calculate Levenshtein distance for each candidate
        results = []
        for candidate in candidates:
            distances = []
            
            # Check against different fields
            for field in ['first_name', 'last_name', 'full_name']:
                if candidate[field]:
                    # Calculate distance using MySQL function
                    dist_query = "SELECT LEVENSHTEIN(%s, %s) as distance"
                    self.cursor.execute(dist_query, (search_term.lower(), candidate[field].lower()))
                    distance = self.cursor.fetchone()['distance']
                    distances.append(distance)
            
            # Use minimum distance
            if distances and min(distances) <= max_distance:
                candidate['levenshtein_distance'] = min(distances)
                results.append(candidate)
        
        # Sort by distance
        results.sort(key=lambda x: x['levenshtein_distance'])
        return results[:20]
    
    def combined_search(self, search_term):
        """Combine multiple search strategies"""
        results = {}
        scores = {}
        
        # 1. Exact search (highest priority)
        exact_results = self.exact_search(search_term)
        for r in exact_results:
            key = r['id']
            results[key] = r
            scores[key] = scores.get(key, 0) + 100
        
        # 2. Normalized search (high priority for handling spaces/apostrophes)
        normalized_results = self.normalized_search(search_term)
        for r in normalized_results:
            key = r['id']
            if key not in results:
                results[key] = r
            scores[key] = scores.get(key, 0) + 80
        
        # 3. Soundex search (medium priority)
        soundex_results = self.soundex_search(search_term)
        for r in soundex_results:
            key = r['id']
            if key not in results:
                results[key] = r
            scores[key] = scores.get(key, 0) + 60
        
        # 4. Wildcard search (low priority)
        wildcard_results = self.wildcard_search(search_term)
        for r in wildcard_results:
            key = r['id']
            if key not in results:
                results[key] = r
            scores[key] = scores.get(key, 0) + 40
        
        # 5. Levenshtein search for remaining fuzzy matches
        levenshtein_results = self.levenshtein_search(search_term, max_distance=3)
        for r in levenshtein_results:
            key = r['id']
            if key not in results:
                results[key] = r
            # Score inversely proportional to distance
            distance = r.get('levenshtein_distance', 3)
            scores[key] = scores.get(key, 0) + (30 / (distance + 1))
        
        # Sort by score
        sorted_results = sorted(results.items(), key=lambda x: scores[x[0]], reverse=True)
        return [r[1] for r in sorted_results[:10]]
    
    def display_results(self, results, search_term, method):
        """Display search results in a formatted way"""
        print(f"\n{'='*80}")
        print(f"Search Method: {method}")
        print(f"Search Term: '{search_term}'")
        print(f"Results Found: {len(results)}")
        print(f"{'='*80}")
        
        if not results:
            print("No results found.")
            return
        
        print(f"\n{'ID':<6} {'First Name':<20} {'Last Name':<20} {'Full Name':<30}")
        print(f"{'-'*6} {'-'*20} {'-'*20} {'-'*30}")
        
        for r in results[:10]:  # Show max 10 results
            print(f"{r['id']:<6} {r['first_name']:<20} {r['last_name']:<20} {r['full_name']:<30}")

def run_test_searches():
    """Run test searches with the examples provided"""
    search = PersonSearch()
    
    if not search.connect():
        print("Failed to connect to database")
        return
    
    test_cases = [
        ("MaryAnn", "Mary Ann"),
        ("Mary Ann", "MaryAnn"),
        ("D'Souza", "DSouza"),
        ("DSouza", "D'Souza"),
        ("Mirage Air Craft", "Mirage AirCraft"),
        ("Mirage AirCraft", "Mirage Air Craft"),
        ("Jean-Pierre", "JeanPierre"),
        ("O'Brien", "OBrien"),
        ("MacDonald", "Mac Donald"),
    ]
    
    print("\n" + "="*80)
    print("RUNNING TEST SEARCHES")
    print("="*80)
    
    for search_term, expected in test_cases:
        print(f"\n\n{'*'*80}")
        print(f"SEARCHING FOR: '{search_term}' (expecting to find variations like '{expected}')")
        print(f"{'*'*80}")
        
        # Run combined search (best approach)
        results = search.combined_search(search_term)
        search.display_results(results, search_term, "COMBINED SEARCH (Best Results)")
        
        # Also show individual search methods for comparison
        print("\n--- Individual Search Methods for Comparison ---")
        
        # Normalized search (good for spaces/apostrophes)
        norm_results = search.normalized_search(search_term)
        if norm_results:
            print(f"\nNormalized Search found {len(norm_results)} results")
            
        # Soundex search
        soundex_results = search.soundex_search(search_term)
        if soundex_results:
            print(f"Soundex Search found {len(soundex_results)} results")
            
        # Levenshtein search
        lev_results = search.levenshtein_search(search_term)
        if lev_results:
            print(f"Levenshtein Search found {len(lev_results)} results")
    
    search.close()

def interactive_search():
    """Run interactive search"""
    search = PersonSearch()
    
    if not search.connect():
        print("Failed to connect to database")
        return
    
    print("\n" + "="*80)
    print("INTERACTIVE PERSON SEARCH")
    print("="*80)
    print("Type 'quit' to exit")
    
    while True:
        search_term = input("\nEnter search term: ").strip()
        
        if search_term.lower() == 'quit':
            break
        
        if not search_term:
            continue
        
        # Use combined search for best results
        results = search.combined_search(search_term)
        search.display_results(results, search_term, "COMBINED SEARCH")
    
    search.close()
    print("\nGoodbye!")

if __name__ == "__main__":
    # Run test searches
    run_test_searches()
    
    # Run interactive search
    print("\n\n")
    interactive_search() 