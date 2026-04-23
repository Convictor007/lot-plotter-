/**
 * iAssess - Type Definitions
 * Property Transaction System for Philippine LGU Assessors
 */

// User Types
/** Backend `users` row (no password) as JSON from login, register, and GET/PATCH /api/users/me */
export type { PublicUserJson } from '@/database/models';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  barangay?: string;
  municipality: string;
  province: string;
  idType?: 'passport' | 'drivers_license' | 'national_id' | 'phicard';
  idNumber?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
}

// Property Types
export interface Property {
  id: string;
  ownerId: string;
  propertyIndexNumber?: string;
  taxDeclarationNumber?: string;
  titleNumber?: string;
  lotNumber?: string;
  blockNumber?: string;
  barangay: string;
  municipality: string;
  province: string;
  classification: PropertyClassification;
  subClassification?: string;
  areaSquareMeters: number;
  fairMarketValue: number;
  assessedValue: number;
  boundaries?: LotBoundary;
  improvements?: Improvement[];
  status: 'active' | 'pending' | 'under_review' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export type PropertyClassification =
  | 'residential'
  | 'agricultural'
  | 'commercial'
  | 'industrial'
  | 'mineral'
  | 'timberland'
  | 'special';

export interface LotBoundary {
  tiePoint?: string;
  monument?: string;
  points: BoundaryPoint[];
  computedArea: number;
  closureError?: number;
}

export interface BoundaryPoint {
  id: string;
  bearing: string;
  distance: number;
  latitude?: number;
  longitude?: number;
  isTiePoint: boolean;
}

export interface Improvement {
  id: string;
  type: 'building' | 'machinery' | 'other';
  description: string;
  constructionType?: string;
  floorArea?: number;
  yearBuilt?: number;
  replacementCost?: number;
  fairMarketValue: number;
  assessedValue: number;
}

// Transaction Request Types
export interface TransactionRequest {
  id: string;
  userId: string;
  propertyId?: string;
  type: TransactionType;
  status: RequestStatus;
  documents: Document[];
  notes?: string;
  assessorNotes?: string;
  estimatedTax?: TaxComputation;
  paymentDetails?: PaymentDetails;
  submittedAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type TransactionType =
  // assessmobile-style types currently used by the app
  | 'new_house'
  | 'new_machinery'
  | 'new_land'
  | 'appraisal_land_first_time'
  | 'transfer'
  | 'transfer_with_title'
  | 'transfer_denr_handog'
  | 'consolidation'
  | 'segregation'
  | 'reassessment'
  | 'cancellation'
  | 'correction'
  | 'untagging'
  | 'undeclared'
  | 'exemption'
  // certification types used by the app
  | 'tax_declaration'
  | 'no_improvement'
  | 'land_holdings'
  | 'tax_mapping'
  | 'old_td_traceback'
  | 'others_cert'
  // legacy/alternate types (kept for compatibility)
  | 'new_tax_declaration_land'
  | 'new_tax_declaration_building'
  | 'new_tax_declaration_machinery'
  | 'ownership_transfer'
  | 'subdivision'
  | 'reclassification'
  | 'certified_true_copy'
  | 'tax_clearance'
  | 'no_improvement_certificate'
  | 'sketch_plan'
  | 'vicinity_map'
  | 'annotation_mortgage'
  | 'annotation_levy'
  | 'protest_assessment'
  | 'exemption_application';

export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'pending_documents'
  | 'approved'
  | 'rejected'
  | 'ready_for_payment'
  | 'completed'
  | 'cancelled';

export interface Document {
  id: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  verified: boolean;
}

export type DocumentType =
  | 'deed_sale'
  | 'deed_donation'
  | 'extrajudicial_settlement'
  | 'title_transfer_certificate'
  | 'bir_ecar'
  | 'tax_clearance'
  | 'tax_receipts'
  | 'valid_id'
  | 'spa'
  | 'building_permit'
  | 'certificate_occupancy'
  | 'survey_plan'
  | 'sworn_statement_market_value'
  | 'photos'
  | 'other';

// Tax Computation Types
export interface TaxComputation {
  fairMarketValue: number;
  assessmentLevel: number;
  assessedValue: number;
  basicTaxRate: number;
  basicTaxAmount: number;
  sefRate: number;
  sefAmount: number;
  idleLandTax?: number;
  totalTaxDue: number;
  discount?: number;
  netTaxDue: number;
}

export interface AssessmentLevel {
  classification: PropertyClassification;
  landRate: number;
  buildingRates: BuildingAssessmentBracket[];
  machineryRate: number;
}

export interface BuildingAssessmentBracket {
  minValue: number;
  maxValue: number | null;
  rate: number;
}

export interface PaymentDetails {
  amount: number;
  method: 'gcash' | 'maya' | 'bank_transfer' | 'cash';
  referenceNumber?: string;
  paidAt?: string;
  status: 'pending' | 'completed' | 'failed';
}

// GIS Types
export interface GISPlot {
  id: string;
  propertyId: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  polygon: GeoJSONPolygon;
  area: number;
  perimeter: number;
  extractedFromTitle: boolean;
  titleFileName?: string;
  createdAt: string;
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface ParsedTitleData {
  titleNumber?: string;
  lotNumber?: string;
  blockNumber?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  area?: number;
  boundaries?: BoundaryPoint[];
  ownerName?: string;
  extractedText: string;
  confidence: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

// Schedule of Market Values
export interface ScheduleOfMarketValues {
  id: string;
  municipality: string;
  province: string;
  effectiveYear: number;
  baseValues: BaseLandValue[];
  buildingValues: BuildingBaseValue[];
  machineryValues: MachineryBaseValue[];
}

export interface BaseLandValue {
  classification: PropertyClassification;
  barangay?: string;
  baseValuePerSqm: number;
  adjustments?: ValueAdjustment[];
}

export interface BuildingBaseValue {
  constructionType: string;
  baseValuePerSqm: number;
  depreciationRate?: number;
}

export interface MachineryBaseValue {
  machineryType: string;
  baseValue: number;
}

export interface ValueAdjustment {
  factor: string;
  adjustmentPercentage: number;
}
