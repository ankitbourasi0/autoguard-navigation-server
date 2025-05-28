const http = require('http');
const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public')); // Serve static files for admin dashboard

// In-memory storage (replace with database in production)
const activeUsers = new Map();
const shiftLocations = new Map();
const locationHistory = new Map();

// Create server instance
const server = http.createServer(app);

// Socket.io server with proper CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// REST API Routes for Admin Dashboard

// Get all active users and their locations
app.get('/api/users', (req, res) => {
  const users = Array.from(activeUsers.values());
  res.json({
    success: true,
    data: users,
    count: users.length
  });
});

// Add or update shift location
app.post('/api/shift-location', async (req, res) => {
  try {
    const { userId, latitude, longitude, shiftTime, address } = req.body;
    
    if (!userId || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, latitude, longitude'
      });
    }

    const shiftId = `shift_${userId}_${Date.now()}`;
    const shiftLocation = {
      id: shiftId,
      userId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      shiftTime: shiftTime || new Date().toISOString(),
      address: address || await reverseGeocode(latitude, longitude),
      createdAt: new Date().toISOString()
    };

    shiftLocations.set(shiftId, shiftLocation);

    // Notify the specific user about their shift location
    const userSockets = Array.from(io.sockets.sockets.values())
      .filter(socket => socket.userId === userId);
    
    userSockets.forEach(socket => {
      socket.emit('shiftLocationUpdate', shiftLocation);
    });

    res.json({
      success: true,
      message: 'Shift location added successfully',
      data: shiftLocation
    });

  } catch (error) {
    console.error('Error adding shift location:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get shift locations for a user
app.get('/api/shift-location/:userId', (req, res) => {
  const { userId } = req.params;
  const userShifts = Array.from(shiftLocations.values())
    .filter(shift => shift.userId === userId);
  
  res.json({
    success: true,
    data: userShifts
  });
});

// Get location history for a user
app.get('/api/location-history/:userId', (req, res) => {
  const { userId } = req.params;
  const { from, to, limit = 100 } = req.query;
  
  let history = locationHistory.get(userId) || [];
  
  // Filter by date range if provided
  if (from || to) {
    history = history.filter(location => {
      const timestamp = new Date(location.timestamp);
      if (from && timestamp < new Date(from)) return false;
      if (to && timestamp > new Date(to)) return false;
      return true;
    });
  }
  
  // Limit results
  history = history.slice(-parseInt(limit));
  
  res.json({
    success: true,
    data: history,
    count: history.length
  });
});

// Delete shift location
app.delete('/api/shift-location/:shiftId', (req, res) => {
  const { shiftId } = req.params;
  
  if (shiftLocations.has(shiftId)) {
    shiftLocations.delete(shiftId);
    res.json({
      success: true,
      message: 'Shift location deleted successfully'
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Shift location not found'
    });
  }
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Reverse geocoding helper function
async function reverseGeocode(lat, lon) {
  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: {
        format: "json",
        lat: lat,
        lon: lon,
        addressdetails: 1
      },
      headers: {
        "User-Agent": "LocationTrackerApp/1.0 (admin@yourcompany.com)",
      },
    });
    return response.data.display_name || "Unknown location";
  } catch (error) {
    console.error("Reverse geocoding failed:", error.message);
    return "Unknown location";
  }
}

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`🔗 Client Connected: ${socket.id}`);
  
  // Handle user authentication/identification
  socket.on('authenticate', (userData) => {
    socket.userId = userData.userId;
    socket.userName = userData.userName || 'Unknown User';
    console.log(`👤 User authenticated: ${socket.userName} (${socket.userId})`);
  });

  // Handle location updates from mobile app
  socket.on("locationUpdate", async (data) => {
    try {
      console.log(`📍 Location Update from ${socket.id}:`, data);
      
      const enrichedData = {
        ...data,
        socketId: socket.id,
        userId: socket.userId || data.userId || 'anonymous',
        userName: socket.userName || data.userName || 'Unknown User',
        timestamp: Date.now(),
        address: null
      };

      // Reverse geocoding to get address
      try {
        const address = await reverseGeocode(data.latitude, data.longitude);
        enrichedData.address = address;
      } catch (geocodeError) {
        console.error("Geocoding error:", geocodeError.message);
      }

      // Store current location
      activeUsers.set(socket.id, enrichedData);

      // Store in location history
      const userId = enrichedData.userId;
      if (!locationHistory.has(userId)) {
        locationHistory.set(userId, []);
      }
      const userHistory = locationHistory.get(userId);
      userHistory.push(enrichedData);
      
      // Keep only last 1000 locations per user
      if (userHistory.length > 1000) {
        userHistory.shift();
      }

      // Broadcast to admin dashboard
      io.emit('userLocationUpdate', enrichedData);

      console.log(`✅ Location processed for user: ${enrichedData.userName}`);

    } catch (error) {
      console.error("❌ Error processing location update:", error);
      socket.emit('error', { message: 'Failed to process location update' });
    }
  });

  // Handle admin requests for user list
  socket.on('getActiveUsers', () => {
    const users = Array.from(activeUsers.values());
    socket.emit('activeUsersList', users);
  });

  // Handle admin requests for location history
  socket.on('getUserHistory', (userId) => {
    const history = locationHistory.get(userId) || [];
    socket.emit('userLocationHistory', { userId, history });
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(`❌ Client disconnected: ${socket.id}, Reason: ${reason}`);
    
    // Remove user from active users
    if (activeUsers.has(socket.id)) {
      const userData = activeUsers.get(socket.id);
      activeUsers.delete(socket.id);
      
      // Notify admin dashboard about user going offline
      io.emit('userDisconnected', {
        socketId: socket.id,
        userId: userData.userId,
        userName: userData.userName,
        timestamp: Date.now()
      });
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`🚨 Socket error from ${socket.id}:`, error);
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${port}`);
  console.log(`📊 Admin Dashboard: http://0.0.0.0:${port}/admin`);
  console.log(`🔗 Socket.IO server is ready`);
  console.log(`🌍 API endpoints available at http://0.0.0.0:${port}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});