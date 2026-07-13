import { randomUUID } from 'node:crypto';
import * as model from '../models/ability-template.js';
import type { AbilityTemplate, CreateAbilityRequest, UpdateAbilityRequest } from 'shared';

export class AbilityTemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Ability template "${id}" not found.`);
    this.name = 'AbilityTemplateNotFoundError';
  }
}
export class AbilityTemplateValidationError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'AbilityTemplateValidationError';
  }
}

export function createTemplate(userId: string, input: CreateAbilityRequest): AbilityTemplate {
  const name = input.name?.trim();
  if (!name) throw new AbilityTemplateValidationError('Ability name is required.');
  return model.createTemplate({
    id: randomUUID(),
    name,
    effect: input.effect?.trim() ?? '',
    category: input.category?.trim() || undefined,
    createdBy: userId,
  });
}
export function getTemplate(id: string): AbilityTemplate {
  const t = model.findTemplateById(id);
  if (!t) throw new AbilityTemplateNotFoundError(id);
  return t;
}
export function listTemplates(): AbilityTemplate[] {
  return model.findAllTemplates();
}
export function updateTemplate(id: string, input: UpdateAbilityRequest): AbilityTemplate {
  const t = model.updateTemplate(id, input);
  if (!t) throw new AbilityTemplateNotFoundError(id);
  return t;
}
export function deleteTemplate(id: string): void {
  if (!model.deleteTemplate(id)) throw new AbilityTemplateNotFoundError(id);
}
