import db from './db.js';
import type { AbilityTemplate, UpdateAbilityRequest } from 'shared';

export interface AbilityTemplateRow {
  id: string;
  name: string;
  effect: string;
  category: string | null;
  created_by: string;
  created_at: string;
}
export interface CreateAbilityTemplateParams {
  id: string;
  name: string;
  effect: string;
  category?: string;
  createdBy: string;
}

const stmtCreate = db.prepare(
  `INSERT INTO ability_templates (id, name, effect, category, created_by, created_at) VALUES (@id, @name, @effect, @category, @createdBy, datetime('now'))`,
);
const stmtFindById = db.prepare(
  `SELECT id, name, effect, category, created_by, created_at FROM ability_templates WHERE id = ?`,
);
const stmtFindAll = db.prepare(
  `SELECT id, name, effect, category, created_by, created_at FROM ability_templates ORDER BY category, name`,
);
const stmtUpdate = db.prepare(
  `UPDATE ability_templates SET name=@name, effect=@effect, category=@category WHERE id=@id`,
);
const stmtDelete = db.prepare(`DELETE FROM ability_templates WHERE id = ?`);

function toTemplate(row: AbilityTemplateRow): AbilityTemplate {
  return {
    id: row.id,
    name: row.name,
    effect: row.effect,
    category: row.category ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function createTemplate(params: CreateAbilityTemplateParams): AbilityTemplate {
  stmtCreate.run({
    id: params.id,
    name: params.name,
    effect: params.effect,
    category: params.category ?? null,
    createdBy: params.createdBy,
  });
  return toTemplate(stmtFindById.get(params.id) as AbilityTemplateRow);
}
export function findTemplateById(id: string): AbilityTemplate | null {
  const row = stmtFindById.get(id) as AbilityTemplateRow | undefined;
  return row ? toTemplate(row) : null;
}
export function findAllTemplates(): AbilityTemplate[] {
  return (stmtFindAll.all() as AbilityTemplateRow[]).map(toTemplate);
}
export function updateTemplate(id: string, params: UpdateAbilityRequest): AbilityTemplate | null {
  const existing = stmtFindById.get(id) as AbilityTemplateRow | undefined;
  if (!existing) return null;
  stmtUpdate.run({
    id,
    name: params.name ?? existing.name,
    effect: params.effect ?? existing.effect,
    category: params.category !== undefined ? params.category : existing.category,
  });
  return toTemplate(stmtFindById.get(id) as AbilityTemplateRow);
}
export function deleteTemplate(id: string): boolean {
  return stmtDelete.run(id).changes > 0;
}
