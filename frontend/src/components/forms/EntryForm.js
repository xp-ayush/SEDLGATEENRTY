import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import './EntryForm.css';

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

        if (response.data && response.data.driverName) {
          setFormData(prev => ({
            ...prev,
            driverName: response.data.driverName // Ensure driverName is updated
          }));
          addNotification('Driver found', 'success'); // Notify when driver is found
        } else {
          setFormData(prev => ({
            ...prev,
            driverName: '' // Clear driverName if not found
          }));
          addNotification('Driver not found', 'info'); // Notify when driver is not found
        }
      } catch (error) {
        if (error.response?.status === 404) {
          // Handle case where driver is not found
          setFormData(prev => ({
            ...prev,
            driverName: '' // Clear driverName if not found
          }));
          addNotification('Driver not found. Please enter a new driver name.', 'info');
        } else {
          console.error('Error fetching driver info:', error);
          addNotification('Error fetching driver info', 'error');
        }
      }
    } else {
      setFormData(prev => ({
        ...prev,
        driverName: '' // Clear driverName if input is invalid
      }));
    }
  };

  const handleVehicleNumberChange = async (value) => {
    setFormData(prev => ({
      ...prev,
      vehicleNumber: value
    }));

    if (value.length > 0) {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_BASE_URL}/api/vehicle-info/${value}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data && response.data.vehicleType) {
          setFormData(prev => ({
            ...prev,
            vehicleType: response.data.vehicleType // Update vehicleType if found
          }));
          addNotification('Vehicle found', 'success'); // Notify when vehicle is found
        }
      } catch (error) {
        if (error.response?.status === 404) {
          // Handle case where vehicle is not found
          setFormData(prev => ({
            ...prev,
            vehicleType: '' // Clear vehicleType if not found
          }));
          addNotification('Vehicle not found. Please enter a new vehicle type.', 'info');
        } else {
          console.error('Error fetching vehicle info:', error);
          addNotification('Error fetching vehicle info', 'error');
        }
      }
    } else {
      setFormData(prev => ({
        ...prev,
        vehicleType: '' // Clear vehicleType if input is invalid
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'driverMobile') {
      handleDriverMobileChange(value);
    } else if (name === 'vehicleNumber') {
      handleVehicleNumberChange(value);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
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
            onChange={(e) => handleVehicleNumberChange(e.target.value)}
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
          <select
            id="source"
            name="source"
            value={formData.source}
            onChange={handleInputChange}
            className="form-control"
            required
          >
            <option value="">Select Source</option>
            <option value="Baddi Unit 1">Baddi Unit 1</option>
            <option value="Baddi Unit 2">Baddi Unit 2</option>
            <option value="Baddi Unit 3">Baddi Unit 3</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="remarks">Remarks</label>
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
