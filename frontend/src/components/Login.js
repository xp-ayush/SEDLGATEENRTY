import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import './Login.css';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaTruck, FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [status, setStatus] = useState({
    loading: false,
    error: null
  });
  const [showPassword, setShowPassword] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    // Don't auto-remove success notifications on login
    if (type !== 'success') {
      setTimeout(() => {
        removeNotification(id);
      }, 5000);
    }
  };

  const removeNotification = (id) => {
    // Add fade-out animation before removing
    const notification = document.querySelector(`.notification-${id}`);
    if (notification) {
      notification.classList.add('fade-out');
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 300); // Match animation duration
    } else {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (token && role) {
      navigate(`/${role}-dashboard`);
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value.trim()
    }));
    // Clear error when user starts typing
    if (status.error) {
      setStatus(prev => ({ ...prev, error: null }));
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.email || !formData.password) {
      setStatus({
        loading: false,
        error: 'Please fill in all fields'
      });
      addNotification('Please fill in all fields', 'error');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setStatus({
        loading: false,
        error: 'Please enter a valid email address'
      });
      addNotification('Please enter a valid email address', 'error');
      return;
    }

    setStatus({ loading: true, error: null });

    try {
      const response = await axios.post(`${API_BASE_URL}/api/login`, formData);
      
      const { token, role, name } = response.data;
      
      // Store user info in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('role', role);
      localStorage.setItem('userName', name);
      localStorage.setItem('showLoginSuccess', 'true');
      
      // Show success notification with proper role name
      const roleDisplay = {
        admin: 'Admin',
        user: 'User',
        view: 'Viewer'
      }[role] || 'User';
      
      addNotification(`${roleDisplay} logged in successfully`, 'success');
      
      // Redirect based on role after a short delay to show notification
      setTimeout(() => {
        navigate(`/${role}-dashboard`);
      }, 1500);

    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || 'Login failed. Please try again.';
      setStatus({
        loading: false,
        error: errorMessage
      });
      addNotification(errorMessage, 'error');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <FaTruck className="logo" />
          <h1>Login</h1>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <div className="input-group">
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <div className="input-group">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={togglePasswordVisibility}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className={`login-button ${status.loading ? 'loading' : ''}`}
            disabled={status.loading}
          >
            {status.loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
      {notifications.length > 0 && (
        <div className="notifications-container">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`notification notification-${notification.type} notification-${notification.id}`}
            >
              <div className="notification-content">
                {notification.type === 'success' && <FaCheckCircle className="notification-icon" />}
                {notification.type === 'error' && <FaTimesCircle className="notification-icon" />}
                {notification.type === 'warning' && <FaExclamationTriangle className="notification-icon" />}
                {notification.type === 'info' && <FaInfoCircle className="notification-icon" />}
                <span className="notification-message">{notification.message}</span>
              </div>
              <button 
                className="notification-close"
                onClick={() => removeNotification(notification.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Login;
