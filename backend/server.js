const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MySQL connection
const db = mysql.createConnection({
  host: 'seddb.cwqqlkcrophs.ap-south-1.rds.amazonaws.com',
  user: 'admin',
  password: 'Sedl12345', // Add your MySQL password here
  database: 'role_based_auth',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Handle database connection errors
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');

  // Verify entries table exists
  db.query('SHOW TABLES LIKE "entries"', (err, results) => {
    if (err) {
      console.error('Error checking entries table:', err);
      return;
    }
    if (results.length === 0) {
      console.error('Warning: entries table does not exist!');
      console.log('Please create the entries table using the SQL commands provided.');
    } else {
      console.log('Entries table exists');
    }
  });

  // Add recordedBy column if it doesn't exist
  const checkColumnQuery = `
    SELECT COUNT(*) as count 
    FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'role_based_auth' 
    AND TABLE_NAME = 'entries' 
    AND COLUMN_NAME = 'recordedBy'`;

  db.query(checkColumnQuery, (err, result) => {
    if (err) {
      console.error('Error checking column:', err);
      return;
    }

    if (result[0].count === 0) {
      const alterTableQuery = `ALTER TABLE entries ADD COLUMN recordedBy VARCHAR(100) NOT NULL DEFAULT 'System' AFTER remarks;`;
      db.query(alterTableQuery, (err, result) => {
        if (err) {
          console.error('Error adding recordedBy column:', err);
          return;
        }
        console.log('Added recordedBy column successfully');
      });
    }
  });
});

// Handle database errors
db.on('error', (err) => {
  console.error('Database error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Database connection was closed. Reconnecting...');
    db.connect();
  } else {
    throw err;
  }
});

// JWT secret key
const JWT_SECRET = 'your-secret-key'; // Change this to a secure secret key

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Middleware to check if user has view access or higher
const hasViewAccess = (req, res, next) => {
  const allowedRoles = ['admin', 'user', 'view'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Unauthorized access' });
  }
  next();
};

// Middleware to check if user has edit access
const hasEditAccess = (req, res, next) => {
  const allowedRoles = ['admin', 'user'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Unauthorized - Edit access required' });
  }
  next();
};

// Helper function to get entry status
const getEntryStatus = (entry) => {
  const requiredFields = ['driverName', 'driverMobile', 'vehicleNumber', 'source', 'timeIn', 'checkBy'];
  const missingFields = requiredFields.filter(field => !entry[field]);
  
  // Check if timeOut is missing or '00:00'
  if (!entry.timeOut || entry.timeOut === '00:00:00') {
    missingFields.push('timeOut');
  }

  // Check for any empty values in existing fields, excluding loadingUnload and remarks
  Object.entries(entry).forEach(([key, value]) => {
    if (value === '' && key !== 'loadingUnload' && key !== 'remarks') {
      missingFields.push(key);
    }
  });

  return {
    status: missingFields.length > 0 ? 'Pending' : 'Complete',
    missingFields: [...new Set(missingFields)].join(', ') // Remove duplicates and join
  };
};

// Helper function to get invoice status
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
    missingFields: [...new Set(missingFields)].join(', ') // Remove duplicates and join
  };
};

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Query for user
    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
      if (err) {
        console.error('Database error during login:', err);
        return res.status(500).json({ message: 'Server error during login' });
      }

      if (results.length === 0) {
        console.log('No user found with email:', email);
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = results[0];
      console.log('User found:', { id: user.id, email: user.email, role: user.role });

      try {
        // Compare password
        const validPassword = await bcrypt.compare(password, user.password);
        console.log('Password validation result:', validPassword);

        if (!validPassword) {
          console.log('Invalid password for user:', email);
          return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Generate token
        const token = jwt.sign(
          { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            name: user.name 
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        // Send response
        console.log('Login successful for user:', email);
        res.json({ 
          token, 
          role: user.role,
          name: user.name,
          message: 'Login successful' 
        });
      } catch (bcryptError) {
        console.error('Bcrypt error:', bcryptError);
        return res.status(500).json({ message: 'Error verifying password' });
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user data endpoint
app.get('/api/user-data', verifyToken, (req, res) => {
  const query = 'SELECT id, name, email, role FROM users WHERE id = ?';
  db.query(query, [req.user.id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(results[0]);
  });
});

// Get all users (admin only)
app.get('/api/users', verifyToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  const query = 'SELECT id, name, email, role FROM users';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(results);
  });
});

// Create new user (admin only)
app.post('/api/users', verifyToken, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized - Admin access required' });
  }

  const { name, email, password, role, units } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required' });
  }

  // Validate role
  const allowedRoles = ['admin', 'user', 'view'];
  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role. Must be one of: admin, user, or view' });
  }

  try {
    // Check if email already exists
    const checkQuery = 'SELECT * FROM users WHERE email = ?';
    db.query(checkQuery, [email], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      if (results.length > 0) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user with validated role
      const insertQuery = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
      db.query(insertQuery, [name, email, hashedPassword, role || 'user'], async (err, result) => {
        if (err) {
          console.error('Error creating user:', err);
          return res.status(500).json({ message: 'Failed to create user' });
        }

        const userId = result.insertId;

        // If units are provided and role is user, assign units
        if (role === 'user' && units && units.length > 0) {
          const unitValues = units.map(unit => [unit.unit_number, unit.unit_name, userId]);
          const insertUnitsQuery = 'INSERT INTO units (unit_number, unit_name, userId) VALUES ?';
          
          db.query(insertUnitsQuery, [unitValues], (err) => {
            if (err) {
              console.error('Error assigning units:', err);
              return res.status(500).json({ message: 'User created but failed to assign units' });
            }
            
            res.status(201).json({ 
              message: 'User created successfully with units assigned',
              userId: userId
            });
          });
        } else {
          res.status(201).json({ 
            message: 'User created successfully',
            userId: userId
          });
        }
      });
    });
  } catch (error) {
    console.error('Error in user creation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user (admin only)
app.put('/api/users/:id', verifyToken, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized - Admin access required' });
  }

  const userId = req.params.id;
  const { name, email, password, role, units } = req.body;

  try {
    // Start transaction
    await db.promise().query('START TRANSACTION');

    let updateQuery = 'UPDATE users SET name = ?, email = ?, role = ?';
    let queryParams = [name, email, role];

    // Only update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      updateQuery += ', password = ?';
      queryParams.push(hashedPassword);
    }

    updateQuery += ' WHERE id = ?';
    queryParams.push(userId);

    // Update user
    await db.promise().query(updateQuery, queryParams);

    // Handle units if user role is 'user'
    if (role === 'user') {
      // Delete existing units for this user
      await db.promise().query('DELETE FROM units WHERE userId = ?', [userId]);
      
      // Insert new units
      if (units && units.length > 0) {
        const insertUnitsQuery = 'INSERT INTO units (unit_number, unit_name, userId) VALUES ?';
        const unitValues = units.map(unit => [unit.unit_number, unit.unit_name, userId]);
        await db.promise().query(insertUnitsQuery, [unitValues]);
      }
    }

    // Commit transaction
    await db.promise().query('COMMIT');

    // Return updated user data with units
    const [updatedUser] = await db.promise().query(
      'SELECT id, name, email, role FROM users WHERE id = ?',
      [userId]
    );

    if (updatedUser.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If user role is 'user', fetch their units
    if (updatedUser[0].role === 'user') {
      const [units] = await db.promise().query(
        'SELECT unit_number, unit_name FROM units WHERE userId = ?',
        [userId]
      );
      updatedUser[0].units = units;
    }

    res.json(updatedUser[0]);
  } catch (error) {
    // Rollback transaction on error
    await db.promise().query('ROLLBACK');
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Server error while updating user' });
  }
});

// Delete user (admin only)
app.delete('/api/users/:id', verifyToken, async (req, res) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized - Admin access required' });
  }

  const userId = req.params.id;

  try {
    // Check if user exists
    const [user] = await db.promise().query(
      'SELECT role FROM users WHERE id = ?',
      [userId]
    );

    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting the last admin
    if (user[0].role === 'admin') {
      const [adminCount] = await db.promise().query(
        'SELECT COUNT(*) as count FROM users WHERE role = "admin"'
      );
      
      if (adminCount[0].count <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin user' });
      }
    }

    // Delete user
    await db.promise().query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error while deleting user' });
  }
});

// Vehicle Entry endpoint
app.post('/api/vehicle-entry', verifyToken, async (req, res) => {
  const {
    serialNumber,
    date,
    driverMobile,
    driverName,
    vehicleNumber,
    vehicleType,
    source,
    loadingUnload,
    timeIn,
    timeOut,
    checkBy,
    remarks
  } = req.body;

  try {
    const query = `
      INSERT INTO vehicle_entries 
      (serialNumber, date, driverMobile, driverName, vehicleNumber, 
       vehicleType, source, loadingUnload, timeIn, timeOut, checkBy, 
       remarks, user_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await db.promise().execute(query, [
      serialNumber,
      date,
      driverMobile,
      driverName,
      vehicleNumber,
      vehicleType,
      source,
      loadingUnload,
      timeIn,
      timeOut,
      checkBy,
      remarks,
      req.user.id
    ]);

    res.json({ message: 'Vehicle entry recorded successfully' });
  } catch (error) {
    console.error('Error recording vehicle entry:', error);
    res.status(500).json({ message: 'Error recording vehicle entry' });
  }
});

// Get all vehicle entries (for admin)
app.get('/api/vehicle-entries', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const [entries] = await db.promise().query(`
      SELECT ve.*, u.name as recorded_by 
      FROM vehicle_entries ve 
      LEFT JOIN users u ON ve.user_id = u.id 
      ORDER BY ve.created_at DESC
    `);

    res.json(entries);
  } catch (error) {
    console.error('Error fetching vehicle entries:', error);
    res.status(500).json({ message: 'Error fetching vehicle entries' });
  }
});

// Submit new entry
app.post('/api/entries', verifyToken, hasEditAccess, async (req, res) => {
  try {
    const {
      serialNumber,
      date,
      driverMobile,
      driverName,
      vehicleNumber,
      vehicleType,
      source,
      timeIn,
      remarks
    } = req.body;

    // Set default values
    const timeOut = '';
    const checkBy = '';
    const loadingUnload = '';
    const userId = req.user.id;

    const [result] = await db.promise().query(
      `INSERT INTO entries (
        userId, serialNumber, date, driverMobile, driverName, vehicleNumber, 
        vehicleType, source, loadingUnload, timeIn, timeOut, checkBy, remarks, recordedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        serialNumber,
        date,
        driverMobile,
        driverName,
        vehicleNumber,
        vehicleType,
        source,
        loadingUnload,
        timeIn,
        timeOut,
        checkBy,
        remarks,
        req.user.name
      ]
    );

    // Get the newly created entry
    const [entries] = await db.promise().query(
      'SELECT * FROM entries WHERE id = ?',
      [result.insertId]
    );

    if (entries.length === 0) {
      return res.status(404).json({ message: 'Entry not found after creation' });
    }

    const entry = entries[0];
    const status = getEntryStatus(entry);

    res.status(201).json({
      message: 'Entry created successfully',
      entry: { ...entry, status: status.status }
    });
  } catch (error) {
    console.error('Error creating entry:', error);
    res.status(500).json({ message: 'Failed to create entry' });
  }
});

// Get user's entries
app.get('/api/entries', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let query;
    let queryParams = [];

    if (userRole === 'admin') {
      query = `
        SELECT e.*, u.name as recordedBy
        FROM entries e
        LEFT JOIN users u ON e.userId = u.id
        ORDER BY e.date DESC, e.timeIn DESC
      `;
    } else {
      query = `
        SELECT e.*, u.name as recordedBy
        FROM entries e
        LEFT JOIN users u ON e.userId = u.id
        WHERE e.userId = ?
        ORDER BY e.date DESC, e.timeIn DESC
      `;
      queryParams = [userId];
    }

    const [entries] = await db.promise().query(query, queryParams);

    // Process entries to handle null/empty values
    const processedEntries = entries.map(entry => ({
      ...entry,
      timeOut: entry.timeOut === '00:00:00' ? '' : entry.timeOut,
      loadingUnload: entry.loadingUnload || '',
      checkBy: entry.checkBy || ''
    }));

    // Get entry status for each entry
    const entriesWithStatus = processedEntries.map(entry => ({
      ...entry,
      status: getEntryStatus(entry).status
    }));

    res.json({
      entries: entriesWithStatus,
      totalCount: entriesWithStatus.length
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ message: 'Failed to fetch entries' });
  }
});

// Get entries with search, filter, sort, and pagination
app.get('/api/entries', verifyToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { dateFrom, dateTo, searchTerm, sortKey, sortDir } = req.query;

  let whereClause = '1=1';
  const params = [];

  if (dateFrom) {
    whereClause += ' AND e.date >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ' AND e.date <= ?';
    params.push(dateTo);
  }
  if (searchTerm) {
    whereClause += ` AND (
      e.serialNumber LIKE ? OR
      e.driverName LIKE ? OR
      e.driverMobile LIKE ? OR
      e.vehicleNumber LIKE ? OR
      e.source LIKE ? OR
      e.remarks LIKE ?
    )`;
    const searchPattern = `%${searchTerm}%`;
    params.push(...Array(6).fill(searchPattern));
  }

  const sortColumn = sortKey || 'date';
  const sortDirection = sortDir || 'desc';
  const allowedColumns = ['serialNumber', 'date', 'driverName', 'vehicleNumber'];
  const safeSort = allowedColumns.includes(sortColumn) ? sortColumn : 'date';

  // First, get total count
  const countQuery = `SELECT COUNT(*) as total FROM entries e WHERE ${whereClause}`;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) {
      console.error('Error counting entries:', err);
      return res.status(500).json({ message: 'Error fetching entries' });
    }

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Then get paginated entries
    const query = `
      SELECT 
        e.*,
        u.name as recordedBy
      FROM entries e
      LEFT JOIN users u ON e.userId = u.id
      WHERE ${whereClause}
      ORDER BY e.${safeSort} ${sortDirection === 'asc' ? 'ASC' : 'DESC'}, e.timeIn DESC
      LIMIT ? OFFSET ?
    `;

    db.query(query, [...params, limit, offset], (err, entries) => {
      if (err) {
        console.error('Error fetching entries:', err);
        return res.status(500).json({ message: 'Error fetching entries' });
      }

      res.json({
        entries,
        totalPages,
        currentPage: page,
        totalEntries: total
      });
    });
  });
});

// Get invoices with search, filter, sort, and pagination
app.get('/api/invoices', verifyToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  const { dateFrom, dateTo, searchTerm, entryType, sortKey, sortDir } = req.query;

  let whereClause = '1=1';
  const params = [];

  if (dateFrom) {
    whereClause += ' AND i.date >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ' AND i.date <= ?';
    params.push(dateTo);
  }
  if (searchTerm) {
    whereClause += ` AND (
      i.serialNumber LIKE ? OR
      i.partyName LIKE ? OR
      i.billNumber LIKE ? OR
      i.source LIKE ? OR
      i.remarks LIKE ? OR
      im.material_name LIKE ?
    )`;
    const searchPattern = `%${searchTerm}%`;
    params.push(...Array(6).fill(searchPattern));
  }
  if (entryType) {
    whereClause += ' AND i.entryType = ?';
    params.push(entryType);
  }

  const sortColumn = sortKey || 'date';
  const sortDirection = sortDir || 'desc';
  const allowedColumns = ['serialNumber', 'date', 'partyName', 'billNumber', 'billAmount', 'entryType'];
  const safeSort = allowedColumns.includes(sortColumn) ? sortColumn : 'date';

  // First, get total count
  const countQuery = `
    SELECT COUNT(DISTINCT i.id) as total 
    FROM invoices i 
    LEFT JOIN invoice_materials im ON i.id = im.invoice_id
    WHERE ${whereClause}
  `;
  
  db.query(countQuery, params, (err, countResult) => {
    if (err) {
      console.error('Error counting invoices:', err);
      return res.status(500).json({ message: 'Error fetching invoices' });
    }

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Then get paginated invoices with materials
    const query = `
      SELECT 
        i.*,
        u.name as recordedBy,
        GROUP_CONCAT(
          JSON_OBJECT(
            'material_name', im.material_name,
            'quantity', im.quantity
          )
        ) as materials
      FROM invoices i
      LEFT JOIN users u ON i.recordedBy = u.id
      LEFT JOIN invoice_materials im ON i.id = im.invoice_id
      WHERE ${whereClause}
      GROUP BY i.id
      ORDER BY i.${safeSort} ${sortDirection === 'asc' ? 'ASC' : 'DESC'}, i.timeIn DESC
      LIMIT ? OFFSET ?
    `;

    db.query(query, [...params, limit, offset], (err, invoices) => {
      if (err) {
        console.error('Error fetching invoices:', err);
        return res.status(500).json({ message: 'Error fetching invoices' });
      }

      // Parse the materials JSON string for each invoice
      const formattedInvoices = invoices.map(invoice => ({
        ...invoice,
        materials: invoice.materials ? JSON.parse(`[${invoice.materials}]`) : []
      }));

      res.json({
        invoices: formattedInvoices,
        totalPages,
        currentPage: page,
        totalEntries: total
      });
    });
  });
});

// Export entries to Excel
app.get('/api/entries/export', verifyToken, async (req, res) => {
  try {
    const { dateFrom, dateTo, searchTerm } = req.query;
    let whereClause = '1=1';
    const params = [];

    if (dateFrom) {
      whereClause += ' AND e.date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClause += ' AND e.date <= ?';
      params.push(dateTo);
    }
    if (searchTerm) {
      whereClause += ` AND (
        e.serialNumber LIKE ? OR
        e.driverName LIKE ? OR
        e.driverMobile LIKE ? OR
        e.vehicleNumber LIKE ? OR
        e.source LIKE ? OR
        e.remarks LIKE ?
      )`;
      const searchPattern = `%${searchTerm}%`;
      params.push(...Array(6).fill(searchPattern));
    }

    const query = `
      SELECT 
        e.*,
        u.name as recordedBy
      FROM entries e
      LEFT JOIN users u ON e.userId = u.id
      WHERE ${whereClause}
      ORDER BY e.date DESC, e.timeIn DESC
    `;

    db.query(query, params, (err, entries) => {
      if (err) {
        console.error('Error fetching entries for export:', err);
        return res.status(500).json({ message: 'Error exporting entries' });
      }

      const XLSX = require('xlsx');
      const workbook = XLSX.utils.book_new();

      // Format data for Excel
      const formattedData = entries.map(entry => {
        const { status } = getEntryStatus(entry);
        return {
          'Serial Number': entry.serialNumber,
          'Date': new Date(entry.date).toLocaleDateString(),
          'Driver Name': entry.driverName,
          'Driver Mobile': entry.driverMobile,
          'Vehicle Number': entry.vehicleNumber,
          'Vehicle Type': entry.vehicleType,
          'Source': entry.source,
          'Loading/Unload': entry.loadingUnload,
          'Time In': entry.timeIn?.substring(0, 5) || '',
          'Time Out': entry.timeOut?.substring(0, 5) || '',
          'Check By': entry.checkBy,
          'Remarks': entry.remarks,
          'Recorded By': entry.recordedBy,
          'Status': status
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);

      // Add cell styling for status column
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const statusCol = Object.keys(formattedData[0]).length - 1; // Status column
      for (let row = 1; row <= range.e.r; row++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: statusCol })];
        if (cell && cell.v === 'Pending') {
          cell.s = { fill: { fgColor: { rgb: 'FFED7D7D' } } }; // Light red for pending
        } else if (cell && cell.v === 'Complete') {
          cell.s = { fill: { fgColor: { rgb: 'FFC6F6D5' } } }; // Light green for complete
        }
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Entries');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename=entries.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    });
  } catch (error) {
    console.error('Error exporting entries:', error);
    res.status(500).json({ message: 'Error exporting entries' });
  }
});

// Export invoices to Excel
app.get('/api/invoices/export', verifyToken, async (req, res) => {
  try {
    const { dateFrom, dateTo, searchTerm, entryType } = req.query;
    let whereClause = '1=1';
    const params = [];

    if (dateFrom) {
      whereClause += ' AND i.date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClause += ' AND i.date <= ?';
      params.push(dateTo);
    }
    if (searchTerm) {
      whereClause += ` AND (
        i.serialNumber LIKE ? OR
        i.partyName LIKE ? OR
        i.billNumber LIKE ? OR
        i.source LIKE ? OR
        i.remarks LIKE ? OR
        im.material_name LIKE ?
      )`;
      const searchPattern = `%${searchTerm}%`;
      params.push(...Array(6).fill(searchPattern));
    }
    if (entryType) {
      whereClause += ' AND i.entryType = ?';
      params.push(entryType);
    }

    const query = `
      SELECT 
        i.*,
        u.name as recordedBy,
        GROUP_CONCAT(
          JSON_OBJECT(
            'material_name', im.material_name,
            'quantity', im.quantity
          )
        ) as materials
      FROM invoices i
      LEFT JOIN users u ON i.recordedBy = u.id
      LEFT JOIN invoice_materials im ON i.id = im.invoice_id
      WHERE ${whereClause}
      GROUP BY i.id
      ORDER BY i.date DESC, i.timeIn DESC
    `;

    db.query(query, params, (err, invoices) => {
      if (err) {
        console.error('Error fetching invoices for export:', err);
        return res.status(500).json({ message: 'Error exporting invoices' });
      }

      const XLSX = require('xlsx');
      const workbook = XLSX.utils.book_new();

      // Format data for Excel
      const formattedData = invoices.map(invoice => {
        const materials = invoice.materials ? JSON.parse(`[${invoice.materials}]`) : [];
        const materialsList = materials.map(m => `${m.material_name} (${m.quantity})`).join(', ');
        const { status } = getInvoiceStatus({
          ...invoice,
          materials
        });

        return {
          'Serial Number': invoice.serialNumber,
          'Date': new Date(invoice.date).toLocaleDateString(),
          'Party Name': invoice.partyName,
          'Bill Number': invoice.billNumber,
          'Materials': materialsList,
          'Bill Amount': invoice.billAmount,
          'Entry Type': invoice.entryType,
          'Vehicle Type': invoice.vehicleType,
          'Source': invoice.source,
          'Time In': invoice.timeIn?.substring(0, 5) || '',
          'Time Out': invoice.timeOut?.substring(0, 5) || '',
          'Remarks': invoice.remarks,
          'Recorded By': invoice.recordedBy,
          'Status': status
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(formattedData);

      // Add cell styling for status column
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      const statusCol = Object.keys(formattedData[0]).length - 1; // Status column
      for (let row = 1; row <= range.e.r; row++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: statusCol })];
        if (cell && cell.v === 'Pending') {
          cell.s = { fill: { fgColor: { rgb: 'FFED7D7D' } } }; // Light red for pending
        } else if (cell && cell.v === 'Complete') {
          cell.s = { fill: { fgColor: { rgb: 'FFC6F6D5' } } }; // Light green for complete
        }
      }

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', 'attachment; filename=invoices.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    });
  } catch (error) {
    console.error('Error exporting invoices:', error);
    res.status(500).json({ message: 'Error exporting invoices' });
  }
});

// Delete entry
app.delete('/api/entries/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  try {
    await db.promise().query('DELETE FROM entries WHERE id = ?', [req.params.id]);
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting entry:', error);
    res.status(500).json({ message: 'Failed to delete entry' });
  }
});

// Update entry
app.put('/api/entries/:id', verifyToken, hasEditAccess, async (req, res) => {
  try {
    // If only updating specific fields, use a simpler query
    const allowedSingleFields = ['timeOut', 'loadingUnload', 'checkBy'];
    const updateFields = Object.keys(req.body);
    
    if (updateFields.length === 1 && allowedSingleFields.includes(updateFields[0])) {
      const field = updateFields[0];
      const value = req.body[field];
      
      await db.promise().query(
        `UPDATE entries SET ${field} = ? WHERE id = ?`,
        [value, req.params.id]
      );
    } else {
      // Full update
      const {
        date,
        driverMobile,
        driverName,
        vehicleNumber,
        vehicleType,
        source,
        loadingUnload,
        timeIn,
        timeOut,
        checkBy,
        remarks
      } = req.body;

      await db.promise().query(
        `UPDATE entries SET 
          date = ?,
          driverMobile = ?,
          driverName = ?,
          vehicleNumber = ?,
          vehicleType = ?,
          source = ?,
          loadingUnload = ?,
          timeIn = ?,
          timeOut = ?,
          checkBy = ?,
          remarks = ?
        WHERE id = ?`,
        [
          date,
          driverMobile,
          driverName,
          vehicleNumber,
          vehicleType,
          source,
          loadingUnload,
          timeIn,
          timeOut,
          checkBy,
          remarks,
          req.params.id
        ]
      );
    }

    // Get updated entry
    const [updatedEntries] = await db.promise().query(
      'SELECT * FROM entries WHERE id = ?',
      [req.params.id]
    );

    if (updatedEntries.length === 0) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    const updatedEntry = updatedEntries[0];
    const status = getEntryStatus(updatedEntry);

    res.json({ 
      message: 'Entry updated successfully',
      entry: { ...updatedEntry, status: status.status }
    });
  } catch (error) {
    console.error('Error updating entry:', error);
    res.status(500).json({ message: 'Failed to update entry' });
  }
});

// Get user profile endpoint
app.get('/api/profile', verifyToken, (req, res) => {
  const userId = req.user.id;
  
  const query = 'SELECT id, name, email, role, created_at FROM users WHERE id = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching user profile:', err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = results[0];
    res.json(user);
  });
});

// Change password endpoint
app.put('/api/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user.id;

  // Validate passwords
  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: 'All password fields are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: 'New passwords do not match' });
  }

  try {
    // Get user's current password
    const query = 'SELECT password FROM users WHERE id = ?';
    db.query(query, [userId], async (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Server error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      const user = results[0];

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update password in database
      const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
      db.query(updateQuery, [hashedPassword, userId], (updateErr) => {
        if (updateErr) {
          console.error('Error updating password:', updateErr);
          return res.status(500).json({ message: 'Error updating password' });
        }

        res.json({ message: 'Password updated successfully' });
      });
    });
  } catch (error) {
    console.error('Error in change password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get driver info by mobile number
app.get('/api/driver-info/:mobile', verifyToken, (req, res) => {
  const mobile = req.params.mobile.trim();
  
  // Validate mobile number format
  if (!/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ message: 'Invalid mobile number format' });
  }

  const query = `
    SELECT driverName 
    FROM driverInfo 
    WHERE driverMobile = ? 
    COLLATE utf8mb4_general_ci
    LIMIT 1
  `;
  
  db.query(query, [mobile], (err, results) => {
    if (err) {
      console.error('Error fetching driver info:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    res.json(results[0]);
  });
});

// Save driver info
app.post('/api/driver-info', verifyToken, (req, res) => {
  const { driverMobile, driverName } = req.body;
  
  // Validate inputs
  if (!driverMobile || !driverName) {
    return res.status(400).json({ message: 'Driver mobile and name are required' });
  }
  
  // Validate mobile number format
  if (!/^\d{10}$/.test(driverMobile.trim())) {
    return res.status(400).json({ message: 'Invalid mobile number format' });
  }

  const query = `
    INSERT INTO driverInfo (driverMobile, driverName) 
    VALUES (?, ?) 
    ON DUPLICATE KEY UPDATE driverName = ?
  `;
  
  db.query(query, [driverMobile.trim(), driverName.trim(), driverName.trim()], (err, results) => {
    if (err) {
      console.error('Error saving driver info:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json({ message: 'Driver info saved successfully' });
  });
});

// Get vehicle info by vehicle number
app.get('/api/vehicle-info/:number', verifyToken, (req, res) => {
  const vehicleNumber = req.params.number;
  const query = 'SELECT vehicletype FROM vehicleinfo WHERE vehiclenumber = ?';
  
  db.query(query, [vehicleNumber], (err, results) => {
    if (err) {
      console.error('Error fetching vehicle info:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }
    // Return in camelCase to match frontend
    res.json({
      vehicleType: results[0].vehicletype
    });
  });
});

// Save vehicle info
app.post('/api/vehicle-info', verifyToken, (req, res) => {
  const { vehicleNumber, vehicleType } = req.body;
  
  const query = 'INSERT INTO vehicleinfo (vehiclenumber, vehicletype) VALUES (?, ?) ON DUPLICATE KEY UPDATE vehicletype = ?';
  
  db.query(query, [vehicleNumber, vehicleType, vehicleType], (err, results) => {
    if (err) {
      console.error('Error saving vehicle info:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }
    res.json({ message: 'Vehicle info saved successfully' });
  });
});

// Source location suggestions endpoints
app.post('/api/source-locations', verifyToken, (req, res) => {
  const { location } = req.body;
  
  if (!location) {
    return res.status(400).json({ message: 'Location is required' });
  }

  // First check if location exists
  db.query('SELECT id, frequency FROM source_locations WHERE location = ?', [location], (err, results) => {
    if (err) {
      console.error('Error checking source location:', err);
      return res.status(500).json({ message: 'Error saving source location' });
    }

    if (results.length > 0) {
      // Update existing location frequency
      db.query('UPDATE source_locations SET frequency = frequency + 1 WHERE id = ?', [results[0].id], (err) => {
        if (err) {
          console.error('Error updating source location frequency:', err);
          return res.status(500).json({ message: 'Error updating source location' });
        }
        res.json({ message: 'Source location updated successfully' });
      });
    } else {
      // Insert new location
      db.query('INSERT INTO source_locations (location) VALUES (?)', [location], (err) => {
        if (err) {
          console.error('Error saving new source location:', err);
          return res.status(500).json({ message: 'Error saving source location' });
        }
        res.json({ message: 'Source location saved successfully' });
      });
    }
  });
});

app.get('/api/source-locations/suggestions', verifyToken, (req, res) => {
  const { search } = req.query;
  
  let query = 'SELECT location FROM source_locations';
  let params = [];
  
  if (search) {
    query += ' WHERE location LIKE ?';
    params.push(`${search}%`);
  }
  
  query += ' ORDER BY frequency DESC LIMIT 10';
  
  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error getting source suggestions:', err);
      return res.status(500).json({ message: 'Error getting suggestions' });
    }
    res.json(results.map(row => row.location));
  });
});

// Unit management endpoints
app.post('/api/units', verifyToken, (req, res) => {
  const { unit_number, unit_name } = req.body;
  const userId = req.user.id;

  if (req.user.role === 'admin') {
    return res.status(403).json({ message: 'Admin cannot be assigned units' });
  }

  const query = 'INSERT INTO units (unit_number, unit_name, userId) VALUES (?, ?, ?)';
  db.query(query, [unit_number, unit_name, userId], (err, result) => {
    if (err) {
      console.error('Error creating unit:', err);
      return res.status(500).json({ message: 'Error creating unit' });
    }
    res.status(201).json({ message: 'Unit created successfully', id: result.insertId });
  });
});

// Get units for logged-in user
app.get('/api/user/units', verifyToken, (req, res) => {
  const userId = req.user.id;

  if (req.user.role === 'admin') {
    return res.status(403).json({ message: 'Admin does not have assigned units' });
  }

  const query = 'SELECT * FROM units WHERE userId = ?';
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching units:', err);
      return res.status(500).json({ message: 'Error fetching units' });
    }
    res.json(results);
  });
});

// Get entries with pagination for view dashboard
app.get('/api/view-entries', verifyToken, hasViewAccess, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const [entries] = await db.promise().query(
      `SELECT e.*, d.driverName 
       FROM entries e 
       LEFT JOIN driver_info d ON e.driverMobile = d.driverMobile 
       ORDER BY e.date DESC 
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await db.promise().query('SELECT COUNT(*) as total FROM entries');
    
    res.json({
      entries,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEntries: total,
        entriesPerPage: limit
      }
    });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get last serial number endpoint
app.get('/api/entries/last-serial', verifyToken, hasViewAccess, async (req, res) => {
  try {
    // Query the database and cast serialNumber to an integer for correct comparison
    const query = 'SELECT serialNumber FROM entries ORDER BY CAST(serialNumber AS UNSIGNED) DESC LIMIT 1';
    db.query(query, (err, results) => {
      if (err) {
        console.error('Error getting last serial number:', err);
        return res.status(500).json({ message: 'Error getting last serial number' });
      }

      // Ensure serialNumber is parsed as an integer and handle the default case when no results exist
      const lastSerialNumber = results.length > 0 ? parseInt(results[0].serialNumber, 10) : 0;
      res.json({ lastSerialNumber });
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update invoice
app.put('/api/invoices/:id', verifyToken, hasEditAccess, async (req, res) => {
  try {
    const {
      invoiceNumber,
      date,
      unit,
      amount,
      status,
      remarks
    } = req.body;

    // Check if invoice exists
    const [existingInvoices] = await db.promise().query(
      'SELECT * FROM invoices WHERE id = ?',
      [req.params.id]
    );

    if (existingInvoices.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Update invoice
    await db.promise().query(
      `UPDATE invoices SET 
        invoiceNumber = ?,
        date = ?,
        unit = ?,
        amount = ?,
        status = ?,
        remarks = ?
      WHERE id = ?`,
      [
        invoiceNumber,
        date,
        unit,
        amount,
        status,
        remarks,
        req.params.id
      ]
    );

    // Get updated invoice
    const [updatedInvoices] = await db.promise().query(
      'SELECT * FROM invoices WHERE id = ?',
      [req.params.id]
    );

    if (updatedInvoices.length === 0) {
      return res.status(404).json({ message: 'Invoice not found after update' });
    }

    const updatedInvoice = updatedInvoices[0];
    const invoiceStatus = getInvoiceStatus(updatedInvoice);

    res.json({ 
      message: 'Invoice updated successfully',
      invoice: { ...updatedInvoice, status: invoiceStatus.status }
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ message: 'Failed to update invoice' });
  }
});

// Update invoice timeout
app.put('/api/invoices/:id/timeout', verifyToken, hasEditAccess, async (req, res) => {
  try {
    const { timeOut } = req.body;
    const invoiceId = req.params.id;

    // Check if invoice exists
    const [existingInvoices] = await db.promise().query(
      'SELECT * FROM invoices WHERE id = ?',
      [invoiceId]
    );

    if (existingInvoices.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Update timeout
    await db.promise().query(
      'UPDATE invoices SET timeOut = ? WHERE id = ?',
      [timeOut, invoiceId]
    );

    // Get updated invoice
    const [updatedInvoices] = await db.promise().query(
      'SELECT * FROM invoices WHERE id = ?',
      [invoiceId]
    );

    const updatedInvoice = updatedInvoices[0];
    const status = getInvoiceStatus(updatedInvoice);

    res.json({ 
      message: 'Invoice timeout updated successfully',
      invoice: { ...updatedInvoice, status: status.status }
    });
  } catch (error) {
    console.error('Error updating invoice timeout:', error);
    res.status(500).json({ message: 'Failed to update invoice timeout' });
  }
});

const invoiceRoutes = require('./routes/invoice.routes');
app.use('/api', invoiceRoutes);

const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

const entryRoutes = require('./routes/entries.routes');
app.use('/api', entryRoutes);

const vehicleRoutes = require('./routes/vehicle.routes');
app.use('/api', vehicleRoutes);

const adminRoutes = require('./routes/admin.routes');
app.use('/api', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
