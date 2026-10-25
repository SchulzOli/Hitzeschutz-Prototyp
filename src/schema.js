import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export function erstelleValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  return ajv.compile(schema);
}
