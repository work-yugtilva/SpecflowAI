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

export interface ResearchEntry {
  id?: string;
  type: ResearchType;
  title: string;
  content: string;
  user?: string;
  pain?: string;
  context?: string;
  tags?: string[];
  scope?: ContextScope;
  sessionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
