import { useState, useEffect } from 'react';
import './App.css';

interface SearchResult {
  id: number;
  full_name: string;
  score?: number;
  foundBy?: string[];
}

interface Person {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
}

interface PersonFormData {
  first_name: string;
  last_name: string;
  full_name: string;
}

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allPersons, setAllPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [formData, setFormData] = useState<PersonFormData>({
    first_name: '',
    last_name: '',
    full_name: ''
  });

  // Fetch all persons when component mounts
  useEffect(() => {
    fetchAllPersons();
  }, []);

  const fetchAllPersons = async () => {
    try
    {
      const response = await fetch('http://localhost:3000/api/list');
      if (!response.ok)
      {
        throw new Error('Failed to fetch persons');
      }
      const data = await response.json();
      setAllPersons(data);
    } catch (err)
    {
      console.error('Error fetching persons:', err);
      setError('Failed to load database entries');
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError('');

    try
    {
      const response = await fetch(`http://localhost:3000/api/search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok)
      {
        throw new Error('Search failed');
      }
      const data = await response.json();
      setResults(data);
    } catch (err)
    {
      setError('Failed to perform search');
      console.error('Search error:', err);
    } finally
    {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    formData.full_name = formData.first_name + ' ' + formData.last_name;
    try
    {
      const response = await fetch('http://localhost:3000/api/persons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok)
      {
        throw new Error('Failed to add person');
      }

      await fetchAllPersons();
      setShowAddForm(false);
      setFormData({ first_name: '', last_name: '', full_name: '' });
    } catch (err)
    {
      setError('Failed to add person');
      console.error('Error adding person:', err);
    }
  };

  const handleUpdatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;
    formData.full_name = formData.first_name + ' ' + formData.last_name;
    try
    {
      const response = await fetch(`http://localhost:3000/api/persons/${editingPerson.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok)
      {
        throw new Error('Failed to update person');
      }

      await fetchAllPersons();
      setEditingPerson(null);
      setFormData({ first_name: '', last_name: '', full_name: '' });
    } catch (err)
    {
      setError('Failed to update person');
      console.error('Error updating person:', err);
    }
  };

  const handleEditClick = (person: Person) => {
    setEditingPerson(person);
    setFormData({
      first_name: person.first_name,
      last_name: person.last_name,
      full_name: person.first_name + ' ' + person.last_name
    });
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingPerson(null);
    setFormData({ first_name: '', last_name: '', full_name: '' });
  };

  return (
    <div className="app-container">
      <div className="container">
        <header className="header">
          <h1 className="section-header">Search PoC</h1>
          <div className="search-container">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter search term..."
              className="search-input"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="search-button"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </header>

        <main>
          {/* Search Results Section */}
          {results.length > 0 ? (
            <section className="results-section">
              <h2 className="section-header">Search Results</h2>
              <div className="results-table">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Score</th>
                      <th>Found By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result) => (
                      <tr key={result.id}>
                        <td>{result.id}</td>
                        <td>{result.full_name}</td>
                        <td>{result.score?.toFixed(2)}</td>
                        <td>{result.foundBy?.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : <section className="results-section">
            <h2 className="section-header">Search Results</h2>
            <div className="no-results">No results found</div>
          </section>
          }

          {/* All Database Entries Section */}
          <section className="results-section">
            <div className="section-header">
              <h2>All Database Entries</h2>
              <button
                className="add-button"
                onClick={() => setShowAddForm(true)}
              >
                Add New Person
              </button>
            </div>

            {/* Add/Edit Form */}
            {(showAddForm || editingPerson) && (
              <div className="form-overlay">
                <div className="form-container">
                  <h3>{editingPerson ? 'Edit Person' : 'Add New Person'}</h3>
                  <form onSubmit={editingPerson ? handleUpdatePerson : handleAddPerson}>
                    <div className="form-group">
                      <label htmlFor="first_name">First Name:</label>
                      <input
                        type="text"
                        id="first_name"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="last_name">Last Name:</label>
                      <input
                        type="text"
                        id="last_name"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="form-buttons">
                      <button type="submit" className="submit-button">
                        {editingPerson ? 'Update' : 'Add'}
                      </button>
                      <button type="button" className="cancel-button" onClick={handleCancel}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="results-table">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Full Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allPersons.map((person) => (
                    <tr key={person.id}>
                      <td>{person.id}</td>
                      <td>{person.first_name}</td>
                      <td>{person.last_name}</td>
                      <td>{person.full_name}</td>
                      <td>
                        <button
                          className="edit-button"
                          onClick={() => handleEditClick(person)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}

export default App; 