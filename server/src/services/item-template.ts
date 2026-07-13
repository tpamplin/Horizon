// =============================================================================
// Horizon — Signature Item Template Service
// =============================================================================

import { randomUUID } from 'node:crypto';
import * as model from '../models/item-template.js';
import type {
  SignatureItemTemplate,
  CreateSignatureItemRequest,
  UpdateSignatureItemRequest,
} from 'shared';

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

export class ItemTemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Item template "${id}" not found.`);
    this.name = 'ItemTemplateNotFoundError';
  }
}

export class ItemTemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ItemTemplateValidationError';
  }
}

// -----------------------------------------------------------------------------
// Service Functions
// -----------------------------------------------------------------------------

export function createTemplate(
  userId: string,
  input: CreateSignatureItemRequest,
): SignatureItemTemplate {
  const name = input.name?.trim();
  if (!name || name.length < 1) {
    throw new ItemTemplateValidationError('Item name is required.');
  }

  return model.createTemplate({
    id: randomUUID(),
    name,
    description: input.description?.trim() ?? '',
    modifiers: input.modifiers?.trim() || undefined,
    rules: input.rules?.trim() || undefined,
    category: input.category?.trim() || undefined,
    createdBy: userId,
  });
}

export function getTemplate(id: string): SignatureItemTemplate {
  const tmpl = model.findTemplateById(id);
  if (!tmpl) throw new ItemTemplateNotFoundError(id);
  return tmpl;
}

export function listTemplates(category?: string): SignatureItemTemplate[] {
  return model.findAllTemplates(category);
}

export function updateTemplate(
  id: string,
  input: UpdateSignatureItemRequest,
): SignatureItemTemplate {
  const updated = model.updateTemplate(id, input);
  if (!updated) throw new ItemTemplateNotFoundError(id);
  return updated;
}

export function deleteTemplate(id: string): void {
  const deleted = model.deleteTemplate(id);
  if (!deleted) throw new ItemTemplateNotFoundError(id);
}
