import { PoolConfig } from "pg";

// Database configuration - adjust these as needed
export const DB_CONFIG: PoolConfig = {
  host: "localhost",
  user: "postgres", // Change this to your PostgreSQL username
  password: "password", // Change this to your PostgreSQL password
  database: "person_search_db",
  port: 5432,
  max: 20, // maximum number of clients in the pool
  idleTimeoutMillis: 30000, // close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // return an error after 2 seconds if connection could not be established
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
  similarity?: number;
}
