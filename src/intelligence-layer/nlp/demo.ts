/**
 * Demo script to showcase the NLP Engine capabilities
 */

import { NLPEngine } from './nlp-engine.js';

async function demonstrateNLPEngine() {
  console.log('🤖 AgentOS NLP Engine Demo\n');
  
  const engine = new NLPEngine({
    confidenceThreshold: 0.6,
    enableElderlyOptimizations: true
  });

  const testInputs = [
    'call mom',
    'text john hello there',
    'remind me to take medicine at 3pm',
    'what is the weather today',
    'help me emergency',
    'um call uh my doctor please', // Elderly speech pattern
    'CALL MOM', // Mixed case
    'nonsense input xyz' // Should fail
  ];

  for (const input of testInputs) {
    console.log(`\n📝 Input: "${input}"`);
    
    try {
      const result = await engine.processInput(input);
      
      if (result.success && result.result) {
        console.log(`✅ Intent: ${result.result.intent.name} (${result.result.intent.id})`);
        console.log(`🎯 Confidence: ${(result.result.confidence * 100).toFixed(1)}%`);
        console.log(`🌐 Language: ${result.language}`);
        console.log(`⏱️  Processing time: ${result.processingTime}ms`);
        
        if (result.result.entities.length > 0) {
          console.log(`📊 Entities found: ${result.result.entities.length}`);
          result.result.entities.forEach(entity => {
            console.log(`   - ${entity.type}: "${entity.value}" (${(entity.confidence * 100).toFixed(1)}%)`);
          });
        }
        
        if (Object.keys(result.result.parameters).length > 0) {
          console.log(`🔧 Parameters:`, result.result.parameters);
        }
      } else if (result.needsClarification) {
        console.log(`❓ Needs clarification - multiple intents detected`);
        console.log(`📋 Options: ${result.clarificationOptions?.length || 0}`);
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`💥 Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Show metrics
  console.log('\n📈 Engine Metrics:');
  const metrics = engine.getMetrics();
  console.log(`   Intent Classifier Accuracy: ${(metrics.intentClassifier.accuracy * 100).toFixed(1)}%`);
  console.log(`   Supported Languages: ${engine.getSupportedLanguages().join(', ')}`);
  
  console.log('\n🎉 Demo completed!');
}

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateNLPEngine().catch(console.error);
}

export { demonstrateNLPEngine };