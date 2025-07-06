/**
 * MicroMentor - Entry Point
 * Demonstrates the edge AI cognitive assistant
 */

const MicroMentor = require('./edge/micromentor');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

// Initialize Express app for demo interface
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize MicroMentor
const mentor = new MicroMentor({
  modelPath: path.join(__dirname, '../models/tfjs/'),
  privacyMode: 'strict',
  learningRate: 0.001
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'active',
    isMonitoring: mentor.isMonitoring,
    privacyMode: mentor.options.privacyMode,
    modelLoaded: mentor.model !== null
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { imageData } = req.body;
    const analysis = await mentor.analyzeExpression(imageData);
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recommend', async (req, res) => {
  try {
    const { context } = req.body;
    const recommendation = await mentor.getRecommendation(context);
    res.json(recommendation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/monitoring/start', (req, res) => {
  mentor.startMonitoring(req.body);
  res.json({ message: 'Monitoring started' });
});

app.post('/api/monitoring/stop', (req, res) => {
  mentor.stopMonitoring();
  res.json({ message: 'Monitoring stopped' });
});

// WebSocket for real-time updates
const server = app.listen(PORT, () => {
  console.log(`MicroMentor server running on port ${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  // Send real-time updates
  mentor.on('analysis-complete', (data) => {
    ws.send(JSON.stringify({
      type: 'analysis',
      data
    }));
  });

  mentor.on('intervention-needed', (data) => {
    ws.send(JSON.stringify({
      type: 'intervention',
      data
    }));
  });

  ws.on('message', (message) => {
    const msg = JSON.parse(message);
    
    switch (msg.type) {
      case 'start-monitoring':
        mentor.startMonitoring(msg.options);
        break;
      case 'stop-monitoring':
        mentor.stopMonitoring();
        break;
      case 'get-recommendation':
        mentor.getRecommendation(msg.context)
          .then(recommendation => {
            ws.send(JSON.stringify({
              type: 'recommendation',
              data: recommendation
            }));
          });
        break;
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Initialize MicroMentor on startup
mentor.initialize()
  .then(() => {
    console.log('MicroMentor initialized successfully');
  })
  .catch(error => {
    console.error('Failed to initialize MicroMentor:', error);
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mentor.stopMonitoring();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Demo mode - simulate some interactions
if (process.env.DEMO_MODE === 'true') {
  setTimeout(() => {
    console.log('\\n=== DEMO MODE ===');
    console.log('Simulating decision support scenario...');
    
    const demoContext = {
      currentDecision: {
        description: 'Should I accept the new job offer?',
        stakeholders: ['family', 'current employer'],
        deadline: '2 days',
        reversible: false,
        impact: 'high'
      },
      emotionalState: {
        primary: 'stressed',
        confidence: 0.75
      },
      history: []
    };
    
    mentor.getRecommendation(demoContext)
      .then(recommendation => {
        console.log('\\nRecommendation:', JSON.stringify(recommendation, null, 2));
      });
  }, 3000);
}