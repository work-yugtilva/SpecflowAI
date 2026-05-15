// Context types
export interface ContextData {
  companyName: string;
  companyType: string;
  productName: string;
  productDescription: string;
  targetUsers: string;
  goals: string;
  constraints: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ContextScope = 'global' | 'session';

export interface ContextBundle {
  global: ContextData | null;
  session: ContextData | null;
  merged: ContextData;
}

// Research types
export type ResearchType = 'Interview' | 'Survey' | 'Analytics' | 'Market Insight';

export interface AnalyticsFields {
  metricName?: string;
  metricValue?: number;
  metricBaseline?: number;
  metricUnit?: string;
  timePeriod?: string;
  dataSource?: string;
}

export interface ResearchEntry extends AnalyticsFields {
  id?: string;
  type: ResearchType;
  title: string;
  content: string;
  summary?: string;
  user?: string;
  pain?: string;
  context?: string;
  tags?: string[];
  scope?: ContextScope;
  sessionId?: string | null;
  session_id?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface AnalyticsEntry extends Omit<ResearchEntry, keyof AnalyticsFields | 'type'> {
  type: 'Analytics';
  metricName: string;
  metricValue?: number;
  metricBaseline?: number;
  metricUnit?: string;
  timePeriod?: string;
  dataSource?: string;
}

// Source ingestion types
export type SourceFileType = 'txt' | 'pdf' | 'docx' | 'csv';
export type SourceStatus = 'uploaded' | 'processing' | 'processed' | 'failed';
export type SourceEvidenceType =
  | 'quote'
  | 'pain_point'
  | 'theme'
  | 'metric'
  | 'observation';

export interface SourceFile {
  id: string;
  userId: string;
  scope: ContextScope;
  scopeKey: string;
  sessionId?: string | null;
  filename: string;
  mimeType?: string | null;
  fileType: SourceFileType;
  fileSizeBytes: number;
  status: SourceStatus;
  parsedText?: string | null;
  summary?: string | null;
  errorMessage?: string | null;
  evidenceCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SourceEvidence {
  id: string;
  sourceFileId: string;
  userId: string;
  scope: ContextScope;
  scopeKey: string;
  sessionId?: string | null;
  evidenceType: SourceEvidenceType;
  title: string;
  content: string;
  customerLabel?: string | null;
  theme?: string | null;
  painPoint?: string | null;
  productArea?: string | null;
  sentiment?: string | null;
  confidence?: number | null;
  rowReference?: string | null;
  metadata: Record<string, unknown>;
  createdAt?: string;
}

export interface PipelineSourceEvidence {
  id: string;
  source_id: string;
  source_title: string;
  type: SourceEvidenceType;
  title: string;
  content: string;
  theme?: string | null;
  pain_point?: string | null;
  product_area?: string | null;
  sentiment?: string | null;
  confidence?: number | null;
  metadata: Record<string, unknown>;
}

export interface SourceUploadResponse {
  source: SourceFile;
  evidenceCount: number;
}

// Problem types
export interface Problem {
  id?: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in-progress' | 'resolved';
  createdAt?: string;
  updatedAt?: string;
}

// Feature types
export interface Feature {
  id?: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'idea' | 'planned' | 'building' | 'shipped';
  createdAt?: string;
  updatedAt?: string;
}

// Task types
export interface Task {
  id?: string;
  title: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in-progress' | 'done';
  createdAt?: string;
  updatedAt?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
