

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifcutilityresource/lexical/ifctable.htm
class ifcTable {
	constructor(name, rows, columns, index){
		this.entityName = 'IFCTABLE';
		this.index = index;
		this.name = name;
		this.rows = rows;
		this.columns = columns;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifcutilityresource/lexical/ifctablerow.htm
class ifcTableRow {
	constructor(rowcells, isheading, index){
		this.entityName = 'IFCTABLEROW';
		this.index = index;
		this.rowcells = rowcells;
		this.isheading = isheading;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifcutilityresource/lexical/ifctablecolumn.htm
class ifcTableColumn {
	constructor(identifier, name, description, unit, referencePath, index){
		this.entityName = 'IFCTABLECOLUMN';
		this.index = index;
		this.identifier = identifier;
		this.name = name;
		this.description = description;
		this.unit = unit;
		this.referencePath = referencePath;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifcconstraintresource/lexical/ifcconstraint.htm
class ifcConstraint {
	constructor(name, description, constraintGrade, constraintSource, creatingActor, creationTime, userDefinedGrade, index){
		this.entityName = 'IFCCONSTRAINT';
		this.index = index;
		this.name = name;
		this.description = description;
		this.constraintGrade = constraintGrade;
		this.constraintSource = constraintSource;
		this.creatingActor = creatingActor;
		this.creationTime = creationTime;
		this.userDefinedGrade = userDefinedGrade;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifcconstraintresource/lexical/ifcobjective.htm
class ifcObjective extends ifcConstraint {
	constructor(name, description, constraintGrade, constraintSource, creatingActor, creationTime, userDefinedGrade, benchmarkValues, logicalAggregator, objectiveQualifier, userDefinedQualifier, index){
		super(name, description, constraintGrade, constraintSource, creatingActor, creationTime, userDefinedGrade, index);
		this.entityName = 'IFCOBJECTIVE';
		this.benchmarkValues = benchmarkValues;
		this.logicalAggregator = logicalAggregator;
		this.objectiveQualifier = objectiveQualifier;
		this.userDefinedQualifier = userDefinedQualifier;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifcconstraintresource/lexical/ifcmetric.htm
class ifcMetric extends ifcConstraint {
	constructor(name, description, constraintGrade, constraintSource, creatingActor, creationTime, userDefinedGrade, benchmark, valueSource, dataValue, referencePath, index){
		super(name, description, constraintGrade, constraintSource, creatingActor, creationTime, userDefinedGrade, index);
		this.entityName = 'IFCMETRIC';
		this.benchmark = benchmark;
		this.valueSource = valueSource;
		this.dataValue = dataValue;
		this.referencePath = referencePath;
	}

	getBenchmark() {
		switch(this.benchmark) {
			case '.GREATERTHAN.':
				return '>';
				break;
			case '.GREATERTHANOREQUALTO.':
				return '>=';
				break;
			case '.LESSTHAN.':
				return '<';
				break;
			case '.LESSTHANOREQUALTO.':
				return '<=';
				break;
			case '.EQUALTO.':
				return '==';
				break;
			case '.NOTEQUALTO.':
				return '!=';
				break;
			case '.INCLUDES.':
				return 'IN';
				break;
			case '.NOTINCLUDES.':
				return 'NOT IN';
				break;
			case '.INCLUDEDIN.':
				return 'INCLUDEDIN';
				break;
			case '.NOTINCLUDEDIN.':
				return 'NOTINCLUDEDIN';
				break;
			default:
				return this.benchmark;
		}
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifckernel/lexical/ifcroot.htm
class ifcRoot {
	constructor(globalId, ownerHistory, name, description, index){
		this.entityName = 'IFCROOT';
		this.index = index;
		this.globalId = globalId;
		this.ownerHistory = ownerHistory;
		this.name = name;
		this.description = description;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifckernel/lexical/ifcrelassociates.htm
class ifcRelAssociates extends ifcRoot {
	constructor(globalId, ownerHistory, name, description, relatedObjects, index){
		super(globalId, ownerHistory, name, description, index);
		this.entityName = 'IFCRELASSOCIATES';
		this.relatedObjects = relatedObjects;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifccontrolextension/lexical/ifcrelassociatesconstraint.htm
class ifcRelAssociatesConstraint extends ifcRelAssociates {
	constructor(globalId, ownerHistory, name, description, relatedObjects, intent, relatingConstraint, index){
		super(globalId, ownerHistory, name, description, relatedObjects, index);
		this.entityName = 'IFCRELASSOCIATESCONSTRAINT';
		this.intent = intent;
		this.relatingConstraint = relatingConstraint;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifcconstraintresource/lexical/ifcreference.htm
class ifcReference {
	constructor(typeIdentifier, attributeIdentifier, instanceName, listPositions, innerReference, index){
		this.entityName = 'IFCREFERENCE';
		this.index = index;
		this.typeIdentifier = typeIdentifier;
		this.attributeIdentifier = attributeIdentifier;
		this.instanceName = instanceName;
		this.listPositions = listPositions;
		this.innerReference = innerReference;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifcmeasureresource/lexical/ifcmeasurewithunit.htm
class ifcMeasureWithUnit {
	constructor(valueComponent, unitComponent, index){
		this.entityName = 'IFCMEASUREWITHUNIT';
		this.index = index;
		this.valueComponent = valueComponent;
		this.unitComponent = unitComponent;
	}

	getValue() {
		//console.log(this.valueComponent);

		var localValueComponent = this.valueComponent.split('(');
		//var localValueComponent = this.valueComponent.split(new RegExp(/(^\(.+?\))|((?<=,)\(.+?\))/)).filter(x => x);
		//console.log(localValueComponent);

		if(localValueComponent.length==2) {
			localValueComponent[1].replace(')', '');
			
			switch(localValueComponent[0].toUpperCase()){
				case 'IFCINTEGER':
					return parseInt(localValueComponent[1]);
					break;
				case 'IFCREAL':
					return parseFloat(localValueComponent[1]);
					break;
				case 'IFCBOOLEAN':
					return localValueComponent[1];
					break;
				case 'IFCIDENTIFIER':
					return localValueComponent[1];
					break;
				case 'IFCTEXT':
					return localValueComponent[1];
					break;
				case 'IFCLABEL':
					return localValueComponent[1];
					break;
				case 'IFCLOGICAL':
					return localValueComponent[1];
					break;
				case 'IFCDATETIME':
					return localValueComponent[1];
					break;
				case 'IFCDATE':
					return localValueComponent[1];
					break;
				case 'IFCTIME':
					return localValueComponent[1];
					break;
				case 'IFCDURATION':
					return localValueComponent[1];
					break;
				case 'IFCTIMESTAMP':
					return localValueComponent[1];
					break;
				case 'IFCPOSITIVEINTEGER':
					return localValueComponent[1];
					break;
				case 'IFCBINARY':
					return localValueComponent[1];
					break;
				default:
					return localValueComponent[1];	
			}
		}

		return this.valueComponent;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifccostresource/lexical/ifcappliedvalue.htm
class ifcAppliedValue {
	constructor(name, description, appliedValue, unitBasis, applicableDate, fixedUntilDate, category, condition, arithmeticOperator, components, index){
		this.entityName = 'IFCAPPLIEDVALUE';
		this.index = index;
		this.name = name;
		this.description = description;
		this.appliedValue = appliedValue;
		this.unitBasis = unitBasis;
		this.applicableDate = applicableDate;
		this.fixedUntilDate = fixedUntilDate;
		this.category = category;
		this.condition = condition;
		this.arithmeticOperator = arithmeticOperator;
		this.components = components;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifckernel/lexical/ifctypeobject.htm
class ifcTypeObject extends ifcRoot {
	constructor(globalId, ownerHistory, name, description, applicableOccurrence, hasPropertySets, index){
		super(globalId, ownerHistory, name, description, index);
		this.entityName = 'IFCTYPEOBJECT';
		this.applicableOccurrence = applicableOccurrence;
		this.hasPropertySets = hasPropertySets;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifckernel/lexical/ifctypeproduct.htm
class ifcTypeProduct extends ifcTypeObject {
	constructor(globalId, ownerHistory, name, description, applicableOccurrence, hasPropertySets, representationMaps, tag, index){
		super(globalId, ownerHistory, name, description, applicableOccurrence, hasPropertySets, index);
		this.entityName = 'IFCTYPEPRODUCT';
		this.representationMaps = representationMaps;
		this.tag = tag;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifcproductextension/lexical/ifcelementtype.htm
class ifcElementType extends ifcTypeProduct {
	constructor(globalId, ownerHistory, name, description, applicableOccurrence, hasPropertySets, representationMaps, tag, elementType, index){
		super(globalId, ownerHistory, name, description, applicableOccurrence, hasPropertySets, representationMaps, tag, index);
		this.entityName = 'IFCELEMENTTYPE';
		this.elementType = elementType;
	}
}

// https://standards.buildingsmart.org/IFC/DEV/IFC4_3/RC1/HTML/schema/ifcsharedbldgelements/lexical/ifcbuildingelementproxytype.htm
class ifcBuildingElementProxyType extends ifcElementType {
	constructor(globalId, ownerHistory, name, description, applicableOccurrence, hasPropertySets, representationMaps, tag, elementType, predefinedType, index){
		super(globalId, ownerHistory, name, description, applicableOccurrence, hasPropertySets, representationMaps, tag, elementType, index);
		this.entityName = 'IFCBUILDINGELEMENTPROXYTYPE';
		this.predefinedType = predefinedType;
	}
}


exports.ifcMeasureWithUnit = ifcMeasureWithUnit;
exports.ifcObjective = ifcObjective;
exports.ifcMetric = ifcMetric;
exports.ifcTable = ifcTable;
exports.ifcTableColumn = ifcTableColumn;
exports.ifcRelAssociatesConstraint = ifcRelAssociatesConstraint;
exports.ifcReference = ifcReference;
exports.ifcAppliedValue = ifcAppliedValue;
exports.ifcTableRow = ifcTableRow;
exports.ifcBuildingElementProxyType = ifcBuildingElementProxyType;