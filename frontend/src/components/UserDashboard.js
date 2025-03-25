import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import './Dashboard.css';
import { 
  FaUser, 
  FaTruck, 
  FaSignOutAlt, 
  FaCheck, 
  FaClock, 
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaClipboardList,
  FaExclamationTriangle,
  FaHistory,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
  FaSync,
  FaKey,
  FaDatabase,
  FaFileInvoice,
  FaSearch,
  FaFileExport
} from 'react-icons/fa';
import Notification from './Notification';
import EntryForm from './forms/EntryForm';
import InvoiceForm from './invoices/InvoiceForm';
import * as XLSX from 'xlsx';

function UserDashboard() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [entriesData, setEntriesData] = useState({
    entries: [],
    totalCount: 0
  });
  const [refreshing, setRefreshing] = useState(false);
  const [timeoutValues, setTimeoutValues] = useState({});
  const [loadingValues, setLoadingValues] = useState({});
  const [checkByValues, setCheckByValues] = useState({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('form');
  const [userUnits, setUserUnits] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Notification state and function
  const [notifications, setNotifications] = useState([]);
  const addNotification = useCallback((message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const getToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  // Authentication check
  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    
    if (!token || role !== 'user') {
      localStorage.clear();
      navigate('/login');
      return;
    }

    // Set up axios interceptor for token expiration
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.clear();
          navigate('/login');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [navigate]);

  const fetchUserProfile = useCallback(async () => {
    try {
      const token = getToken();
      const response = await axios.get(`${API_BASE_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserData(response.data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      addNotification(error.response?.data?.message || 'Failed to fetch profile', 'error');
    }
  }, [getToken, addNotification]);

  const fetchEntries = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/entries`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setEntriesData({
        entries: response.data.entries,
        totalCount: response.data.totalCount
      });
    } catch (error) {
      console.error('Error fetching entries:', error);
      addNotification(error.response?.data?.message || 'Failed to fetch entries', 'error');
    }
  }, [addNotification]);

  const fetchUserUnits = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/user/units`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserUnits(response.data);
    } catch (error) {
      console.error('Error fetching user units:', error);
    }
  }, [getToken]);

  const fetchInvoices = useCallback(async () => {
    const token = getToken();
    if (!token) {
      addNotification('Session expired. Please login again', 'error');
      navigate('/login');
      return;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/user-invoices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoices(response.data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      addNotification(error.response?.data?.message || 'Failed to fetch invoices', 'error');
    }
  }, [getToken, navigate]);

  const handleEntrySubmitSuccess = useCallback(() => {
    // Refresh the entries list
    fetchEntries();
  }, []);

  const handleTimeOutChange = (entryId, value) => {
    setTimeoutValues(prev => ({
      ...prev,
      [entryId]: value
    }));
  };

  const handleLoadingChange = (entryId, value) => {
    setLoadingValues(prev => ({
      ...prev,
      [entryId]: value
    }));
  };

  const handleCheckByChange = (entryId, value) => {
    setCheckByValues(prev => ({
      ...prev,
      [entryId]: value
    }));
  };

  const updateEntry = async (entryId, updateData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        addNotification('Please log in again', 'error');
        return;
      }

      // Log the request data for debugging
      console.log('Updating entry:', entryId, 'with data:', updateData);

      const response = await axios.put(`${API_BASE_URL}/api/entries/${entryId}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Log the response for debugging
      console.log('Update response:', response.data);

      // Update the entry in the local state
      setEntriesData(prev => ({
        ...prev,
        entries: prev.entries.map(entry =>
          entry.id === entryId
            ? { ...entry, ...updateData, status: response.data.entry.status }
            : entry
        )
      }));

      addNotification('Entry updated successfully', 'success');
      return true;
    } catch (error) {
      console.error('Error updating entry:', error);
      addNotification(error.response?.data?.message || 'Failed to update entry', 'error');
      return false;
    }
  };

  const handleTimeOutUpdate = async (entryId) => {
    const timeOut = timeoutValues[entryId];
    if (!timeOut) {
      addNotification('Please enter a valid time', 'error');
      return;
    }
    const success = await updateEntry(entryId, { timeOut });
    if (success) {
      setTimeoutValues(prev => {
        const newValues = { ...prev };
        delete newValues[entryId];
        return newValues;
      });
    }
  };

  const handleLoadingUpdate = async (entryId) => {
    const loadingUnload = loadingValues[entryId];
    if (!loadingUnload) {
      addNotification('Please select loading/unload type', 'error');
      return;
    }
    const success = await updateEntry(entryId, { loadingUnload });
    if (success) {
      setLoadingValues(prev => {
        const newValues = { ...prev };
        delete newValues[entryId];
        return newValues;
      });
    }
  };

  const handleCheckByUpdate = async (entryId) => {
    const checkBy = checkByValues[entryId];
    if (!checkBy) {
      addNotification('Please enter who checked this entry', 'error');
      return;
    }
    const success = await updateEntry(entryId, { checkBy });
    if (success) {
      setCheckByValues(prev => {
        const newValues = { ...prev };
        delete newValues[entryId];
        return newValues;
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setSearchQuery('');
    await fetchEntries();
    setRefreshing(false);
  };

  const handleSearch = () => {
    const query = searchQuery.toLowerCase().trim();
    
    try {
      if (activeSection === 'history') {
        if (!query) {
          // If search is empty, restore all entries
          setEntriesData({
            entries: entriesData.entries,
            page: 1
          });
        } else {
          // Filter entries
          const filteredEntries = entriesData.entries.filter(entry => {
            return (
              (entry.serialNumber?.toString().toLowerCase().includes(query)) ||
              (entry.date?.toLowerCase().includes(query)) ||
              (entry.driverName?.toLowerCase().includes(query)) ||
              (entry.driverMobile?.toLowerCase().includes(query)) ||
              (entry.vehicleNumber?.toLowerCase().includes(query)) ||
              (entry.vehicleType?.toLowerCase().includes(query)) ||
              (entry.source?.toLowerCase().includes(query)) ||
              (entry.loadingUnload?.toLowerCase().includes(query)) ||
              (entry.timeIn?.toLowerCase().includes(query)) ||
              (entry.timeOut?.toLowerCase().includes(query)) ||
              (entry.checkBy?.toLowerCase().includes(query)) ||
              (entry.remarks?.toLowerCase().includes(query))
            );
          });

          setEntriesData({
            entries: filteredEntries,
            page: 1
          });
          addNotification(`Found ${filteredEntries.length} matching entries`, 'success');
        }
      } else {
        if (!query) {
          // If search is empty, restore all invoices
          setInvoices(invoices);
        } else {
          // Filter invoices
          const filteredInvoices = invoices.filter(invoice => {
            return (
              (invoice.serialNumber?.toString().toLowerCase().includes(query)) ||
              (invoice.date?.toLowerCase().includes(query)) ||
              (invoice.partyName?.toLowerCase().includes(query)) ||
              (invoice.billNumber?.toLowerCase().includes(query)) ||
              (invoice.materialName?.toLowerCase().includes(query)) ||
              (invoice.billAmount?.toString().toLowerCase().includes(query)) ||
              (invoice.entryType?.toLowerCase().includes(query)) ||
              (invoice.vehicleType?.toLowerCase().includes(query)) ||
              (invoice.source?.toLowerCase().includes(query)) ||
              (invoice.timeIn?.toLowerCase().includes(query)) ||
              (invoice.timeOut?.toLowerCase().includes(query))
            );
          });

          setInvoices(filteredInvoices);
          addNotification(`Found ${filteredInvoices.length} matching invoices`, 'success');
        }
      }
    } catch (error) {
      console.error('Error during search:', error);
      addNotification('Error occurred while searching', 'error');
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSearchInputChange = (e) => {
    setSearchQuery(e.target.value);
    if (e.target.value === '') {
      // Reset to original data when search is cleared
      if (activeSection === 'history') {
        setEntriesData({
          entries: entriesData.entries,
          page: 1
        });
      } else {
        setInvoices(invoices);
      }
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const toggleProfileDropdown = (e) => {
    e.stopPropagation();
    setShowProfileDropdown(!showProfileDropdown);
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      addNotification('All password fields are required', 'error');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addNotification('New passwords do not match', 'error');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      addNotification('New password must be at least 6 characters long', 'error');
      return;
    }

    const token = getToken();
    if (!token) {
      addNotification('Session expired. Please login again', 'error');
      navigate('/login');
      return;
    }

    try {
      await axios.put(`${API_BASE_URL}/api/change-password`, passwordForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      addNotification('Password changed successfully', 'success');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setTimeout(() => {
        setShowChangePasswordModal(false);
      }, 2000);
    } catch (error) {
      addNotification(error.response?.data?.message || 'Failed to change password', 'error');
    }
  };

  const handleLogout = () => {
    addNotification('Successfully logged out', 'success');
    setTimeout(() => {
      localStorage.clear();
      navigate('/login', { replace: true });
    }, 1000);
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setShowProfileDropdown(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Check for login success notification
    const showLoginSuccess = localStorage.getItem('showLoginSuccess');
    if (showLoginSuccess === 'true') {
      addNotification('User logged in successfully', 'success');
      localStorage.removeItem('showLoginSuccess');
    }

    fetchUserProfile();
    fetchUserUnits();
    fetchEntries();
    fetchInvoices();
  }, [fetchUserProfile, fetchUserUnits, fetchEntries, fetchInvoices]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries, activeSection]);

  const handlePageChange = (newPage) => {
    setEntriesData(prev => ({ ...prev, page: newPage }));
  };

  const renderProfile = () => {
    return (
      <div className="profile-container">
        <div className="profile-header">
          <FaUser className="profile-icon" />
          <h2>Profile Information</h2>
        </div>
        <div className="profile-details">
          <p><strong>Name:</strong> {userData.name}</p>
          <p><strong>Email:</strong> {userData.email}</p>
          <p><strong>Joined:</strong> {new Date(userData.created_at).toLocaleDateString()}</p>
          <div className="units-section">
            <h3>Assigned Units</h3>
            <div className="units-list">
              {userUnits.map(unit => (
                <div key={unit.id} className="unit-item">
                  <span className="unit-number">Unit {unit.unit_number}</span>
                  <span className="unit-name">{unit.unit_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleExportToExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}_${new Date().toLocaleDateString()}.xlsx`);
  };

  const handleExportClick = () => {
    setShowExportModal(true);
  };

  const handleExportConfirm = () => {
    if (activeSection === 'history') {
      exportEntries(selectedDate);
    } else {
      exportInvoices(selectedDate);
    }
    setShowExportModal(false);
  };

  const exportEntries = (dateType) => {
    const recentEntries = entriesData.entries.filter(entry => 
      dateType === 'today' ? isToday(entry.date) : isYesterday(entry.date)
    );

    if (recentEntries.length === 0) {
      addNotification(`No entries found for ${dateType}`, "info");
      return;
    }

    const formattedEntries = recentEntries.map(entry => ({
      'Serial Number': entry.serialNumber,
      'Date': new Date(entry.date).toLocaleDateString(),
      'Driver Name': entry.driverName,
      'Driver Mob.': entry.driverMobile,
      'Vehicle No.': entry.vehicleNumber,
      'Vehicle Type': entry.vehicleType,
      'Source': entry.source,
      'Purpose': entry.loadingUnload,
      'Time In': entry.timeIn,
      'Time Out': entry.timeOut,
      'Checked By': entry.checkBy,
      'Remarks': entry.remarks
    }));
    
    handleExportToExcel(formattedEntries, `Gate_Entries_${dateType}`);
    addNotification(`Exported ${recentEntries.length} entries from ${dateType}`, "success");
  };

  const exportInvoices = (dateType) => {
    const recentInvoices = invoices.filter(invoice => 
      dateType === 'today' ? isToday(invoice.date) : isYesterday(invoice.date)
    );
  
    if (recentInvoices.length === 0) {
      addNotification(`No invoices found for ${dateType}`, "info");
      return;
    }
  
    // Sort invoices by serial number in ascending order
    recentInvoices.sort((a, b) => a.serialNumber - b.serialNumber);
  
    const formattedInvoices = recentInvoices.map(invoice => {
      const materialsNames = invoice.materials && invoice.materials.length > 0 
        ? invoice.materials.map(material => material.name).join('\n') 
        : invoice.materialName;
      const materialsQuantities = invoice.materials && invoice.materials.length > 0 
        ? invoice.materials.map(material => material.quantity).join('\n') 
        : '';
  
      return {
        'Serial No.': invoice.serialNumber,
        'Date': new Date(invoice.date).toLocaleDateString(),
        'Party Name': invoice.partyName,
        'Bill No.': invoice.billNumber,
        'Description': materialsNames,
        'Quantity': materialsQuantities,
        'Bill Amount': invoice.billAmount,
        'Entry Type': invoice.entryType,
        'Vehicle Type': invoice.vehicleType,
        'Source': invoice.source,
        'Time In': invoice.timeIn,
        'Time Out': invoice.timeOut,
        'Status': !isEmptyTime(invoice.timeOut) ? 'Completed' : 'Pending'
      };
    });
  
    handleExportToExcel(formattedInvoices, `Invoices_${dateType}`);
    addNotification(`Exported ${recentInvoices.length} invoices from ${dateType}`, "success");
  };

  const isToday = (date) => {
    const today = new Date();
    const checkDate = new Date(date);
    return checkDate.toDateString() === today.toDateString();
  };

  const isYesterday = (date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const checkDate = new Date(date);
    return checkDate.toDateString() === yesterday.toDateString();
  };

  const isEmptyTime = (time) => {
    return !time || time === '00:00' || time === '00:00:00' || time === '0000';
  };

  const handleInvoiceSubmit = async (formData) => {
    try {
      const token = getToken();
      await axios.post(`${API_BASE_URL}/api/invoices`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addNotification('Invoice added successfully', 'success');
      fetchInvoices();
    } catch (error) {
      console.error('Error submitting invoice:', error);
      addNotification(error.response?.data?.message || 'Failed to submit invoice', 'error');
    }
  };

  const handleInvoiceEdit = async (id, formData) => {
    try {
      const token = getToken();
      const response = await axios.put(`${API_BASE_URL}/api/invoices/${id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addNotification('Invoice updated successfully', 'success');
      handleRefresh();
    } catch (error) {
      if (error.response?.status === 404) {
        addNotification('Invoice not found', 'error');
      } else {
        addNotification(error.response?.data?.message || 'Error updating invoice', 'error');
      }
    }
  };

  const handleInvoiceTimeoutUpdate = async (id, timeOut) => {
    try {
      const token = getToken();
      const response = await axios.put(`${API_BASE_URL}/api/invoices/${id}/timeout`, { timeOut }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addNotification('Invoice timeout updated successfully', 'success');
      handleRefresh();
    } catch (error) {
      if (error.response?.status === 404) {
        addNotification('Invoice not found', 'error');
      } else {
        addNotification(error.response?.data?.message || 'Error updating invoice timeout', 'error');
      }
    }
  };

  if (!userData) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="modern-dashboard">
      <div className="notifications-container">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`notification ${notification.type}`}
          >
            <span>{notification.message}</span>
            <button
              className="close-button"
              onClick={() => removeNotification(notification.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <aside className={`dashboard-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <FaTruck className="company-logo" />
          <h2>Gate Entry</h2>
          <button className="toggle-btn" onClick={toggleSidebar}>
            {isSidebarOpen ? <FaChevronLeft /> : <FaChevronRight />}
          </button>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar" onClick={toggleProfileDropdown}>
            <FaUser />
          </div>
          <div className="user-info">
            <h3 className="user-name">{userData.name}</h3>
            <p className="user-role">Gate Operator</p>
          </div>
          {/* Profile Dropdown */}
          <div className={`profile-dropdown ${showProfileDropdown ? 'show' : ''}`}>
            <button className="profile-dropdown-item" onClick={() => setShowProfileModal(true)}>
              <FaUser />
              <span>My Profile</span>
            </button>
            <button className="profile-dropdown-item" onClick={() => setShowChangePasswordModal(true)}>
              <FaKey />
              <span>Change Password</span>
            </button>
            <div className="profile-dropdown-divider" />
            <button className="profile-dropdown-item" onClick={handleLogout}>
              <FaSignOutAlt />
              <span>Logout</span>
            </button>
          </div>
        </div>

        <div className="sidebar-menu">
          <button 
            className={`menu-item ${activeSection === 'form' ? 'active' : ''}`}
            onClick={() => setActiveSection('form')}
          >
            <FaClipboardList className="menu-icon" />
            {isSidebarOpen && <span>Outward Entry</span>}
          </button>

          <button 
            className={`menu-item ${activeSection === 'invoice' ? 'active' : ''}`}
            onClick={() => setActiveSection('invoice')}
          >
            <FaFileInvoice className="menu-icon" />
            {isSidebarOpen && <span>Inward Entry</span>}
          </button>

          <button 
            className={`menu-item ${activeSection === 'history' ? 'active' : ''}`}
            onClick={() => setActiveSection('history')}
          >
            <FaHistory className="menu-icon" />
            {isSidebarOpen && <span>Outward History</span>}
          </button>

          <button 
            className={`menu-item ${activeSection === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveSection('invoices')}
          >
            <FaHistory className="menu-icon" />
            {isSidebarOpen && <span>Inward History</span>}
          </button>
        </div>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="menu-item logout">
            <FaSignOutAlt className="menu-icon" />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="dashboard-content">
        <div className="content-header">
          <div className="header-title">
            <h1>
              {activeSection === 'form' 
                ? 'Outward Entry' 
                : activeSection === 'invoice' 
                  ? 'New Invoice' 
                  : activeSection === 'history' 
                    ? 'My Recent Entries' 
                    : 'My Recent Invoices'}
            </h1>
            <p className="header-subtitle">
              {activeSection === 'form' 
                ? 'Fill in the details below to create a new entry'
                : activeSection === 'invoice' 
                  ? 'Fill in the details below to create a new invoice'
                  : activeSection === 'history' 
                    ? 'View and manage your recent entries'
                    : 'View and manage your recent invoices'}
            </p>
          </div>
          {activeSection !== 'form' && activeSection !== 'invoice' && (
            <div className="header-actions">
              <div className="action-group">
              </div>
            </div>
          )}
        </div>

        <div className="content">
          {activeSection === 'form' && (
            <div className="form-section">
              <h2>New Entry</h2>
              <EntryForm 
                onSubmitSuccess={handleEntrySubmitSuccess} 
                addNotification={addNotification} 
              />
            </div>
          )}

          {activeSection === 'invoice' && (
            <div className="form-section">
              <h2>New Invoice</h2>
              <InvoiceForm 
                onSubmit={handleInvoiceSubmit} 
                onNotification={addNotification}
                onEdit={handleInvoiceEdit}
              />
            </div>
          )}

          {activeSection === 'history' && (
            <div className="history-section">
              <div className="section-header">
                <h2>Entry History</h2>
                <div className="header-controls">
                  <div className="search-box">
                    <FaSearch className="search-icon" />
                    <input
                      type="text"
                      placeholder="Search entries..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={handleSearchKeyPress}
                    />
                  </div>
                  <div className="action-buttons">
                    <button
                      className="refresh-button"
                      onClick={handleRefresh}
                      disabled={refreshing}
                    >
                      <FaSync className={`refresh-icon ${refreshing ? 'spinning' : ''}`} />
                      {refreshing ? 'Refreshing...' : ''}
                    </button>
                    <button
                      className="export-button"
                      onClick={() => setShowExportModal(true)}
                    >
                      <FaFileExport />
                      Export
                    </button>
                  </div>
                </div>
              </div>
              <div className="table-container">
                <table className="entries-table">
                  <thead>
                    <tr>
                      <th>Serial Number</th>
                      <th>Date</th>
                      <th>Driver Mobile</th>
                      <th>Driver Name</th>
                      <th>Vehicle Number</th>
                      <th>Vehicle Type</th>
                      <th>Source</th>
                      <th>Time In</th>
                      <th>Time Out</th>
                      <th>Purpose</th>
                      <th>Check By</th>
                      <th>Remarks</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entriesData.entries.map(entry => (
                      <tr key={entry.id}>
                        <td>{entry.serialNumber}</td>
                        <td>{entry.date}</td>
                        <td>{entry.driverMobile}</td>
                        <td>{entry.driverName}</td>
                        <td>{entry.vehicleNumber}</td>
                        <td>{entry.vehicleType}</td>
                        <td>{entry.source}</td>
                        <td>{entry.timeIn}</td>
                        <td>
                          {entry.timeOut ? (
                            entry.timeOut
                          ) : (
                            <div className="time-out-input">
                              <input
                                type="time"
                                value={timeoutValues[entry.id] || ''}
                                onChange={(e) => handleTimeOutChange(entry.id, e.target.value)}
                                className="form-control"
                                placeholder="Enter time"
                              />
                              <button
                                onClick={() => handleTimeOutUpdate(entry.id)}
                                className="update-button"
                              >
                                Update
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          {entry.loadingUnload ? (
                            entry.loadingUnload
                          ) : (
                            <div className="loading-input">
                              <select
                                value={loadingValues[entry.id] || ''}
                                onChange={(e) => handleLoadingChange(entry.id, e.target.value)}
                                className="form-control"
                              >
                                <option value="">Select Type</option>
                                <option value="Sale">Sale</option>
                                <option value="RGP">RGP</option>
                                <option value="Inter Unit Transfer">Inter Unit Transfer</option>
                              </select>
                              <button
                                onClick={() => handleLoadingUpdate(entry.id)}
                                className="update-button"
                              >
                                Update
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          {entry.checkBy ? (
                            entry.checkBy
                          ) : (
                            <div className="check-by-input">
                              <input
                                type="text"
                                value={checkByValues[entry.id] || ''}
                                onChange={(e) => handleCheckByChange(entry.id, e.target.value)}
                                className="form-control"
                                placeholder="Enter name"
                              />
                              <button
                                onClick={() => handleCheckByUpdate(entry.id)}
                                className="update-button"
                              >
                                Update
                              </button>
                            </div>
                          )}
                        </td>
                        <td>{entry.remarks}</td>
                        <td>
                          <span className={`status-badge ${entry.status.toLowerCase()}`}>
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'invoices' && (
            <div className="history-section">
              <div className="section-header">
                <h2>Invoice History</h2>
                <div className="header-actions">
                  <button 
                    className="refresh-button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    <FaSync className={`refresh-icon ${refreshing ? 'spinning' : ''}`} />
                    {refreshing ? 'Refreshing...' : ''}
                  </button>
                  <button 
                    className="export-button"
                    onClick={() => setShowExportModal(true)}
                  >
                    Export
                  </button>
                </div>
              </div>
              <div className="table-section">
                <div className="table-container">
                  <table className="invoices-table">
                    <thead>
                      <tr>
                        <th>Serial Number</th>
                        <th>Date</th>
                        <th>Party Name</th>
                        <th>Bill Number</th>
                        <th>Descriptions</th>
                        <th>Bill Amount</th>
                        <th>Entry Type</th>
                        <th>Vehicle Type</th>
                        <th>Source</th>
                        <th>Time In</th>
                        <th>Time Out</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>{invoice.serialNumber}</td>
                          <td>{new Date(invoice.date).toLocaleDateString()}</td>
                          <td>{invoice.partyName}</td>
                          <td>{invoice.billNumber}</td> 
                          <td>
                            {invoice.materials && invoice.materials.length > 0 ? (
                              <ul className="materials-list">
                                {invoice.materials.map((material, index) => (
                                  <li key={index}>
                                    {material.name} - {material.quantity}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              invoice.materialName || '-'
                            )}
                          </td>
                          <td>{invoice.billAmount}</td>
                          <td>{invoice.entryType}</td>
                          <td>{invoice.vehicleType}</td>
                          <td>{invoice.source}</td>
                          <td>{invoice.timeIn}</td>
                          <td>{isEmptyTime(invoice.timeOut) ? '-' : invoice.timeOut}</td>
                          <td>
                            {!isEmptyTime(invoice.timeOut) ? (
                              <span className="status-completed">Completed</span>
                            ) : (
                              <span className="status-pending">Pending</span>
                            )}
                          </td>
                          <td>
                            {isEmptyTime(invoice.timeOut) && (
                              editingInvoice?.id === invoice.id ? (
                                <div className="time-out-input-group">
                                  <input
                                    type="time"
                                    defaultValue={invoice.timeIn}
                                    min={invoice.timeIn}
                                    onChange={(e) => handleTimeOutChange(invoice.id, e.target.value)}
                                    className="time-input"
                                  />
                                  <div className="time-out-actions">
                                    <button
                                      className="action-button save-button"
                                      onClick={() => handleInvoiceTimeoutUpdate(invoice.id, timeoutValues[invoice.id])}
                                      disabled={!timeoutValues[invoice.id]}
                                    >
                                      <FaCheck /> Save
                                    </button>
                                    <button
                                      className="action-button cancel-button"
                                      onClick={() => {
                                        setEditingInvoice(null);
                                        setTimeoutValues(prev => {
                                          const newValues = { ...prev };
                                          delete newValues[invoice.id];
                                          return newValues;
                                        });
                                      }}
                                    >
                                      <FaTimes />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className="action-button update-button"
                                  onClick={() => setEditingInvoice(invoice)}
                                >
                                  <FaClock /> Update
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer">
                  {invoices.length === 0 && (
                    <div className="no-entries">
                      <FaDatabase className="no-data-icon" />
                      <p>No invoices found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Profile Modal */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>My Profile</h2>
              <button className="close-button" onClick={() => setShowProfileModal(false)}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              {renderProfile()}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowProfileModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Change Password</h2>
              <button 
                className="close-button"
                onClick={() => setShowChangePasswordModal(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className="modal-form">
              {passwordError && <div className="alert alert-error">{passwordError}</div>}
              {passwordSuccess && <div className="alert alert-success">{passwordSuccess}</div>}
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  placeholder="Enter current password"
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  placeholder="Enter new password"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  placeholder="Confirm new password"
                />
              </div>
              <div className="modal-actions">
                <button 
                  className="save-button"
                  onClick={handleChangePassword}
                >
                  Change Password
                </button>
                <button
                  className="cancel-button"
                  onClick={() => setShowChangePasswordModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Export Modal */}
      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Export {activeSection === 'history' ? 'Gate Entries' : 'Invoices'}</h3>
            <p>Select which entries to export:</p>
            <div className="export-options">
              <label className="radio-label">
                <input
                  type="radio"
                  name="exportDate"
                  value="today"
                  checked={selectedDate === 'today'}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                Today's Entries
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="exportDate"
                  value="yesterday"
                  checked={selectedDate === 'yesterday'}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                Yesterday's Entries
              </label>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-button cancel"
                onClick={() => setShowExportModal(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-button confirm"
                onClick={handleExportConfirm}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
