import {
  createEntityClassNames,
  joinEntityMetadata,
  navigationPropertyBase,
  transformEntityBase
} from '../common';
import {
  VdmComplexType,
  VdmEntity,
  VdmEnumType,
  VdmNavigationProperty
} from '../../vdm-types';
import { ServiceNameFormatter } from '../../service-name-formatter';
import {
  EdmxEntitySet,
  EdmxEntityTypeV4,
  parseEntitySetsV4,
  parseEntityType
} from '../../edmx-parser/v4';
import { ServiceMetadata } from '../../edmx-parser';
import { isCollectionType } from '../edmx-to-vdm-util';

/**
 * @internal
 */
export function joinEntityTypes<T extends EdmxEntityTypeV4>(
  entityType: T,
  baseType: T
): T {
  // TODO: only join properties / nav properties of the respective type
  return {
    ...entityType,
    Key: {
      PropertyRef: [...entityType.Key.PropertyRef, ...baseType.Key.PropertyRef]
    },
    Property: [...entityType.Property, ...baseType.Property],
    NavigationProperty: [
      ...entityType.NavigationProperty,
      ...baseType.NavigationProperty
    ]
  };
}
/**
 * @internal
 */
export function generateEntitiesV4(
  serviceMetadata: ServiceMetadata,
  complexTypes: VdmComplexType[],
  enumTypes: VdmEnumType[],
  formatter: ServiceNameFormatter
): VdmEntity[] {
  const entitySets = parseEntitySetsV4(serviceMetadata.edmx.root);
  const entityTypes = parseEntityType(serviceMetadata.edmx.root);

  const entitiesMetadata = joinEntityMetadata(
    entitySets,
    entityTypes,
    serviceMetadata.swagger
  );
  const classNames = createEntityClassNames(entitiesMetadata, formatter);

  return entitiesMetadata.map(entityMetadata => ({
    ...transformEntityBase(
      entityMetadata,
      classNames,
      complexTypes,
      enumTypes,
      formatter
    ),
    navigationProperties: navigationProperties(
      entityMetadata.entityType,
      entityMetadata.entitySet,
      classNames,
      formatter
    )
  }));
}

function navigationProperties(
  entityType: EdmxEntityTypeV4,
  entitySet: EdmxEntitySet,
  classNames: { [originalName: string]: string },
  formatter: ServiceNameFormatter
): VdmNavigationProperty[] {
  return entitySet.NavigationPropertyBinding.filter(
    navBinding => !isDerivedNavBindingPath(navBinding.Path)
  ).map(navBinding => {
    const navProp = entityType.NavigationProperty.find(
      n => n.Name === navBinding.Path
    );

    if (!navProp) {
      throw new Error(
        `Could not find navigation property ${navBinding.Path} in entity type ${entityType.Name}.`
      );
    }

    const isCollection = isCollectionType(navProp.Type);

    return {
      ...navigationPropertyBase(navProp.Name, entitySet.Name, formatter),
      from: entityType.Name,
      to: navBinding.Target,
      toEntityClassName: classNames[navBinding.Target],
      isCollection
    };
  });
}

// TODO: This should be removed once derived types are considered.
function isDerivedNavBindingPath(path: string): boolean {
  return path.includes('/');
}
