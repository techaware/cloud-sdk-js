import { EdmTypeShared } from '@sap-cloud-sdk/odata-common/internal';
import { DeSerializers } from './de-serializers';

export function edmToTs(
  value: any,
  edmType: EdmTypeShared<'v2'>,
  deSerializers: DeSerializers
): any {
  return deSerializers[edmType].deserialize(value);
}

/**
 * @internal
 */
export function tsToEdm(
  value: any,
  edmType: EdmTypeShared<'v2'>,
  deSerializers: DeSerializers
): any {
  return deSerializers[edmType].serialize(value);
}
