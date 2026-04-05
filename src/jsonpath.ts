import { JSONPath } from 'jsonpath-plus';
import type { ExpressionEvaluator } from './toXState';

export const createJsonpathEvaluator = (): ExpressionEvaluator => {
  return (expression, data) => {
    const result = JSONPath({ path: expression, json: data, wrap: false });
    return result;
  };
};
