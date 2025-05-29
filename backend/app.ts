import express from 'express';
import cors from 'cors';
import PersonSearch from './search/search_queries';

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize search instance
const search = new PersonSearch();

// Connect to database when server starts
search.connect().then(connected => {
  if (!connected) {
    console.error('Failed to connect to database');
    process.exit(1);
  }
  console.log('Connected to database');
});

// List all entries endpoint
app.get('/api/list', async (req, res) => {
  try {
    const query = 'SELECT * FROM persons LIMIT 1000';
    const [rows] = await search.connection!.execute(query);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching list:', error);
    res.status(500).json({ error: 'Failed to fetch list' });
  }
});

// Search endpoint
app.get('/api/search', async (req: any, res: any) => {
  try {
    const searchTerm = req.query.q as string;
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const results = await search.combinedSearch(searchTerm);
    res.json(results);
  } catch (error) {
    console.error('Error performing search:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Add new person endpoint
app.post('/api/persons', async (req: any, res: any) => {
  try {
    const { first_name, last_name, full_name } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !full_name) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['first_name', 'last_name', 'full_name']
      });
    }

    const query = `
      INSERT INTO persons (first_name, last_name, full_name)
      VALUES (?, ?, ?)
    `;

    const [result] = await search.connection!.execute(query, [first_name, last_name, full_name]);
    
    // Get the inserted record
    const [rows] = await search.connection!.execute(
      'SELECT * FROM persons WHERE id = ?',
      [(result as any).insertId]
    );

    res.status(201).json({
      message: 'Person added successfully',
      person: (rows as any[])[0]
    });
  } catch (error) {
    console.error('Error adding person:', error);
    res.status(500).json({ error: 'Failed to add person' });
  }
});

// Update person endpoint
app.put('/api/persons/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, full_name } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !full_name) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['first_name', 'last_name', 'full_name']
      });
    }

    // Check if person exists
    const [existing] = await search.connection!.execute(
      'SELECT * FROM persons WHERE id = ?',
      [id]
    );

    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const query = `
      UPDATE persons 
      SET first_name = ?, last_name = ?, full_name = ?
      WHERE id = ?
    `;

    await search.connection!.execute(query, [first_name, last_name, full_name, id]);
    
    // Get the updated record
    const [rows] = await search.connection!.execute(
      'SELECT * FROM persons WHERE id = ?',
      [id]
    );

    res.json({
      message: 'Person updated successfully',
      person: (rows as any[])[0]
    });
  } catch (error) {
    console.error('Error updating person:', error);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await search.close();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});