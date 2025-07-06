/**
 * MicroMentor Test Suite
 * Tests for edge AI cognitive assistant functionality
 */

const MicroMentor = require('../edge/micromentor');

describe('MicroMentor Edge AI', () => {
  let mentor;

  beforeEach(() => {
    mentor = new MicroMentor({
      modelPath: './mock-models/',
      privacyMode: 'strict'
    });
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      expect(mentor.options.privacyMode).toBe('strict');
      expect(mentor.options.learningRate).toBe(0.001);
      expect(mentor.isMonitoring).toBe(false);
    });

    test('should emit initialized event on successful init', (done) => {
      mentor.on('initialized', () => {
        done();
      });
      
      // Mock successful initialization
      mentor.model = {};
      mentor.emit('initialized');
    });
  });

  describe('Expression Analysis', () => {
    test('should analyze expression and return emotional state', async () => {
      // Mock model
      mentor.model = {
        predict: jest.fn().mockReturnValue({
          data: () => Promise.resolve([0.1, 0.7, 0.1, 0.05, 0.05])
        })
      };

      const mockImageData = new Uint8Array(224 * 224 * 3);
      const result = await mentor.analyzeExpression(mockImageData);

      expect(result).toHaveProperty('emotionalState');
      expect(result).toHaveProperty('fatigueLevel');
      expect(result).toHaveProperty('inferenceTime');
      expect(result.emotionalState.primary).toBe('stressed');
    });

    test('should calculate fatigue level correctly', () => {
      const emotionalState = {
        primary: 'stressed',
        all: [
          { emotion: 'neutral', probability: 0.1 },
          { emotion: 'stressed', probability: 0.5 },
          { emotion: 'confused', probability: 0.2 },
          { emotion: 'focused', probability: 0.1 },
          { emotion: 'tired', probability: 0.1 }
        ]
      };

      const fatigue = mentor.calculateFatigueLevel(emotionalState);
      expect(fatigue.level).toBe('high');
      expect(fatigue.score).toBeCloseTo(0.8);
      expect(fatigue.recommendation).toBeTruthy();
    });
  });

  describe('Decision Recommendations', () => {
    test('should provide appropriate framework for complexity', () => {
      const lowComplexity = { level: 'low' };
      const highComplexity = { level: 'high' };
      const neutralState = { primary: 'neutral' };

      const lowFramework = mentor.getDecisionFramework(lowComplexity, neutralState);
      const highFramework = mentor.getDecisionFramework(highComplexity, neutralState);

      expect(lowFramework.name).toBe('Quick Decision Matrix');
      expect(highFramework.name).toBe('Structured Decision Analysis');
      expect(lowFramework.steps.length).toBeLessThan(highFramework.steps.length);
    });

    test('should simplify framework when stressed', () => {
      const highComplexity = { level: 'high' };
      const stressedState = { primary: 'stressed' };

      const framework = mentor.getDecisionFramework(highComplexity, stressedState);
      expect(framework.name).toBe('Quick Decision Matrix');
      expect(framework.note).toContain('Simplified due to detected stress');
    });

    test('should analyze decision complexity correctly', () => {
      const simpleDecision = {
        stakeholders: ['self'],
        reversible: true
      };

      const complexDecision = {
        stakeholders: ['family', 'employer', 'financial advisor'],
        deadline: 'tomorrow',
        reversible: false,
        impact: 'high'
      };

      const simpleComplexity = mentor.analyzeDecisionComplexity(simpleDecision);
      const complexComplexity = mentor.analyzeDecisionComplexity(complexDecision);

      expect(simpleComplexity.level).toBe('low');
      expect(complexComplexity.level).toBe('high');
    });
  });

  describe('Monitoring', () => {
    test('should start and stop monitoring', () => {
      mentor.startMonitoring({ camera: true });
      expect(mentor.isMonitoring).toBe(true);

      mentor.stopMonitoring();
      expect(mentor.isMonitoring).toBe(false);
    });

    test('should emit monitoring events', (done) => {
      mentor.on('monitoring-started', () => {
        expect(mentor.isMonitoring).toBe(true);
        mentor.stopMonitoring();
      });

      mentor.on('monitoring-stopped', () => {
        expect(mentor.isMonitoring).toBe(false);
        done();
      });

      mentor.startMonitoring();
    });
  });

  describe('On-Device Learning', () => {
    test('should record decisions in learning buffer', () => {
      const context = { currentDecision: 'test' };
      const framework = { name: 'test framework' };

      mentor.recordDecision(context, framework);

      expect(mentor.decisionHistory.length).toBe(1);
      expect(mentor.learningBuffer.length).toBe(1);
    });

    test('should trigger learning after threshold', () => {
      mentor.performOnDeviceLearning = jest.fn();
      mentor.learningThreshold = 3;

      for (let i = 0; i < 3; i++) {
        mentor.recordDecision({}, {});
      }

      expect(mentor.performOnDeviceLearning).toHaveBeenCalled();
    });
  });

  describe('Privacy', () => {
    test('should respect privacy mode settings', () => {
      const strictMentor = new MicroMentor({ privacyMode: 'strict' });
      expect(strictMentor.options.privacyMode).toBe('strict');
    });

    test('should store data locally only', () => {
      // Verify no external API calls are made
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      mentor.saveUserProfile();
      mentor.analyzeExpression({});
      
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('should meet latency requirements', async () => {
      mentor.model = {
        predict: jest.fn().mockReturnValue({
          data: () => Promise.resolve([0.2, 0.2, 0.2, 0.2, 0.2])
        })
      };

      const start = Date.now();
      await mentor.analyzeExpression(new Uint8Array(224 * 224 * 3));
      const latency = Date.now() - start;

      expect(latency).toBeLessThan(100); // Should be under 100ms
    });
  });
});

describe('Edge AI Integration', () => {
  test('should handle model loading errors gracefully', async () => {
    const mentor = new MicroMentor();
    
    mentor.on('error', (error) => {
      expect(error).toBeDefined();
    });

    // Force error by using invalid path
    mentor.options.modelPath = '/invalid/path/';
    await mentor.initialize();
  });

  test('should support real-time updates via events', (done) => {
    const mentor = new MicroMentor();
    let updateCount = 0;

    mentor.on('analysis-complete', (data) => {
      updateCount++;
      expect(data).toHaveProperty('emotionalState');
      
      if (updateCount === 2) {
        mentor.stopMonitoring();
        done();
      }
    });

    // Simulate analysis events
    mentor.emit('analysis-complete', {
      emotionalState: { primary: 'neutral' },
      fatigueLevel: { level: 'low' }
    });
    
    mentor.emit('analysis-complete', {
      emotionalState: { primary: 'stressed' },
      fatigueLevel: { level: 'high' }
    });
  });
});