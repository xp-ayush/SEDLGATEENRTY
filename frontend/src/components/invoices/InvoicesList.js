import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import './InvoicesList.css';
import { FaSearch, FaFileCsv, FaFilter, FaTimes } from 'react-icons/fa';

const InvoicesList = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    partyName: '',
    billNumber: '',
    entryType: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, [currentPage, filters]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: currentPage,
          ...filters
        }
      });

      if (response.data && Array.isArray(response.data.invoices)) {
        setInvoices(response.data.invoices);
        setTotalPages(response.data.totalPages || 1);
      } else {
        throw new Error('Invalid data format received from server');
      }
      setError(null);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError('Failed to load invoices. Please try again later.');
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    return timeString.substring(0, 5); // Format HH:mm
  };

  const formatAmount = (amount) => {
    if (!amount) return '0.00';
    return Number(amount).toFixed(2);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      partyName: '',
      billNumber: '',
      entryType: ''
    });
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const exportToCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/invoices/export`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoices_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting invoices:', error);
      setError('Failed to export invoices');
    }
  };

  if (error) {
    return (
      <div className="invoices-list error">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchInvoices}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="invoices-list">
      <div className="list-header">
        <h1>Invoices</h1>
        <div className="header-actions">
          <button className="btn-filter" onClick={() => setShowFilters(!showFilters)}>
            <FaFilter /> {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button className="btn-export" onClick={exportToCSV}>
            <FaFileCsv /> Export to CSV
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filters-section">
          <div className="filters-grid">
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
            <div className="filter-group">
              <label>Party Name</label>
              <input
                type="text"
                name="partyName"
                value={filters.partyName}
                onChange={handleFilterChange}
                placeholder="Search by party name"
              />
            </div>
            <div className="filter-group">
              <label>Bill Number</label>
              <input
                type="text"
                name="billNumber"
                value={filters.billNumber}
                onChange={handleFilterChange}
                placeholder="Search by bill number"
              />
            </div>
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
          </div>
          <button className="btn-clear" onClick={clearFilters}>
            <FaTimes /> Clear Filters
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading invoices...</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Serial Number</th>
                  <th>Date</th>
                  <th>Party Name</th>
                  <th>Bill Number</th>
                  <th>Materials</th>
                  <th>Bill Amount</th>
                  <th>Entry Type</th>
                  <th>Vehicle Type</th>
                  <th>Source</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length > 0 ? (
                  invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.serialNumber}</td>
                      <td>{formatDate(invoice.date)}</td>
                      <td>{invoice.partyName}</td>
                      <td>{invoice.billNumber}</td>
                      <td className="materials-cell">
                        {invoice.materials && invoice.materials.length > 0 ? (
                          <div className="materials-list">
                            {invoice.materials.map((material, index) => (
                              <div key={index} className="material-item">
                                <span className="material-name">{material.material_name}</span>
                                <span className="material-quantity">{material.quantity}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="single-material">{invoice.materialName || '-'}</span>
                        )}
                      </td>
                      <td className="amount">₹{formatAmount(invoice.billAmount)}</td>
                      <td>
                        <span className={`entry-type ${invoice.entryType.toLowerCase()}`}>
                          {invoice.entryType}
                        </span>
                      </td>
                      <td>{invoice.vehicleType || '-'}</td>
                      <td>{invoice.source || '-'}</td>
                      <td>{formatTime(invoice.timeIn)}</td>
                      <td>{formatTime(invoice.timeOut)}</td>
                      <td className="remarks">{invoice.remarks || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="12" className="no-data">
                      No invoices found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {invoices.length > 0 && (
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
  );
};

export default InvoicesList;
