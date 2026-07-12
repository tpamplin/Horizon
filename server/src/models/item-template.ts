// =============================================================================
// Horizon — Signature Item Templates Model
// =============================================================================

import db from './db.js';
import type { SignatureItemTemplate, UpdateSignatureItemRequest } from 'shared';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface TemplateRow {
  id: string;
  name: string;
  description: string;
  modifiers: string | null;
  rules: string | null;
  category: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateTemplateParams {
  id: string;
  name: string;
  description: string;
  modifiers?: string;
  rules?: string;
  category?: string;
  createdBy: string;
}

// -----------------------------------------------------------------------------
// Prepared Statements
// -----------------------------------------------------------------------------

const stmtCreate = db.prepare(`
  INSERT INTO signature_item_templates (id, name, description, modifiers, rules, category, created_by, created_at)
  VALUES (@id, @name, @description, @modifiers, @rules, @category, @createdBy, datetime('now'))
`);

const stmtFindById = db.prepare(`
  SELECT id, name, description, modifiers, rules, category, created_by, created_at
  FROM signature_item_templates WHERE id = ?
`);

const stmtFindAll = db.prepare(`
  SELECT id, name, description, modifiers, rules, category, created_by, created_at
  FROM signature_item_templates ORDER BY category, name
`);

const stmtFindByCategory = db.prepare(`
  SELECT id, name, description, modifiers, rules, category, created_by, created_at
  FROM signature_item_templates WHERE category = ? ORDER BY name
`);

const stmtUpdate = db.prepare(`
  UPDATE signature_item_templates
  SET name = @name, description = @description, modifiers = @modifiers,
      rules = @rules, category = @category
  WHERE id = @id
`);

const stmtDelete = db.prepare(`DELETE FROM signature_item_templates WHERE id = ?`);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function toTemplate(row: TemplateRow): SignatureItemTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    modifiers: row.modifiers ?? undefined,
    rules: row.rules ?? undefined,
    category: row.category ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export function createTemplate(params: CreateTemplateParams): SignatureItemTemplate {
  stmtCreate.run({
    id: params.id,
    name: params.name,
    description: params.description,
    modifiers: params.modifiers ?? null,
    rules: params.rules ?? null,
    category: params.category ?? null,
    createdBy: params.createdBy,
  });
  const row = stmtFindById.get(params.id) as TemplateRow;
  return toTemplate(row);
}

export function findTemplateById(id: string): SignatureItemTemplate | null {
  const row = stmtFindById.get(id) as TemplateRow | undefined;
  return row ? toTemplate(row) : null;
}

export function findAllTemplates(category?: string): SignatureItemTemplate[] {
  const rows = category
    ? (stmtFindByCategory.all(category) as TemplateRow[])
    : (stmtFindAll.all() as TemplateRow[]);
  return rows.map(toTemplate);
}

export function updateTemplate(
  id: string,
  params: UpdateSignatureItemRequest,
): SignatureItemTemplate | null {
  const existing = stmtFindById.get(id) as TemplateRow | undefined;
  if (!existing) return null;

  stmtUpdate.run({
    id,
    name: params.name ?? existing.name,
    description: params.description ?? existing.description,
    modifiers: params.modifiers !== undefined ? params.modifiers : existing.modifiers,
    rules: params.rules !== undefined ? params.rules : existing.rules,
    category: params.category !== undefined ? params.category : existing.category,
  });

  const row = stmtFindById.get(id) as TemplateRow;
  return toTemplate(row);
}

export function deleteTemplate(id: string): boolean {
  const result = stmtDelete.run(id);
  return result.changes > 0;
}
