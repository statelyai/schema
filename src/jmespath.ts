import jmespath from 'jmespath';
import type { ExpressionEvaluator } from './toXState';

export const createJmespathEvaluator = (): ExpressionEvaluator => {
  return (expression, data) => {
    return jmespath.search(data, expression);
  };
};
