import jsonata from 'jsonata';
import type { ExpressionEvaluator } from './toXState';

export const createJsonataEvaluator = (): ExpressionEvaluator => {
  return (expression, data) => {
    return jsonata(expression).evaluate(data);
  };
};
