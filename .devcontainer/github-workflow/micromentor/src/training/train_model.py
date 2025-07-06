"""
MicroMentor Model Training Script
Trains a lightweight model for edge deployment
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
import numpy as np
import json
import os

class MicroMentorTrainer:
    def __init__(self, config_path='config/training_config.json'):
        """Initialize the trainer with configuration"""
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        
        self.model = None
        self.history = None
    
    def create_model(self):
        """Create a lightweight model suitable for edge deployment"""
        # Using MobileNetV2 as base for efficiency
        base_model = tf.keras.applications.MobileNetV2(
            input_shape=(224, 224, 3),
            include_top=False,
            weights='imagenet'
        )
        
        # Freeze base model layers
        base_model.trainable = False
        
        # Add custom layers for emotion/fatigue detection
        inputs = keras.Input(shape=(224, 224, 3))
        x = tf.keras.applications.mobilenet_v2.preprocess_input(inputs)
        x = base_model(x, training=False)
        x = keras.layers.GlobalAveragePooling2D()(x)
        x = keras.layers.Dense(128, activation='relu')(x)
        x = keras.layers.Dropout(0.2)(x)
        
        # Multi-output for different aspects
        emotion_output = keras.layers.Dense(5, activation='softmax', name='emotion')(x)
        fatigue_output = keras.layers.Dense(1, activation='sigmoid', name='fatigue')(x)
        
        self.model = keras.Model(inputs, [emotion_output, fatigue_output])
        
        # Compile with appropriate losses
        self.model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss={
                'emotion': 'categorical_crossentropy',
                'fatigue': 'binary_crossentropy'
            },
            metrics={
                'emotion': ['accuracy'],
                'fatigue': ['accuracy']
            }
        )
        
        return self.model
    
    def prepare_data(self):
        """Prepare synthetic training data for demonstration"""
        # In production, this would load real facial expression data
        # For demo, creating synthetic data
        
        num_samples = 1000
        
        # Generate random image-like data
        X = np.random.rand(num_samples, 224, 224, 3).astype(np.float32)
        
        # Generate labels
        emotions = np.random.randint(0, 5, num_samples)
        y_emotion = tf.keras.utils.to_categorical(emotions, 5)
        
        y_fatigue = np.random.rand(num_samples, 1)
        
        # Split into train/val
        split_idx = int(0.8 * num_samples)
        
        X_train, X_val = X[:split_idx], X[split_idx:]
        y_emotion_train, y_emotion_val = y_emotion[:split_idx], y_emotion[split_idx:]
        y_fatigue_train, y_fatigue_val = y_fatigue[:split_idx], y_fatigue[split_idx:]
        
        return (X_train, {'emotion': y_emotion_train, 'fatigue': y_fatigue_train}), \
               (X_val, {'emotion': y_emotion_val, 'fatigue': y_fatigue_val})
    
    def train(self, epochs=10):
        """Train the model"""
        if self.model is None:
            self.create_model()
        
        # Prepare data
        train_data, val_data = self.prepare_data()
        
        # Callbacks for training
        callbacks = [
            keras.callbacks.EarlyStopping(
                monitor='val_loss',
                patience=3,
                restore_best_weights=True
            ),
            keras.callbacks.ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=2
            )
        ]
        
        # Train
        self.history = self.model.fit(
            train_data[0], train_data[1],
            validation_data=val_data,
            epochs=epochs,
            batch_size=32,
            callbacks=callbacks,
            verbose=1
        )
        
        return self.history
    
    def optimize_for_edge(self):
        """Optimize model for edge deployment"""
        # Quantization for smaller model size
        converter = tf.lite.TFLiteConverter.from_keras_model(self.model)
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        converter.target_spec.supported_types = [tf.float16]
        
        # Convert to TFLite
        tflite_model = converter.convert()
        
        # Save TFLite model
        tflite_path = os.path.join(self.config['output_path'], 'micromentor_edge.tflite')
        with open(tflite_path, 'wb') as f:
            f.write(tflite_model)
        
        # Calculate model size
        model_size_mb = len(tflite_model) / (1024 * 1024)
        print(f"Optimized model size: {model_size_mb:.2f} MB")
        
        return tflite_path
    
    def save_model(self):
        """Save the trained model"""
        # Save Keras model
        keras_path = os.path.join(self.config['output_path'], 'micromentor_model.h5')
        self.model.save(keras_path)
        
        # Save as TensorFlow.js model
        tfjs_path = os.path.join(self.config['output_path'], 'tfjs')
        tf.saved_model.save(self.model, tfjs_path)
        
        print(f"Model saved to {keras_path}")
        print(f"TensorFlow.js model saved to {tfjs_path}")
    
    def evaluate_latency(self):
        """Evaluate inference latency"""
        # Create random input
        test_input = np.random.rand(1, 224, 224, 3).astype(np.float32)
        
        # Warm up
        for _ in range(10):
            _ = self.model.predict(test_input, verbose=0)
        
        # Measure latency
        import time
        latencies = []
        
        for _ in range(100):
            start = time.time()
            _ = self.model.predict(test_input, verbose=0)
            latencies.append((time.time() - start) * 1000)  # Convert to ms
        
        avg_latency = np.mean(latencies)
        print(f"Average inference latency: {avg_latency:.2f} ms")
        
        return avg_latency

def main():
    # Create output directory
    os.makedirs('models/tfjs', exist_ok=True)
    
    # Configuration
    config = {
        'output_path': 'models',
        'epochs': 5,  # Reduced for demo
        'batch_size': 32
    }
    
    # Save config
    with open('config/training_config.json', 'w') as f:
        json.dump(config, f, indent=2)
    
    # Initialize trainer
    trainer = MicroMentorTrainer()
    
    print("Creating MicroMentor model...")
    trainer.create_model()
    
    print("\\nModel Summary:")
    trainer.model.summary()
    
    print("\\nTraining model...")
    trainer.train(epochs=config['epochs'])
    
    print("\\nOptimizing for edge deployment...")
    tflite_path = trainer.optimize_for_edge()
    
    print("\\nSaving models...")
    trainer.save_model()
    
    print("\\nEvaluating latency...")
    trainer.evaluate_latency()
    
    print("\\n✅ Training complete!")
    print(f"Models saved in {config['output_path']} directory")

if __name__ == "__main__":
    main()