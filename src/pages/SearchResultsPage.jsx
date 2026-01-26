// pages/SearchResultsPage.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaSearch, FaFilter, FaTimes, FaBuilding, FaUser, FaFileAlt, FaTools, FaMoneyBill, FaHome } from 'react-icons/fa';
import { globalSearch } from '../services/searchService';
import '../styles/searchPage.css';

const SearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const searchQuery = queryParams.get('q') || '';
  
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchInput, setSearchInput] = useState(searchQuery);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  }, [searchQuery]);

  const performSearch = async (term) => {
    if (!term.trim()) return;
    
    setIsLoading(true);
    try {
      const searchResults = await globalSearch(term, 10);
      setResults(searchResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchInput)}`);
    }
  };

  const handleFilter = (type) => {
    setActiveFilter(type);
  };

  const getFilteredResults = () => {
    if (activeFilter === 'all') return results;
    return results.filter(r => r.type === activeFilter);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'tenant': return <FaUser />;
      case 'landlord': return <FaUser />;
      case 'property': return <FaBuilding />;
      case 'unit': return <FaHome />;
      case 'application': return <FaFileAlt />;
      case 'maintenance': return <FaTools />;
      case 'payment': return <FaMoneyBill />;
      default: return <FaSearch />;
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      tenant: 'Tenant',
      landlord: 'Landlord',
      property: 'Property',
      unit: 'Unit',
      application: 'Application',
      maintenance: 'Maintenance',
      payment: 'Payment'
    };
    return labels[type] || type;
  };

  const getTypeColor = (type) => {
    const colors = {
      tenant: '#4CAF50',
      landlord: '#2196F3',
      property: '#FF9800',
      unit: '#9C27B0',
      application: '#00BCD4',
      maintenance: '#F44336',
      payment: '#673AB7'
    };
    return colors[type] || '#757575';
  };

  const filters = [
    { id: 'all', label: 'All Results', count: results.length },
    { id: 'tenant', label: 'Tenants', count: results.filter(r => r.type === 'tenant').length },
    { id: 'landlord', label: 'Landlords', count: results.filter(r => r.type === 'landlord').length },
    { id: 'property', label: 'Properties', count: results.filter(r => r.type === 'property').length },
    { id: 'unit', label: 'Units', count: results.filter(r => r.type === 'unit').length },
    { id: 'application', label: 'Applications', count: results.filter(r => r.type === 'application').length },
    { id: 'maintenance', label: 'Maintenance', count: results.filter(r => r.type === 'maintenance').length },
    { id: 'payment', label: 'Payments', count: results.filter(r => r.type === 'payment').length }
  ];

  const filteredResults = getFilteredResults();

  return (
    <div className="search-results-page">
      <div className="search-header">
        <h1>Search Results</h1>
        <form onSubmit={handleSearchSubmit} className="search-box-large">
          <div className="search-input-wrapper">
            <FaSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="Search properties, tenants, applications, maintenance, payments..." 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoFocus
            />
            {searchInput && (
              <button 
                type="button" 
                className="clear-search-btn"
                onClick={() => setSearchInput('')}
              >
                <FaTimes />
              </button>
            )}
          </div>
          <button type="submit" className="search-submit-btn">
            Search
          </button>
        </form>
      </div>

      <div className="search-filters">
        <div className="filters-header">
          <FaFilter />
          <span>Filter Results</span>
        </div>
        <div className="filter-buttons">
          {filters.map(filter => (
            <button
              key={filter.id}
              className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
              onClick={() => handleFilter(filter.id)}
              disabled={filter.count === 0 && filter.id !== 'all'}
            >
              {filter.label}
              {filter.count > 0 && (
                <span className="filter-count">{filter.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="results-container">
        {isLoading ? (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <p>Searching for "{searchQuery}"...</p>
          </div>
        ) : !searchQuery ? (
          <div className="no-search-query">
            <div className="search-icon-large">🔍</div>
            <h3>Start Searching</h3>
            <p>Enter a search term above to find tenants, properties, applications, and more.</p>
            <div className="search-suggestions">
              <p>Try searching for:</p>
              <ul>
                <li>Tenant names or emails</li>
                <li>Property addresses or names</li>
                <li>Landlord names</li>
                <li>Unit numbers</li>
                <li>Application statuses</li>
              </ul>
            </div>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="no-results-found">
            <div className="no-results-icon">🔍</div>
            <h3>No results found for "{searchQuery}"</h3>
            <p>Try different keywords or check your spelling</p>
            <button 
              className="back-to-search-btn"
              onClick={() => {
                setSearchInput('');
                navigate('/search');
              }}
            >
              Clear Search
            </button>
          </div>
        ) : (
          <>
            <div className="results-summary">
              <p>
                Found <strong>{filteredResults.length}</strong> {filteredResults.length === 1 ? 'result' : 'results'} 
                {activeFilter !== 'all' && ` in ${getTypeLabel(activeFilter)}s`}
                {searchQuery && ` for "${searchQuery}"`}
              </p>
            </div>
            
            <div className="results-grid">
              {filteredResults.map((result, index) => (
                <div 
                  key={`${result.type}-${result.id}-${index}`}
                  className="result-card"
                  onClick={() => navigate(result.route)}
                >
                  <div 
                    className="result-type-badge"
                    style={{ backgroundColor: getTypeColor(result.type) }}
                  >
                    {getTypeIcon(result.type)}
                    <span>{getTypeLabel(result.type)}</span>
                  </div>
                  <div className="result-card-content">
                    <h3 className="result-card-title">{result.title}</h3>
                    <p className="result-card-subtitle">{result.subtitle}</p>
                    
                    {result.data && (
                      <div className="result-card-meta">
                        {result.data.createdAt && (
                          <span className="meta-item">
                            Created: {new Date(result.data.createdAt.seconds * 1000).toLocaleDateString()}
                          </span>
                        )}
                        {result.data.status && (
                          <span className="meta-item">
                            Status: <span className={`status-badge status-${result.data.status.toLowerCase()}`}>
                              {result.data.status}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SearchResultsPage;