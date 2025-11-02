import React from 'react';

export interface ChecklistItem {
  id: string;
  text: string;
  checkedByAI: boolean;
  checkedByHuman: boolean;
  keywords: string;
}

export interface ChecklistGroup {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export interface QuestionItem {
  id: string;
  text: string;
  asked: boolean;
}

export interface QuestionGroup {
  id: string;
  title: string;
  items: QuestionItem[];
}

export type InterviewStatus = 'idle' | 'configuring' | 'recording' | 'processing' | 'stopped' | 'error' | 'paused' | 'countdown';

export interface GenAIBlob {
  data: string;
  mimeType: string;
}

export interface FirstCycleCode {
  quote: string;
  code: string;
  type: 'Descritivo' | 'Processo' | 'In Vivo';
}
