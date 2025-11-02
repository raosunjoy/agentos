/**
 * RGPx Coherence Monitor - Phase 1 Implementation
 * 
 * Monitors agent coherence through entropy and flux tracking.
 * Implements basic Φ-invariant calculation and coherence plateau detection.
 */

import {
  PhiInvariant,
  CoherenceMetrics,
  RGPxParameters,
  CoherencePlateau,
  WorkflowEntropy,
  WorkflowFlux
} from './types';

export class CoherenceMonitor {
  private coherenceHistory: CoherenceMetrics[] = [];
  private entropyHistory: WorkflowEntropy[] = [];
  private fluxHistory: WorkflowFlux[] = [];
  private phiHistory: PhiInvariant[] = [];
  private currentMetrics: CoherenceMetrics;
  private rgpxParams: RGPxParameters;
  private plateauDetectionWindow: number = 5000; // 5 seconds
  private maxHistorySize: number = 1000;

  constructor(params?: Partial<RGPxParameters>) {
    // Default RGPx parameters (Phase 1: simplified)
    this.rgpxParams = {
      npuDiffusion: params?.npuDiffusion ?? 0.1, // Device capability factor
      agentFeedback: params?.agentFeedback ?? 0.8, // Success rate multiplier
      deviceConstraints: params?.deviceConstraints ?? 0.05, // Constraint factor
      targetPlateau: params?.targetPlateau ?? 0.85 // Target coherence level
    };

    this.currentMetrics = this.initializeMetrics();
  }

  /**
   * Initialize empty coherence metrics
   */
  private initializeMetrics(): CoherenceMetrics {
    return {
      successRate: 0,
      averageEntropy: 0,
      averageFlux: 0,
      coherenceLevel: 0,
      workflowCount: 0
    };
  }

  /**
   * Record workflow entropy (compute waste)
   */
  recordEntropy(entropy: WorkflowEntropy): void {
    this.entropyHistory.push(entropy);
    if (this.entropyHistory.length > this.maxHistorySize) {
      this.entropyHistory.shift();
    }

    this.updateMetrics();
  }

  /**
   * Record workflow flux (useful output)
   */
  recordFlux(flux: WorkflowFlux): void {
    this.fluxHistory.push(flux);
    if (this.fluxHistory.length > this.maxHistorySize) {
      this.fluxHistory.shift();
    }

    this.updateMetrics();
  }

  /**
   * Calculate Φ-invariant value
   * Φ = Ṡ / (Q̇/T)
   * Simplified for Phase 1: Φ ≈ entropy / (flux + ε)
   */
  calculatePhiInvariant(): PhiInvariant {
    const recentEntropy = this.getRecentAverage(this.entropyHistory, 100);
    const recentFlux = this.getRecentAverage(this.fluxHistory, 100);

    // Simplified calculation (Phase 1)
    // In Phase 2, we'll use full equation: dΦ/dt = ∇·(α ∇Φ) + β Φ (1 - Φ/Φ⋆) - γ Φ
    const epsilon = 0.001; // Avoid division by zero
    const entropyRate = recentEntropy.totalEntropy || epsilon;
    const fluxRate = recentFlux.totalFlux || epsilon;
    
    // Temperature/constraint factor (T) - simplified as device constraint
    const temperatureFactor = 1 + this.rgpxParams.deviceConstraints;
    
    const phiValue = entropyRate / (fluxRate / temperatureFactor + epsilon);
    
    // Calculate rate of change (simplified)
    const previousPhi = this.phiHistory[this.phiHistory.length - 1];
    const rateOfChange = previousPhi 
      ? (phiValue - previousPhi.value) / ((Date.now() - previousPhi.timestamp) / 1000)
      : 0;

    const phiInvariant: PhiInvariant = {
      value: phiValue,
      rateOfChange,
      targetPlateau: this.rgpxParams.targetPlateau,
      timestamp: Date.now()
    };

    this.phiHistory.push(phiInvariant);
    if (this.phiHistory.length > this.maxHistorySize) {
      this.phiHistory.shift();
    }

    return phiInvariant;
  }

  /**
   * Update coherence metrics from entropy and flux history
   */
  private updateMetrics(): void {
    if (this.entropyHistory.length === 0 || this.fluxHistory.length === 0) {
      return;
    }

    // Calculate success rate from flux history
    const successfulWorkflows = this.fluxHistory.filter(f => f.successfulSteps > 0).length;
    const successRate = successfulWorkflows / this.fluxHistory.length;

    // Calculate average entropy
    const totalEntropy = this.entropyHistory.reduce((sum, e) => sum + e.totalEntropy, 0);
    const averageEntropy = totalEntropy / this.entropyHistory.length;

    // Calculate average flux
    const totalFlux = this.fluxHistory.reduce((sum, f) => sum + f.totalFlux, 0);
    const averageFlux = totalFlux / this.fluxHistory.length;

    // Calculate coherence level (0-1)
    // Higher flux and lower entropy = higher coherence
    const coherenceLevel = Math.min(1, averageFlux / (averageEntropy + 1));

    this.currentMetrics = {
      successRate,
      averageEntropy,
      averageFlux,
      coherenceLevel,
      workflowCount: Math.max(this.entropyHistory.length, this.fluxHistory.length)
    };

    // Store in history
    this.coherenceHistory.push({ ...this.currentMetrics });
    if (this.coherenceHistory.length > this.maxHistorySize) {
      this.coherenceHistory.shift();
    }
  }

  /**
   * Detect coherence plateau (stable Φ-invariant)
   * Plateau: ∂Φ/∂t ≈ 0 for sustained period
   */
  detectPlateau(): CoherencePlateau {
    if (this.phiHistory.length < 10) {
      return {
        isPlateau: false,
        stabilityDuration: 0,
        phiValue: 0,
        confidence: 0
      };
    }

    const recentPhis = this.phiHistory.slice(-20); // Last 20 measurements
    const threshold = 0.01; // Rate of change threshold for plateau

    // Check if rate of change is near zero
    const stablePhis = recentPhis.filter(p => Math.abs(p.rateOfChange) < threshold);
    
    if (stablePhis.length < recentPhis.length * 0.8) {
      // Less than 80% stable = no plateau
      return {
        isPlateau: false,
        stabilityDuration: 0,
        phiValue: this.phiHistory[this.phiHistory.length - 1].value,
        confidence: 0
      };
    }

    // Calculate stability duration
    const now = Date.now();
    const firstStable = stablePhis[0]?.timestamp || now;
    const stabilityDuration = now - firstStable;

    // Confidence based on stability duration and consistency
    const avgPhi = stablePhis.reduce((sum, p) => sum + p.value, 0) / stablePhis.length;
    const variance = stablePhis.reduce((sum, p) => sum + Math.pow(p.value - avgPhi, 2), 0) / stablePhis.length;
    const confidence = Math.min(1, stabilityDuration / this.plateauDetectionWindow) * (1 - Math.min(1, variance));

    return {
      isPlateau: stabilityDuration >= this.plateauDetectionWindow,
      stabilityDuration,
      phiValue: avgPhi,
      confidence
    };
  }

  /**
   * Get current coherence metrics
   */
  getCurrentMetrics(): CoherenceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get Φ-invariant history
   */
  getPhiHistory(limit?: number): PhiInvariant[] {
    const history = [...this.phiHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get coherence history
   */
  getCoherenceHistory(limit?: number): CoherenceMetrics[] {
    const history = [...this.coherenceHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Update RGPx parameters (for dynamic adjustment)
   */
  updateParameters(params: Partial<RGPxParameters>): void {
    this.rgpxParams = { ...this.rgpxParams, ...params };
  }

  /**
   * Get recent average from history
   */
  private getRecentAverage<T extends { totalEntropy?: number; totalFlux?: number }>(
    history: T[],
    windowSize: number
  ): T {
    const recent = history.slice(-windowSize);
    
    if (recent.length === 0) {
      return { totalEntropy: 0, totalFlux: 0 } as T;
    }

    if ('totalEntropy' in recent[0]) {
      const avgEntropy = recent.reduce((sum, e) => sum + (e.totalEntropy || 0), 0) / recent.length;
      return { totalEntropy: avgEntropy } as T;
    }

    if ('totalFlux' in recent[0]) {
      const avgFlux = recent.reduce((sum, f) => sum + (f.totalFlux || 0), 0) / recent.length;
      return { totalFlux: avgFlux } as T;
    }

    // Return last item (guaranteed to exist due to length check above)
    return recent[recent.length - 1] as T;
  }

  /**
   * Reset monitor (for testing or fresh start)
   */
  reset(): void {
    this.coherenceHistory = [];
    this.entropyHistory = [];
    this.fluxHistory = [];
    this.phiHistory = [];
    this.currentMetrics = this.initializeMetrics();
  }
}

