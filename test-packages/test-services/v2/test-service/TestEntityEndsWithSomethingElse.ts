/*
 * Copyright (c) 2022 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
import {
  Entity,
  DefaultDeSerializers,
  DeSerializers,
  DeserializedType
} from '@sap-cloud-sdk/odata-v2';

/**
 * This class represents the entity "A_TestEntityEndsWithSomethingElse" of service "API_TEST_SRV".
 */
export class TestEntityEndsWithSomethingElse<
    T extends DeSerializers = DefaultDeSerializers
  >
  extends Entity
  implements TestEntityEndsWithSomethingElseType<T>
{
  /**
   * Technical entity name for TestEntityEndsWithSomethingElse.
   */
  static _entityName = 'A_TestEntityEndsWithSomethingElse';
  /**
   * Default url path for the according service.
   */
  static _defaultServicePath = '/sap/opu/odata/sap/API_TEST_SRV';
  /**
   * All key fields of the TestEntityEndsWithSomethingElse entity
   */
  static _keys = ['KeyProperty'];
  /**
   * Key Property.
   */
  keyProperty!: DeserializedType<T, 'Edm.String'>;
}

export interface TestEntityEndsWithSomethingElseType<
  T extends DeSerializers = DefaultDeSerializers
> {
  keyProperty: DeserializedType<T, 'Edm.String'>;
}
