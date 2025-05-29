import { ConnectionOptions } from 'mysql2';

// Database configuration - adjust these as needed
export const DB_CONFIG: ConnectionOptions = {
  host: 'localhost',
  user: 'root',  // Change this to your MySQL username
  password: '',  // Change this to your MySQL password
  database: 'person_search_db'
};

// Define the Person interface
export interface Person {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  created_at?: Date;
  // Additional fields for search results
  relevance?: number;
  levenshtein_distance?: number;
} 