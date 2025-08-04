const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3000;

// ✅ Allow CORS from only your frontend (React Vite)
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));

// ✅ Parse incoming JSON
app.use(express.json());

// 🩺 Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "server is running" });
});

// ✅ Validate raw location
app.post("/current-location", (req, res) => {
  const { longitude, latitude } = req.body;

  if (longitude === undefined || latitude === undefined) {
    return res.status(400).json({ status: "error", message: "Longitude and Latitude are required" });
  }

  if (typeof longitude !== "number" || typeof latitude !== "number") {
    return res.status(400).json({ status: "error", message: "Longitude and Latitude must be numbers" });
  }

  res.status(200).json({
    status: "success",
    message: "Location received successfully",
    data: { longitude, latitude }
  });
});

// ✅ Reverse geocoding using Nominatim
app.post('/location', async (req, res) => {
  const { latitude, longitude } = req.body;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ status: 'error', message: 'Invalid coordinates' });
  }

  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        format: 'json',
        lat: latitude,
        lon: longitude
      },
      headers: {
        'User-Agent': 'MyExpressApp/1.0 (ankitbourasi0@gmail.com)' // Required
      }
    });

    const address = response.data.display_name || 'Address not found';

    res.status(200).json({
      status: 'success',
      coordinates: { latitude, longitude },
      address
    });
  } catch (err) {
    console.error('Reverse geocoding failed:', err.message);
    res.status(500).json({ status: 'error', message: 'Failed to fetch address' });
  }
});

// 🚀 Start the server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
