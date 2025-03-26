import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import './EntryForm.css';
import { debounce } from 'lodash'; // Import debounce function

const EntryForm = ({ onSubmitSuccess, addNotification }) => {
  const [formData, setFormData] = useState({
    serialNumber: '',
    date: new Date().toISOString().split('T')[0],
    driverMobile: '',
    driverName: '',
    vehicleNumber: '',
    vehicleType: '',
    source: '',
    timeIn: new Date().toLocaleTimeString('en-US', { hour12: false }),
    remarks: ''
  });

  const [sourceSuggestions, setSourceSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitState, setSubmitState] = useState({
    loading: false,
    success: false,
    error: null
  });

  // Fetch last serial number on component mount
  useEffect(() => {
    const fetchLastSerialNumber = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/entries/last-serial`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const lastSerial = response.data.lastSerialNumber || 0;
        setFormData(prev => ({
          ...prev,
          serialNumber: (lastSerial + 1).toString().padStart(4, '0')
        }));
      } catch (error) {
        console.error('Error fetching last serial number:', error);
        addNotification('Error fetching serial number', 'error');
      }
    };

    fetchLastSerialNumber();
  }, [addNotification]);

  // Update timeIn every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setFormData(prev => ({
        ...prev,
        timeIn: new Date().toLocaleTimeString('en-US', { hour12: false })
      }));
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Debounced function to handle source input
  const handleSourceInput = debounce(async (value) => {
    if (value.length >= 2) {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/sources/suggest?query=${value}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSourceSuggestions(response.data);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Error fetching source suggestions:', error);
      }
    } else {
      setSourceSuggestions([]);
      setShowSuggestions(false);
    }
  }, 500); // Debounce API call by 500ms

  const handleDriverMobileChange = async (value) => {
    setFormData(prev => ({
      ...prev,
      driverMobile: value
    }));

    if (value.length === 10) {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/driver-info/${value}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFormData(prev => ({
          ...prev,
          driverName: response.data.driverName
        }));
      } catch (error) {
        console.error('Error fetching driver info:', error);
        addNotification('Driver not found', 'error');
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'driverMobile') {
      handleDriverMobileChange(value);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    if (name === 'source') {
      handleSourceInput(value);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setFormData(prev => ({
      ...prev,
      source: suggestion
    }));
    setShowSuggestions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitState({ loading: true, success: false, error: null });

    try {
      const token = localStorage.getItem('token');
      // Add default empty values for loadingUnload, timeOut, and checkBy
      const submitData = {
        ...formData,
        loadingUnload: '',  // This will be updated later in history
        timeOut: '',       // This will be updated later in history
        checkBy: ''        // This will be updated later in history
      };

      await axios.post(`${API_BASE_URL}/api/entries`, submitData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSubmitState({
        loading: false,
        success: true,
        error: null
      });

      // After successful submission, fetch new serial number
      const response = await axios.get(`${API_BASE_URL}/api/entries/last-serial`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const lastSerial = response.data.lastSerialNumber || 0;

      // Reset form with new serial number and current time
      setFormData({
        serialNumber: (lastSerial + 1).toString().padStart(4, '0'),
        date: new Date().toISOString().split('T')[0],
        driverMobile: '',
        driverName: '',
        vehicleNumber: '',
        vehicleType: '',
        source: '',
        timeIn: new Date().toLocaleTimeString('en-US', { hour12: false }),
        remarks: ''
      });

      addNotification('Entry added successfully!', 'success');
      onSubmitSuccess();
    } catch (error) {
      setSubmitState({
        loading: false,
        success: false,
        error: error.response?.data?.message || 'Failed to submit entry'
      });
      addNotification(error.response?.data?.message || 'Failed to submit entry', 'error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="entry-form">
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="serialNumber">Serial Number</label>
          <input
            type="text"
            id="serialNumber"
            name="serialNumber"
            value={formData.serialNumber}
            className="form-control"
            readOnly
          />
        </div>
        <div className="form-group">
          <label htmlFor="date">Date</label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            className="form-control"
            readOnly // Make the field non-editable
          />
        </div>
        <div className="form-group">
          <label htmlFor="timeIn">Time In</label>
          <input
            type="text"
            id="timeIn"
            name="timeIn"
            value={formData.timeIn}
            className="form-control"
            readOnly
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="driverMobile">Driver Mobile</label>
          <input
            type="tel"
            id="driverMobile"
            name="driverMobile"
            value={formData.driverMobile}
            onChange={(e) => handleDriverMobileChange(e.target.value)}
            onKeyPress={(e) => {
              if (!/[0-9]/.test(e.key)) {
                e.preventDefault(); // Prevent non-numeric input
              }
            }}
            className="form-control"
            required
            inputMode="numeric" // Optimize for numeric keyboard on mobile devices
            maxLength="10" // Restrict input to 10 characters
          />
        </div>
        <div className="form-group">
          <label htmlFor="driverName">Driver Name</label>
          <input
            type="text"
            id="driverName"
            name="driverName"
            value={formData.driverName}
            onChange={handleInputChange}
            className="form-control"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="vehicleNumber">Vehicle Number</label>
          <input
            type="text"
            id="vehicleNumber"
            name="vehicleNumber"
            value={formData.vehicleNumber}
            onChange={handleInputChange}
            className="form-control"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="vehicleType">Vehicle Type</label>
          <input
            type="text"
            id="vehicleType"
            name="vehicleType"
            value={formData.vehicleType}
            onChange={handleInputChange}
            className="form-control"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="source">Source</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              id="source"
              name="source"
              value={formData.source}
              onChange={handleInputChange}
              className="form-control"
              required
            />
            {showSuggestions && sourceSuggestions.length > 0 && (
              <ul className="suggestions-list">
                {sourceSuggestions.map((suggestion, index) => (
                  <li
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="remarks">Remarks</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              id="remarks"
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              className="form-control"
              required
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        className={`submit-button ${submitState.loading ? 'loading' : ''}`}
        disabled={submitState.loading}
      >
        {submitState.loading ? 'Submitting...' : 'Submit Entry'}
      </button>
    </form>
  );
};

export default EntryForm;
