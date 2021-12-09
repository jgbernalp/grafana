import { functionRendererLeft } from '../../prometheus/querybuilder/shared/operationUtils';
import {
  QueryBuilderOperation,
  QueryBuilderOperationDef,
  QueryBuilderOperationParamDef,
  VisualQueryModeller,
} from '../../prometheus/querybuilder/shared/types';
import { LokiVisualQuery, LokiVisualQueryOperationCategory } from './types';

export function getOperationDefintions(): QueryBuilderOperationDef[] {
  const list: QueryBuilderOperationDef[] = [
    {
      id: 'rate',
      displayName: 'Rate',
      params: [getRangeVectorParamDef()],
      defaultParams: ['auto'],
      category: LokiVisualQueryOperationCategory.Functions,
      renderer: operationWithRangeVectorRenderer,
      addOperationHandler: addLokiOperation,
    },
    {
      id: 'sum',
      displayName: 'Sum',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Functions,
      renderer: functionRendererLeft,
      addOperationHandler: addLokiOperation,
    },
    {
      id: 'json',
      displayName: 'Json',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: pipelineRenderer,
      addOperationHandler: addLokiOperation,
    },
    {
      id: 'logfmt',
      displayName: 'Logfmt',
      params: [],
      defaultParams: [],
      category: LokiVisualQueryOperationCategory.Formats,
      renderer: pipelineRenderer,
      addOperationHandler: addLokiOperation,
    },
    {
      id: '__line_contains',
      displayName: 'Line contains',
      params: [{ type: 'string', name: 'String' }],
      defaultParams: [''],
      category: LokiVisualQueryOperationCategory.LineFilters,
      renderer: getLineFilterRenderer('|='),
      addOperationHandler: addLokiOperation,
    },
    {
      id: '__line_contains_not',
      displayName: 'Line does not contain',
      params: [{ type: 'string', name: 'String' }],
      defaultParams: [''],
      category: LokiVisualQueryOperationCategory.LineFilters,
      renderer: getLineFilterRenderer('!='),
      addOperationHandler: addLokiOperation,
    },
  ];

  return list;
}

function getRangeVectorParamDef(): QueryBuilderOperationParamDef {
  return {
    name: 'Range vector',
    type: 'string',
    options: ['auto', '$__interval', '$__range', '1m', '5m', '10m', '1h', '24h'],
  };
}

function operationWithRangeVectorRenderer(
  model: QueryBuilderOperation,
  def: QueryBuilderOperationDef,
  innerExpr: string
) {
  let rangeVector = (model.params ?? [])[0] ?? 'auto';

  if (rangeVector === 'auto') {
    rangeVector = '$__interval';
  }

  return `${def.id}(${innerExpr} [${rangeVector}])`;
}

function getLineFilterRenderer(operation: string) {
  return function lineFilterRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
    return `${innerExpr} ${operation} "${model.params[0]}"`;
  };
}

function pipelineRenderer(model: QueryBuilderOperation, def: QueryBuilderOperationDef, innerExpr: string) {
  return `${innerExpr} | ${model.id}`;
}

function isRangeVectorFunction(def: QueryBuilderOperationDef) {
  return def.renderer === operationWithRangeVectorRenderer;
}

function getIndexOfOrLast(
  operations: QueryBuilderOperation[],
  queryModeller: VisualQueryModeller,
  condition: (def: QueryBuilderOperationDef) => boolean
) {
  const index = operations.findIndex((x) => {
    return condition(queryModeller.getOperationDef(x.id));
  });

  return index === -1 ? operations.length : index;
}

export function addLokiOperation(
  def: QueryBuilderOperationDef,
  query: LokiVisualQuery,
  modeller: VisualQueryModeller
): LokiVisualQuery {
  const newOperation: QueryBuilderOperation = {
    id: def.id,
    params: def.defaultParams,
  };

  const operations = [...query.operations];

  switch (def.category) {
    case LokiVisualQueryOperationCategory.Functions:
      const rangeVectorFunction = operations.find((x) => {
        return isRangeVectorFunction(modeller.getOperationDef(x.id));
      });

      // If we are adding a function that does not take a range vector and none exists add one
      if (!rangeVectorFunction && !isRangeVectorFunction(def)) {
        const placeToInsert = getIndexOfOrLast(
          operations,
          modeller,
          (def) => def.category === LokiVisualQueryOperationCategory.Functions
        );
        operations.splice(placeToInsert, 0, { id: 'rate', params: ['auto'] });
      }

      operations.push(newOperation);
      break;
    case LokiVisualQueryOperationCategory.LineFilters:
    case LokiVisualQueryOperationCategory.Formats:
      const placeToInsert = getIndexOfOrLast(operations, modeller, (x) => {
        return x.category !== LokiVisualQueryOperationCategory.LineFilters;
      });
      operations.splice(placeToInsert, 0, newOperation);
  }

  return {
    ...query,
    operations,
  };
}
