/**
 * Caregiver Integration System
 * Advanced caregiver support system for elderly users with remote monitoring and assistance
 */

import { EventEmitter } from 'events';
import { systemLogger } from '../core/logging';
import { errorHandler } from '../core/errors';

export interface CaregiverProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  relationship: 'family' | 'professional' | 'friend';
  accessLevel: 'basic' | 'standard' | 'full';
  notificationPreferences: NotificationPreferences;
  emergencyContact: boolean;
  activeHours: TimeRange[];
  languages: string[];
  specializations?: string[]; // e.g., 'dementia', 'mobility', 'medication'
}

export interface ElderlyUser {
  id: string;
  name: string;
  age: number;
  medicalConditions: string[];
  medications: Medication[];
  emergencyContacts: EmergencyContact[];
  caregivers: string[]; // Caregiver IDs
  locationTracking: boolean;
  fallDetection: boolean;
  dailyRoutine: Routine[];
  cognitiveAssistance: boolean;
  communicationPreferences: CommunicationPreferences;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string; // e.g., 'twice daily', 'every 8 hours'
  times: string[]; // e.g., ['08:00', '20:00']
  instructions: string;
  remindersEnabled: boolean;
  caregiverAlerts: boolean;
  photo?: string; // Photo of medication
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  priority: number; // 1 = highest priority
}

export interface Routine {
  id: string;
  name: string;
  type: 'meal' | 'exercise' | 'medication' | 'social' | 'hygiene' | 'sleep';
  schedule: Schedule;
  reminders: boolean;
  caregiverMonitoring: boolean;
  assistanceNeeded: boolean;
}

export interface Schedule {
  frequency: 'daily' | 'weekly' | 'custom';
  times: string[];
  daysOfWeek?: number[]; // 0-6, Sunday = 0
  customDates?: string[]; // ISO date strings
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  phone: boolean;
  quietHours: TimeRange;
  emergencyOnly: boolean;
  dailyReports: boolean;
  weeklySummaries: boolean;
}

export interface TimeRange {
  start: string; // HH:MM format
  end: string;   // HH:MM format
}

export interface CommunicationPreferences {
  voiceCalls: boolean;
  videoCalls: boolean;
  textMessages: boolean;
  emergencyAlerts: boolean;
  familyUpdates: boolean;
  caregiverReports: boolean;
}

export interface CareEvent {
  id: string;
  type: 'routine' | 'medication' | 'emergency' | 'fall' | 'location' | 'vital_signs';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: string;
  caregiverId?: string;
  timestamp: Date;
  location?: Location;
  description: string;
  actions: CareAction[];
  resolved: boolean;
  resolution?: string;
}

export interface CareAction {
  id: string;
  type: 'notification' | 'call' | 'alert' | 'reminder' | 'assistance';
  caregiverId: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed';
  response?: string;
  duration?: number; // in minutes
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
  address?: string;
}

export interface VitalSigns {
  heartRate: number;
  bloodPressure: {
    systolic: number;
    diastolic: number;
  };
  temperature: number;
  oxygenSaturation: number;
  timestamp: Date;
}

export interface DailyReport {
  date: string;
  userId: string;
  routinesCompleted: number;
  routinesTotal: number;
  medicationsTaken: number;
  medicationsTotal: number;
  alertsTriggered: number;
  caregiverInteractions: number;
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  notes: string[];
  recommendations: string[];
}

export class CaregiverIntegration extends EventEmitter {
  private caregivers: Map<string, CaregiverProfile> = new Map();
  private elderlyUsers: Map<string, ElderlyUser> = new Map();
  private activeCareEvents: Map<string, CareEvent> = new Map();
  private logger = systemLogger('caregiver-integration');

  constructor() {
    super();
    this.initializeDefaultSettings();
    this.startRoutineMonitoring();
    this.startEmergencyMonitoring();
  }

  /**
   * Register a caregiver
   */
  async registerCaregiver(profile: Omit<CaregiverProfile, 'id'>): Promise<string> {
    const id = `caregiver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const caregiver: CaregiverProfile = {
      id,
      ...profile
    };

    this.caregivers.set(id, caregiver);

    this.logger.info('Caregiver registered', {
      id,
      name: caregiver.name,
      relationship: caregiver.relationship,
      accessLevel: caregiver.accessLevel
    });

    this.emit('caregiverRegistered', caregiver);

    return id;
  }

  /**
   * Register an elderly user
   */
  async registerElderlyUser(profile: Omit<ElderlyUser, 'id' | 'caregivers'>): Promise<string> {
    const id = `elderly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const user: ElderlyUser = {
      id,
      caregivers: [],
      ...profile
    };

    this.elderlyUsers.set(id, user);

    this.logger.info('Elderly user registered', {
      id,
      name: user.name,
      age: user.age,
      conditions: user.medicalConditions.length
    });

    this.emit('elderlyUserRegistered', user);

    return id;
  }

  /**
   * Link caregiver to elderly user
   */
  async linkCaregiverToUser(caregiverId: string, userId: string): Promise<boolean> {
    const caregiver = this.caregivers.get(caregiverId);
    const user = this.elderlyUsers.get(userId);

    if (!caregiver || !user) {
      throw new Error('Caregiver or user not found');
    }

    if (!user.caregivers.includes(caregiverId)) {
      user.caregivers.push(caregiverId);
    }

    this.logger.info('Caregiver linked to user', {
      caregiverId,
      caregiverName: caregiver.name,
      userId,
      userName: user.name
    });

    this.emit('caregiverLinked', { caregiverId, userId });

    return true;
  }

  /**
   * Add medication for elderly user
   */
  async addMedication(userId: string, medication: Omit<Medication, 'id'>): Promise<string> {
    const user = this.elderlyUsers.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const id = `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const med: Medication = {
      id,
      ...medication
    };

    user.medications.push(med);

    this.logger.info('Medication added', {
      userId,
      userName: user.name,
      medication: med.name,
      frequency: med.frequency
    });

    this.emit('medicationAdded', { userId, medication: med });

    return id;
  }

  /**
   * Add routine for elderly user
   */
  async addRoutine(userId: string, routine: Omit<Routine, 'id'>): Promise<string> {
    const user = this.elderlyUsers.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const id = `routine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const routineWithId: Routine = {
      id,
      ...routine
    };

    user.dailyRoutine.push(routineWithId);

    this.logger.info('Routine added', {
      userId,
      userName: user.name,
      routine: routineWithId.name,
      type: routineWithId.type
    });

    this.emit('routineAdded', { userId, routine: routineWithId });

    return id;
  }

  /**
   * Trigger emergency event
   */
  async triggerEmergency(
    userId: string,
    type: 'fall' | 'medical' | 'location' | 'vitals' | 'other',
    description: string,
    location?: Location
  ): Promise<string> {
    const user = this.elderlyUsers.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const eventId = `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const careEvent: CareEvent = {
      id: eventId,
      type: 'emergency',
      severity: 'critical',
      userId,
      timestamp: new Date(),
      location,
      description: `${type.toUpperCase()}: ${description}`,
      actions: [],
      resolved: false
    };

    // Notify all caregivers
    for (const caregiverId of user.caregivers) {
      await this.notifyCaregiver(caregiverId, careEvent, 'emergency');
    }

    // Notify emergency contacts
    for (const contact of user.emergencyContacts) {
      await this.notifyEmergencyContact(contact, careEvent);
    }

    this.activeCareEvents.set(eventId, careEvent);

    this.logger.error('Emergency triggered', {
      eventId,
      userId,
      userName: user.name,
      type,
      description,
      caregiversNotified: user.caregivers.length,
      emergencyContacts: user.emergencyContacts.length
    });

    this.emit('emergencyTriggered', careEvent);

    return eventId;
  }

  /**
   * Record medication taken
   */
  async recordMedicationTaken(userId: string, medicationId: string, taken: boolean, notes?: string): Promise<void> {
    const user = this.elderlyUsers.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const medication = user.medications.find(m => m.id === medicationId);
    if (!medication) {
      throw new Error('Medication not found');
    }

    const event: CareEvent = {
      id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'medication',
      severity: taken ? 'low' : 'medium',
      userId,
      timestamp: new Date(),
      description: `${taken ? 'Took' : 'Missed'} medication: ${medication.name}`,
      actions: [],
      resolved: true,
      resolution: notes
    };

    if (!taken && medication.caregiverAlerts) {
      // Notify caregivers about missed medication
      for (const caregiverId of user.caregivers) {
        await this.notifyCaregiver(caregiverId, event, 'alert');
      }
    }

    this.logger.info('Medication recorded', {
      userId,
      userName: user.name,
      medication: medication.name,
      taken,
      caregiverAlerts: medication.caregiverAlerts
    });

    this.emit('medicationRecorded', { userId, medicationId, taken, notes });
  }

  /**
   * Generate daily report
   */
  async generateDailyReport(userId: string, date: string = new Date().toISOString().split('T')[0]): Promise<DailyReport> {
    const user = this.elderlyUsers.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Calculate completion rates (simplified - in real implementation would query actual data)
    const routinesCompleted = Math.floor(user.dailyRoutine.length * 0.8); // 80% completion
    const medicationsTaken = Math.floor(user.medications.length * 0.9); // 90% taken

    const report: DailyReport = {
      date,
      userId,
      routinesCompleted,
      routinesTotal: user.dailyRoutine.length,
      medicationsTaken,
      medicationsTotal: user.medications.length,
      alertsTriggered: 2, // Mock data
      caregiverInteractions: 3, // Mock data
      overallHealth: this.assessOverallHealth(user),
      notes: [
        'User completed morning routine successfully',
        'All morning medications taken on time',
        'Light exercise routine completed'
      ],
      recommendations: [
        'Continue current medication schedule',
        'Consider adding social activity in afternoon',
        'Monitor blood pressure as discussed'
      ]
    };

    // Send report to caregivers
    for (const caregiverId of user.caregivers) {
      const caregiver = this.caregivers.get(caregiverId);
      if (caregiver?.notificationPreferences.dailyReports) {
        await this.sendDailyReport(caregiver, report);
      }
    }

    this.logger.info('Daily report generated', {
      userId,
      userName: user.name,
      date,
      routinesCompleted: report.routinesCompleted,
      medicationsTaken: report.medicationsTaken
    });

    this.emit('dailyReportGenerated', report);

    return report;
  }

  /**
   * Get caregiver dashboard data
   */
  async getCaregiverDashboard(caregiverId: string): Promise<any> {
    const caregiver = this.caregivers.get(caregiverId);
    if (!caregiver) {
      throw new Error('Caregiver not found');
    }

    const users = Array.from(this.elderlyUsers.values())
      .filter(user => user.caregivers.includes(caregiverId));

    const activeAlerts = Array.from(this.activeCareEvents.values())
      .filter(event => users.some(user => user.id === event.userId) && !event.resolved);

    const dashboard = {
      caregiver: {
        id: caregiver.id,
        name: caregiver.name,
        relationship: caregiver.relationship,
        accessLevel: caregiver.accessLevel
      },
      elderlyUsers: users.map(user => ({
        id: user.id,
        name: user.name,
        age: user.age,
        conditions: user.medicalConditions,
        lastActivity: new Date(), // Would be actual last activity
        healthStatus: this.assessOverallHealth(user),
        pendingMedications: user.medications.filter(m => true), // Would check schedule
        upcomingRoutines: user.dailyRoutine.slice(0, 3)
      })),
      activeAlerts,
      todaysStats: {
        routinesCompleted: 8,
        medicationsTaken: 6,
        alertsResponded: 2,
        emergencyCalls: 0
      },
      recentActivity: [] // Would contain recent care events
    };

    return dashboard;
  }

  /**
   * Start routine monitoring
   */
  private startRoutineMonitoring(): void {
    setInterval(async () => {
      try {
        await this.checkRoutines();
      } catch (error) {
        this.logger.error('Routine monitoring failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 60000); // Check every minute

    this.logger.debug('Routine monitoring started');
  }

  /**
   * Start emergency monitoring
   */
  private startEmergencyMonitoring(): void {
    // Monitor for falls, location changes, vital signs
    setInterval(async () => {
      try {
        await this.checkEmergencies();
      } catch (error) {
        this.logger.error('Emergency monitoring failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, 30000); // Check every 30 seconds

    this.logger.debug('Emergency monitoring started');
  }

  /**
   * Check routines and send reminders
   */
  private async checkRoutines(): Promise<void> {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    for (const user of this.elderlyUsers.values()) {
      for (const routine of user.dailyRoutine) {
        if (this.shouldTriggerRoutine(routine, currentTime)) {
          await this.triggerRoutine(user, routine);
        }
      }

      // Check medications
      for (const medication of user.medications) {
        if (this.shouldRemindMedication(medication, currentTime)) {
          await this.remindMedication(user, medication);
        }
      }
    }
  }

  /**
   * Check for emergencies
   */
  private async checkEmergencies(): Promise<void> {
    // Simulate emergency detection (in real implementation would monitor sensors)
    if (Math.random() < 0.001) { // 0.1% chance per check
      const users = Array.from(this.elderlyUsers.values());
      const randomUser = users[Math.floor(Math.random() * users.length)];

      if (randomUser.fallDetection) {
        await this.triggerEmergency(
          randomUser.id,
          'fall',
          'Potential fall detected by motion sensors',
          { latitude: 40.7128, longitude: -74.0060, accuracy: 10, timestamp: new Date() }
        );
      }
    }
  }

  /**
   * Notify caregiver
   */
  private async notifyCaregiver(
    caregiverId: string,
    event: CareEvent,
    notificationType: 'alert' | 'reminder' | 'emergency'
  ): Promise<void> {
    const caregiver = this.caregivers.get(caregiverId);
    if (!caregiver) return;

    const user = this.elderlyUsers.get(event.userId);
    if (!user) return;

    // Create action record
    const action: CareAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: notificationType === 'emergency' ? 'alert' : 'notification',
      caregiverId,
      timestamp: new Date(),
      status: 'sent'
    };

    event.actions.push(action);

    // Send notification based on preferences
    const prefs = caregiver.notificationPreferences;

    if (notificationType === 'emergency' || !prefs.emergencyOnly) {
      if (prefs.push) {
        await this.sendPushNotification(caregiver, event);
      }
      if (prefs.sms) {
        await this.sendSMS(caregiver, event);
      }
      if (prefs.phone && notificationType === 'emergency') {
        await this.makePhoneCall(caregiver, event);
      }
    }

    this.logger.info('Caregiver notified', {
      caregiverId,
      caregiverName: caregiver.name,
      eventType: event.type,
      notificationType,
      methods: this.getNotificationMethods(prefs)
    });
  }

  /**
   * Notify emergency contact
   */
  private async notifyEmergencyContact(contact: EmergencyContact, event: CareEvent): Promise<void> {
    // Send emergency notification
    await this.sendSMS({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      notificationPreferences: { sms: true, push: false, email: false, phone: false, quietHours: { start: '00:00', end: '23:59' }, emergencyOnly: false, dailyReports: false, weeklySummaries: false }
    } as CaregiverProfile, event);

    this.logger.warn('Emergency contact notified', {
      contactId: contact.id,
      contactName: contact.name,
      eventType: event.type,
      priority: contact.priority
    });
  }

  /**
   * Utility methods
   */
  private initializeDefaultSettings(): void {
    // Could load from configuration
    this.logger.debug('Default settings initialized');
  }

  private shouldTriggerRoutine(routine: Routine, currentTime: string): boolean {
    // Simplified check - in real implementation would consider schedule
    return routine.schedule.times.includes(currentTime) && routine.reminders;
  }

  private async triggerRoutine(user: ElderlyUser, routine: Routine): Promise<void> {
    const event: CareEvent = {
      id: `routine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'routine',
      severity: 'low',
      userId: user.id,
      timestamp: new Date(),
      description: `Time for ${routine.name} (${routine.type})`,
      actions: [],
      resolved: false
    };

    // Notify caregivers if monitoring enabled
    if (routine.caregiverMonitoring) {
      for (const caregiverId of user.caregivers) {
        await this.notifyCaregiver(caregiverId, event, 'reminder');
      }
    }

    this.logger.info('Routine triggered', {
      userId: user.id,
      userName: user.name,
      routine: routine.name,
      type: routine.type
    });

    this.emit('routineTriggered', { userId: user.id, routine });
  }

  private shouldRemindMedication(medication: Medication, currentTime: string): boolean {
    return medication.times.includes(currentTime) && medication.remindersEnabled;
  }

  private async remindMedication(user: ElderlyUser, medication: Medication): Promise<void> {
    // Voice reminder through AgentOS
    this.logger.info('Medication reminder sent', {
      userId: user.id,
      userName: user.name,
      medication: medication.name,
      dosage: medication.dosage
    });

    // Notify caregivers if enabled
    if (medication.caregiverAlerts) {
      const event: CareEvent = {
        id: `med_reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'medication',
        severity: 'low',
        userId: user.id,
        timestamp: new Date(),
        description: `Medication reminder: ${medication.name} (${medication.dosage})`,
        actions: [],
        resolved: false
      };

      for (const caregiverId of user.caregivers) {
        await this.notifyCaregiver(caregiverId, event, 'reminder');
      }
    }

    this.emit('medicationReminder', { userId: user.id, medication });
  }

  private assessOverallHealth(user: ElderlyUser): 'excellent' | 'good' | 'fair' | 'poor' | 'critical' {
    // Simplified health assessment based on conditions and recent activity
    if (user.medicalConditions.length === 0) return 'excellent';
    if (user.medicalConditions.length <= 2) return 'good';
    if (user.medicalConditions.length <= 4) return 'fair';
    return 'poor';
  }

  private async sendPushNotification(caregiver: CaregiverProfile, event: CareEvent): Promise<void> {
    // Mock push notification
    this.logger.debug('Push notification sent', {
      caregiverId: caregiver.id,
      eventType: event.type,
      severity: event.severity
    });
  }

  private async sendSMS(caregiver: CaregiverProfile, event: CareEvent): Promise<void> {
    // Mock SMS sending
    this.logger.debug('SMS sent', {
      caregiverId: caregiver.id,
      phone: caregiver.phone,
      eventType: event.type
    });
  }

  private async makePhoneCall(caregiver: CaregiverProfile, event: CareEvent): Promise<void> {
    // Mock phone call
    this.logger.warn('Emergency phone call initiated', {
      caregiverId: caregiver.id,
      phone: caregiver.phone,
      eventType: event.type
    });
  }

  private async sendDailyReport(caregiver: CaregiverProfile, report: DailyReport): Promise<void> {
    // Mock daily report sending
    this.logger.debug('Daily report sent', {
      caregiverId: caregiver.id,
      userId: report.userId,
      date: report.date
    });
  }

  private getNotificationMethods(prefs: NotificationPreferences): string[] {
    const methods = [];
    if (prefs.push) methods.push('push');
    if (prefs.sms) methods.push('sms');
    if (prefs.email) methods.push('email');
    if (prefs.phone) methods.push('phone');
    return methods;
  }

  /**
   * Public API methods
   */
  getCaregivers(): CaregiverProfile[] {
    return Array.from(this.caregivers.values());
  }

  getElderlyUsers(): ElderlyUser[] {
    return Array.from(this.elderlyUsers.values());
  }

  getActiveCareEvents(): CareEvent[] {
    return Array.from(this.activeCareEvents.values());
  }

  resolveCareEvent(eventId: string, resolution: string): boolean {
    const event = this.activeCareEvents.get(eventId);
    if (event) {
      event.resolved = true;
      event.resolution = resolution;
      this.logger.info('Care event resolved', { eventId, resolution });
      this.emit('careEventResolved', event);
      return true;
    }
    return false;
  }

  getUserMedications(userId: string): Medication[] {
    const user = this.elderlyUsers.get(userId);
    return user ? user.medications : [];
  }

  getUserRoutines(userId: string): Routine[] {
    const user = this.elderlyUsers.get(userId);
    return user ? user.dailyRoutine : [];
  }

  updateCaregiverPreferences(caregiverId: string, preferences: Partial<NotificationPreferences>): boolean {
    const caregiver = this.caregivers.get(caregiverId);
    if (caregiver) {
      caregiver.notificationPreferences = { ...caregiver.notificationPreferences, ...preferences };
      this.logger.info('Caregiver preferences updated', { caregiverId, preferences });
      return true;
    }
    return false;
  }
}
