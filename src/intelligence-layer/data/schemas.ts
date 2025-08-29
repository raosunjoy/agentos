/**
 * Standardized entity definitions for common data types
 */

import { EntitySchema, PrivacyAnnotation } from './types';

// Privacy levels for different data types
const PUBLIC_PRIVACY: PrivacyAnnotation = {
  level: 'public',
  encryption: false,
  auditRequired: false,
  consentRequired: false
};

const PRIVATE_PRIVACY: PrivacyAnnotation = {
  level: 'private',
  encryption: true,
  auditRequired: true,
  consentRequired: true,
  retention: 365
};

const SENSITIVE_PRIVACY: PrivacyAnnotation = {
  level: 'sensitive',
  encryption: true,
  auditRequired: true,
  consentRequired: true,
  retention: 90
};

const RESTRICTED_PRIVACY: PrivacyAnnotation = {
  level: 'restricted',
  encryption: true,
  auditRequired: true,
  consentRequired: true,
  retention: 30
};

export const CONTACT_SCHEMA: EntitySchema = {
  id: 'contact',
  name: 'Contact',
  version: '1.0.0',
  description: 'Personal contact information',
  fields: [
    {
      name: 'firstName',
      type: 'string',
      required: true,
      privacy: PRIVATE_PRIVACY,
      validation: { pattern: '^[a-zA-Z\\s]+$' }
    },
    {
      name: 'lastName',
      type: 'string',
      required: true,
      privacy: PRIVATE_PRIVACY,
      validation: { pattern: '^[a-zA-Z\\s]+$' }
    },
    {
      name: 'email',
      type: 'string',
      privacy: PRIVATE_PRIVACY,
      validation: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' }
    },
    {
      name: 'phone',
      type: 'string',
      privacy: SENSITIVE_PRIVACY,
      validation: { pattern: '^\\+?[1-9]\\d{1,14}$' }
    },
    {
      name: 'address',
      type: 'object',
      privacy: SENSITIVE_PRIVACY
    },
    {
      name: 'emergencyContact',
      type: 'boolean',
      privacy: RESTRICTED_PRIVACY
    }
  ],
  relationships: [
    {
      type: 'one-to-many',
      targetEntity: 'event',
      field: 'contactId'
    }
  ],
  privacy: PRIVATE_PRIVACY,
  created: new Date(),
  updated: new Date()
};

export const EVENT_SCHEMA: EntitySchema = {
  id: 'event',
  name: 'Event',
  version: '1.0.0',
  description: 'Calendar events and appointments',
  fields: [
    {
      name: 'title',
      type: 'string',
      required: true,
      privacy: PRIVATE_PRIVACY
    },
    {
      name: 'description',
      type: 'string',
      privacy: PRIVATE_PRIVACY
    },
    {
      name: 'startTime',
      type: 'date',
      required: true,
      privacy: PRIVATE_PRIVACY
    },
    {
      name: 'endTime',
      type: 'date',
      required: true,
      privacy: PRIVATE_PRIVACY
    },
    {
      name: 'location',
      type: 'object',
      privacy: SENSITIVE_PRIVACY
    },
    {
      name: 'attendees',
      type: 'array',
      privacy: PRIVATE_PRIVACY,
      relationships: [{
        type: 'many-to-many',
        targetEntity: 'contact',
        field: 'contactId'
      }]
    },
    {
      name: 'isHealthRelated',
      type: 'boolean',
      privacy: RESTRICTED_PRIVACY
    }
  ],
  relationships: [
    {
      type: 'many-to-one',
      targetEntity: 'contact',
      field: 'organizerId'
    }
  ],
  privacy: PRIVATE_PRIVACY,
  created: new Date(),
  updated: new Date()
};

export const LOCATION_SCHEMA: EntitySchema = {
  id: 'location',
  name: 'Location',
  version: '1.0.0',
  description: 'Geographic location data',
  fields: [
    {
      name: 'latitude',
      type: 'number',
      required: true,
      privacy: SENSITIVE_PRIVACY,
      validation: { min: -90, max: 90 }
    },
    {
      name: 'longitude',
      type: 'number',
      required: true,
      privacy: SENSITIVE_PRIVACY,
      validation: { min: -180, max: 180 }
    },
    {
      name: 'address',
      type: 'string',
      privacy: SENSITIVE_PRIVACY
    },
    {
      name: 'name',
      type: 'string',
      privacy: PRIVATE_PRIVACY
    },
    {
      name: 'accuracy',
      type: 'number',
      privacy: PUBLIC_PRIVACY
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      privacy: SENSITIVE_PRIVACY
    }
  ],
  relationships: [],
  privacy: SENSITIVE_PRIVACY,
  created: new Date(),
  updated: new Date()
};

export const HEALTH_DATA_SCHEMA: EntitySchema = {
  id: 'health_data',
  name: 'Health Data',
  version: '1.0.0',
  description: 'Health and medical information',
  fields: [
    {
      name: 'type',
      type: 'string',
      required: true,
      privacy: RESTRICTED_PRIVACY,
      validation: { enum: ['medication', 'appointment', 'vital_signs', 'symptom', 'diagnosis'] }
    },
    {
      name: 'value',
      type: 'string',
      required: true,
      privacy: RESTRICTED_PRIVACY
    },
    {
      name: 'unit',
      type: 'string',
      privacy: RESTRICTED_PRIVACY
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      privacy: RESTRICTED_PRIVACY
    },
    {
      name: 'source',
      type: 'string',
      privacy: RESTRICTED_PRIVACY
    },
    {
      name: 'notes',
      type: 'string',
      privacy: RESTRICTED_PRIVACY
    }
  ],
  relationships: [
    {
      type: 'many-to-one',
      targetEntity: 'contact',
      field: 'providerId'
    }
  ],
  privacy: RESTRICTED_PRIVACY,
  created: new Date(),
  updated: new Date()
};

export const USER_PREFERENCE_SCHEMA: EntitySchema = {
  id: 'user_preference',
  name: 'User Preference',
  version: '1.0.0',
  description: 'User preferences and settings',
  fields: [
    {
      name: 'category',
      type: 'string',
      required: true,
      privacy: PRIVATE_PRIVACY,
      validation: { enum: ['voice', 'accessibility', 'privacy', 'notification', 'display'] }
    },
    {
      name: 'key',
      type: 'string',
      required: true,
      privacy: PRIVATE_PRIVACY
    },
    {
      name: 'value',
      type: 'string',
      required: true,
      privacy: PRIVATE_PRIVACY
    },
    {
      name: 'dataType',
      type: 'string',
      required: true,
      privacy: PUBLIC_PRIVACY,
      validation: { enum: ['string', 'number', 'boolean', 'object'] }
    }
  ],
  relationships: [],
  privacy: PRIVATE_PRIVACY,
  created: new Date(),
  updated: new Date()
};

// Registry of all standard schemas
export const STANDARD_SCHEMAS = {
  contact: CONTACT_SCHEMA,
  event: EVENT_SCHEMA,
  location: LOCATION_SCHEMA,
  health_data: HEALTH_DATA_SCHEMA,
  user_preference: USER_PREFERENCE_SCHEMA
} as const;

export type StandardSchemaType = keyof typeof STANDARD_SCHEMAS;