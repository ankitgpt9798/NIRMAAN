import { z } from 'zod';
import { text } from './common.js';

const categoryFields = {
  nameEn: text(80, 'English name'),
  nameHi: text(80, 'Hindi name'),
  descriptionEn: text(500, 'English description'),
  descriptionHi: text(500, 'Hindi description'),
  isActive: z.boolean({ error: 'Active must be true or false' }),
  sortOrder: z.number({ error: 'Display order must be a number' }).int('Display order must be a whole number').min(0).max(9999),
  showDeliveryNote: z.boolean({ error: 'Delivery note must be true or false' }),
};

const needsAName = (data) => Boolean(data.nameEn?.trim() || data.nameHi?.trim());
const nameIssue = { message: 'Category name is required in English or Hindi', path: ['nameEn'] };

export const createCategorySchema = z
  .object({
    ...categoryFields,
    nameEn: categoryFields.nameEn.default(''),
    nameHi: categoryFields.nameHi.default(''),
    descriptionEn: categoryFields.descriptionEn.default(''),
    descriptionHi: categoryFields.descriptionHi.default(''),
    isActive: categoryFields.isActive.default(true),
    sortOrder: categoryFields.sortOrder.default(0),
    showDeliveryNote: categoryFields.showDeliveryNote.default(false),
  })
  .strict()
  .refine(needsAName, nameIssue);

// Partial update: only the fields sent are changed. The combined result is
// re-checked by the model (e.g. at least one name must remain).
export const updateCategorySchema = z
  .object(categoryFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'Nothing to update');
