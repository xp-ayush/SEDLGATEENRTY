import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './ViewDashboard.css';
import { FaSearch, FaFileCsv, FaFilter, FaTimes, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';

const ViewDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('entries');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
    entryType: ''
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'date',
    direction: 'desc'
  });

  useEffect(() => {
    fetchData();
  }, [activeTab, currentPage, filters, sortConfig]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const endpoint = activeTab === 'entries' ? 'entries' : 'invoices';
      
      const response = await axios.get(`${API_BASE_URL}/api/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: currentPage,
          ...filters,
          sortKey: sortConfig.key,
          sortDir: sortConfig.direction
        }
      });

      if (response.data) {
        setData(response.data[endpoint] || []);
        setTotalPages(response.data.totalPages || 1);
      } else {
        throw new Error('Invalid data format received from server');
      }
      setError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(`Failed to load ${activeTab}. Please try again later.`);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      searchTerm: '',
      entryType: ''
    });
    setCurrentPage(1);
  };

  const exportToExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = activeTab === 'entries' ? 'entries' : 'invoices';
      const response = await axios.get(`${API_BASE_URL}/api/${endpoint}/export`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${endpoint}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Failed to export data');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    return timeString.substring(0, 5);
  };

  const formatAmount = (amount) => {
    if (!amount) return '0.00';
    return Number(amount).toFixed(2);
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort />;
    return sortConfig.direction === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };

  const getEntryStatus = (entry) => {
    const requiredFields = ['driverName', 'driverMobile', 'vehicleNumber', 'source', 'timeIn', 'checkBy'];
    const missingFields = requiredFields.filter(field => !entry[field]);
    
    // Check if timeOut is missing or '00:00'
    if (!entry.timeOut || entry.timeOut === '00:00:00') {
      missingFields.push('timeOut');
    }

    // Check for any empty values in existing fields, excluding loadingUnload
    Object.entries(entry).forEach(([key, value]) => {
      if (value === '' && key !== 'loadingUnload' && key !== 'remarks') {
        missingFields.push(key);
      }
    });

    return {
      status: missingFields.length > 0 ? 'Pending' : 'Complete',
      missingFields: [...new Set(missingFields)] // Remove duplicates
    };
  };

  const getInvoiceStatus = (invoice) => {
    const requiredFields = ['partyName', 'billNumber', 'billAmount', 'source', 'timeIn'];
    const missingFields = requiredFields.filter(field => !invoice[field]);
    
    // Check if timeOut is missing or '00:00'
    if (!invoice.timeOut || invoice.timeOut === '00:00:00') {
      missingFields.push('timeOut');
    }

    // Check for materials
    const hasMaterials = invoice.materials && invoice.materials.length > 0;
    if (!hasMaterials) {
      missingFields.push('materials');
    }

    // Check for any empty values in existing fields, excluding remarks
    Object.entries(invoice).forEach(([key, value]) => {
      if (value === '' && key !== 'remarks') {
        missingFields.push(key);
      }
    });

    return {
      status: missingFields.length > 0 ? 'Pending' : 'Complete',
      missingFields: [...new Set(missingFields)] // Remove duplicates
    };
  };

  const renderStatus = (status, missingFields) => (
    <div className={`status-badge ${status.toLowerCase()}`}>
      {status}
      {status === 'Pending' && (
        <div className="missing-fields">
          Missing: {missingFields.join(', ')}
        </div>
      )}
    </div>
  );

  const renderFilters = () => (
    <div className="filters-section">
      <div className="filters-grid">
        <div className="filter-group">
          <label>Search</label>
          <div className="search-input">
            <input
              type="text"
              name="searchTerm"
              value={filters.searchTerm}
              onChange={handleFilterChange}
              placeholder={`Search ${activeTab}...`}
            />
            <FaSearch className="search-icon" />
          </div>
        </div>
        <div className="filter-group">
          <label>Date From</label>
          <input
            type="date"
            name="dateFrom"
            value={filters.dateFrom}
            onChange={handleFilterChange}
          />
        </div>
        <div className="filter-group">
          <label>Date To</label>
          <input
            type="date"
            name="dateTo"
            value={filters.dateTo}
            onChange={handleFilterChange}
          />
        </div>
        {activeTab === 'invoices' && (
          <div className="filter-group">
            <label>Entry Type</label>
            <select
              name="entryType"
              value={filters.entryType}
              onChange={handleFilterChange}
            >
              <option value="">All</option>
              <option value="Cash">Cash</option>
              <option value="Challan">Challan</option>
              <option value="Bill">Bill</option>
            </select>
          </div>
        )}
      </div>
      <button className="btn-clear" onClick={clearFilters}>
        <FaTimes /> Clear Filters
      </button>
    </div>
  );

  const renderEntries = () => (
    <table className="data-table">
      <thead>
        <tr>
          <th onClick={() => handleSort('serialNumber')}>
            Serial Number {renderSortIcon('serialNumber')}
          </th>
          <th onClick={() => handleSort('date')}>
            Date {renderSortIcon('date')}
          </th>
          <th onClick={() => handleSort('driverName')}>
            Driver Name {renderSortIcon('driverName')}
          </th>
          <th>Driver Mobile</th>
          <th onClick={() => handleSort('vehicleNumber')}>
            Vehicle Number {renderSortIcon('vehicleNumber')}
          </th>
          <th>Vehicle Type</th>
          <th>Source</th>
          <th>Purpose</th>
          <th>Time In</th>
          <th>Time Out</th>
          <th>Check By</th>
          <th>Remarks</th>
          <th>Recorded By</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {data.length > 0 ? (
          data.map((entry) => {
            const { status, missingFields } = getEntryStatus(entry);
            return (
              <tr key={entry.id}>
                <td>{entry.serialNumber || '-'}</td>
                <td>{formatDate(entry.date)}</td>
                <td>{entry.driverName || '-'}</td>
                <td>{entry.driverMobile || '-'}</td>
                <td>{entry.vehicleNumber || '-'}</td>
                <td>{entry.vehicleType || '-'}</td>
                <td>{entry.source || '-'}</td>
                <td>{entry.loadingUnload || '-'}</td>
                <td>{formatTime(entry.timeIn)}</td>
                <td>{formatTime(entry.timeOut)}</td>
                <td>{entry.checkBy || '-'}</td>
                <td>{entry.remarks || '-'}</td>
                <td>{entry.recordedBy || '-'}</td>
                <td>{renderStatus(status, missingFields)}</td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan="14" className="no-data">
              No entries found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderInvoices = () => (
    <table className="data-table">
      <thead>
        <tr>
          <th onClick={() => handleSort('serialNumber')}>
            Serial Number {renderSortIcon('serialNumber')}
          </th>
          <th onClick={() => handleSort('date')}>
            Date {renderSortIcon('date')}
          </th>
          <th onClick={() => handleSort('partyName')}>
            Party Name {renderSortIcon('partyName')}
          </th>
          <th onClick={() => handleSort('billNumber')}>
            Bill Number {renderSortIcon('billNumber')}
          </th>
          <th>Materials</th>
          <th onClick={() => handleSort('billAmount')}>
            Bill Amount {renderSortIcon('billAmount')}
          </th>
          <th onClick={() => handleSort('entryType')}>
            Entry Type {renderSortIcon('entryType')}
          </th>
          <th>Vehicle Type</th>
          <th>Source</th>
          <th>Time In</th>
          <th>Time Out</th>
          <th>Remarks</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {data.length > 0 ? (
          data.map((invoice) => {
            const { status, missingFields } = getInvoiceStatus(invoice);
            return (
              <tr key={invoice.id}>
                <td>{invoice.serialNumber || '-'}</td>
                <td>{formatDate(invoice.date)}</td>
                <td>{invoice.partyName || '-'}</td>
                <td>{invoice.billNumber || '-'}</td>
                <td>
                  {invoice.materials && invoice.materials.length > 0 ? (
                    <div className="materials-list">
                      {invoice.materials.map((material, index) => (
                        <div key={index} className="material-item">
                          <span>{material.material_name}</span>
                          <span>{material.quantity}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span>-</span>
                  )}
                </td>
                <td>₹{formatAmount(invoice.billAmount)}</td>
                <td>
                  <span className={`entry-type ${invoice.entryType?.toLowerCase()}`}>
                    {invoice.entryType || '-'}
                  </span>
                </td>
                <td>{invoice.vehicleType || '-'}</td>
                <td>{invoice.source || '-'}</td>
                <td>{formatTime(invoice.timeIn)}</td>
                <td>{formatTime(invoice.timeOut)}</td>
                <td>{invoice.remarks || '-'}</td>
                <td>{renderStatus(status, missingFields)}</td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan="13" className="no-data">
              No invoices found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (error) {
    return (
      <div className="view-dashboard">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchData}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="view-dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <h1>View Dashboard</h1>
          <div className="dashboard-tabs">
            <button
              className={`tab-button ${activeTab === 'entries' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('entries');
                setCurrentPage(1);
                clearFilters();
              }}
            >
              Outward History
            </button>
            <button
              className={`tab-button ${activeTab === 'invoices' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('invoices');
                setCurrentPage(1);
                clearFilters();
              }}
            >
              Inward History
            </button>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-filter" onClick={() => setShowFilters(!showFilters)}>
            <FaFilter /> {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button className="btn-export" onClick={exportToExcel}>
            <FaFileCsv /> Export to Excel
          </button>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      {showFilters && renderFilters()}

      <div className="data-section">
        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading {activeTab}...</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              {activeTab === 'entries' ? renderEntries() : renderInvoices()}
            </div>

            {data.length > 0 && (
              <div className="pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ViewDashboard;
