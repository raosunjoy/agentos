/**
 * RGPx (Recursive Gradient Physics) Types and Interfaces
 * 
 * RGPx provides theoretical grounding for agent coherence and entropy management.
 * This module implements Phase 1: Basic Coherence Metrics tracking.
 */

/**
 * Φ-Invariant: Measures coherence plateau stability
 * Φ = Ṡ / (Q̇/T) where:
 * - Ṡ = entropy production rate (compute waste)
 * - Q̇ = flux rate (useful output)
 * - T = temperature/constraint factor (device resources)
 */
export interface PhiInvariant {
  /** Current Φ value */
  value: number;
  
  /** Rate of change: ∂Φ/∂t */
  rateOfChange: number;
  
  /** Target plateau value (Φ⋆) */
  targetPlateau: number;
  
  /** Timestamp of measurement */
  timestamp: number;
}

/**
 * Coherence metrics for workflow execution
 */
export interface CoherenceMetrics {
  /** Workflow execution success rate (0-1) */
  successRate: number;
  
  /** Average entropy (compute waste) per workflow */
  averageEntropy: number;
  
  /** Average flux (useful output) per workflow */
  averageFlux: number;
  
  /** Current coherence level (0-1, 1 = perfect coherence) */
  coherenceLevel: number;
  
  /** Number of workflows executed */
  workflowCount: number;
}

/**
 * RGPx flow equation parameters
 * dΦ/dt = ∇·(α ∇Φ) + β Φ (1 - Φ/Φ⋆) - γ Φ
 */
export interface RGPxParameters {
  /** α = NPU diffusion (device capability factor) */
  npuDiffusion: number;
  
  /** β = agent feedback (workflow success rate) */
  agentFeedback: number;
  
  /** γ = device constraints (battery, thermal) */
  deviceConstraints: number;
  
  /** Target plateau Φ⋆ */
  targetPlateau: number;
}

/**
 * Coherence plateau detection result
 */
export interface CoherencePlateau {
  /** Detected plateau state */
  isPlateau: boolean;
  
  /** Stability duration (ms) */
  stabilityDuration: number;
  
  /** Φ value at plateau */
  phiValue: number;
  
  /** Confidence in plateau detection (0-1) */
  confidence: number;
}

/**
 * Workflow entropy measurement
 */
export interface WorkflowEntropy {
  /** Workflow ID */
  workflowId: string;
  
  /** Compute waste (CPU cycles wasted) */
  computeWaste: number;
  
  /** Memory waste (bytes) */
  memoryWaste: number;
  
  /** Time waste (ms) */
  timeWaste: number;
  
  /** Total entropy value */
  totalEntropy: number;
}

/**
 * Workflow flux measurement (useful output)
 */
export interface WorkflowFlux {
  /** Workflow ID */
  workflowId: string;
  
  /** Successful steps executed */
  successfulSteps: number;
  
  /** User value created (subjective score 0-1) */
  userValue: number;
  
  /** Total flux value */
  totalFlux: number;
}

