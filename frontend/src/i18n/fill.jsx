import { Fragment } from 'react';

/**
 * Places React elements (links, bold words) inside a translated sentence, so each
 * language can put them where its grammar needs them:
 *   fillTemplate(t('admin.prices.intro'), { save: <strong>Save</strong> })
 */
export function fillTemplate(text, parts) {
  return text.split(/(\{\w+\})/).map((piece, index) => {
    const name = piece.match(/^\{(\w+)\}$/)?.[1];
    return <Fragment key={index}>{name && name in parts ? parts[name] : piece}</Fragment>;
  });
}
