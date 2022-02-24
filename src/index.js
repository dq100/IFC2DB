// index.js

// Import express
const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');

const { Readable } = require('stream');

// Import body parser
const bodyParser = require('body-parser');

//Import database module
const sql = require('../models/db.js');
const SqlString = require('tsqlstring'); //für mssql strings

//Import ifc classes
const {ifcMeasureWithUnit, ifcObjective, ifcMetric, ifcTable, ifcTableColumn, ifcRelAssociatesConstraint, ifcReference, ifcAppliedValue, ifcTableRow, ifcBuildingElementProxyType} = require('../models/ifc.js');

const fs = require('fs');
const readline = require('readline');
const { parseInt } = require('lodash');

const dbConfig = require('../config/db.config.js');
mssqlDB = false;
if(dbConfig.DBMS=='mssql') {
	mssqlDB = true;
} 

// Initialize express
const app = express();

app.use(fileUpload({
    createParentPath: true
}));

app.use(cors());

// Limits erhöht gegen Fehler PayloadTooLargeError: request entity too large
app.use(bodyParser.json({limit: '10mb', extended: true}))
app.use(bodyParser.urlencoded({limit: '10mb', extended: true}))

// Error handler
function createError(message) {
  return {
    errors: [
      {
        message
      }
    ]
  }
};


/**
 * Route um zu prüfen, ob Schnittstelle online
 */
app.get('/', (req, res) => {
  res.status(200).json({status: 'online'});
});

/**
 * Route um Datenbank zu initialisieren
 */
app.post('/api/setup', async (req, res) => {
	queryString=''
	if(mssqlDB){
		queryString=`CREATE TABLE settings(
			id INT IDENTITY(1,1),
			name VARCHAR(250),
			details TEXT,
			createdDate DATETIME DEFAULT GETDATE(),
			PRIMARY KEY (id))`;
	} else {
		queryString=`CREATE TABLE IF NOT EXISTS settings(
			id INT NOT NULL AUTO_INCREMENT,
			name VARCHAR(250),
			details TEXT,
			createdDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (id))`;
	}

	sql.query(queryString, (err, response) => {
		if (err) {
			res.status(500).json(err);
		}
	
		if (response) {
			res.status(200).json({'message': 'setup erfolgreich'});
		}
	});
});

/**
 * Route um Artikel zu selektieren
 */
app.post('/api/article/:ifcid', async (req, res) => {
	whereQuery = "";

	getNext = false;
	if(req.body.next) {
		getNext = true;
	}

	if(req.body && Object.keys(req.body).length != 0){
		for (let [key, value] of Object.entries(req.body)) {
			
			if(key=="next") {
				continue;
			}

			if(whereQuery == "") {
				
				if(mssqlDB){
					whereQuery += SqlString.format("?? = ? ",[key, value]);
				} else {
					whereQuery += "?? = ? ";
					whereQuery = sql.format(whereQuery, [key, value]);
				}
			} else {
				if(mssqlDB){
					whereQuery += SqlString.format("AND ?? = ? ",[key, value]);
				} else {
					whereQuery += "AND ?? = ? "
					whereQuery = sql.format(whereQuery, [key, value]);
				}

				
			}
		}

		if(getNext) {
			whereQuery += " group by " + req.body.next + " order by " + req.body.next + " asc";
		}
		
	} else {
		whereQuery = "1=1";
	}

	if(req.params.ifcid && req.params.ifcid>0) {
		if(mssqlDB) {
			if(getNext) {
				sqlString = SqlString.format("SELECT distinct ?? from ?? WHERE " + whereQuery, [req.body.next, req.params.ifcid + '_vresult']);
			} else {
				sqlString = SqlString.format("SELECT COUNT_BIG(*) as count from ?? WHERE " + whereQuery, [req.params.ifcid + '_vresult']);
			}
		} else {
			if(getNext) {
				sqlString = sql.format("SELECT distinct ?? from ?? WHERE " + whereQuery, [req.body.next, req.params.ifcid + '_vresult']);
			} else {
				sqlString = sql.format("SELECT COUNT(*) as count from ?? WHERE " + whereQuery, [req.params.ifcid + '_vresult']);
			}
		}

		sql.query(sqlString, (error, response) => {

			if (error && error.code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
				//throw new Error('too long to count table rows!');
				res.status(500).json(error);
			}

			if (error) {
				res.status(500).json(error);
			}
		
			if (response) {
				// Wenn getNEXT kann hier schon das ergebnis zurückgegeben werden
				if(getNext) {
					return res.json(response);
				}

				if(mssqlDB) {
					response = [response];
				}

				if(response[0].count<=1000) {
					//Artikel zurückgeben
					if(mssqlDB) {
						sqlString = SqlString.format("SELECT * from ?? WHERE " + whereQuery, [req.params.ifcid + '_vresult']);
					} else {
						sqlString = sql.format("SELECT * from ?? WHERE " + whereQuery, [req.params.ifcid + '_vresult']);
					}
					sql.query(sqlString, (error, response2) => {
						if (error) {
							res.status(500).json(error);
						}

						if (response2) {
							if(mssqlDB) {
								response2 = [response2];
							}
							res.status(200).json({'count': response[0].count, 'articles': response2});
						}
					});
				} else {
					//Count zurückgeben
					res.status(406).json({'count': response[0].count});
				}
			}
		});



	}
});

/**
 * Route um alle eingelesenen Dateien abzurufen
 */
app.get('/api/ifc/', async (req, res) => {
	sql.query('Select id, name , createdDate from settings', (err, response) => {
		if (err) {
			res.status(500).json(err);
		}
	
		if (response) {
			res.status(200).json(response);
		}
	});
});

/**
 * Route um alle Tabellen von ID zu entfernen
 */
app.delete('/api/ifc/:id', async (req, res) => {

	// ids aus settings tabelle auslesen
	sql.query('Select id, details from settings where id=?', [req.params.id],(err, response) => {
		if (err) {
			res.status(500).json(err);
		}
	
		if (response) {
			//Einzelne Tabellen und Views löschen
			response.forEach(function(res) {
				details = JSON.parse(res.details);
				//Alle Tabellen mit dem id prefix löschen
				details.tables.forEach(function(table) {
					sql.query(`DROP TABLE IF EXISTS ${res.id}_${table.tableName};`);
					sql.query(`DROP TABLE IF EXISTS ${res.id}_result;`);
					sql.query(`DROP VIEW IF EXISTS ${res.id}_vresult;`);
				});
			});

			// Settings Tabelle leeren
			sql.query('DELETE FROM settings where id=?', [req.params.id],(err, response) => {
				if (err) {
					res.status(500).json(err);
				}
				if (response) {
					res.status(200).json({'id': req.params.id, 'message': 'gelöscht'});
				}
			});
		}
	});
});;


/**
 * Route löscht alle Einträge in settings Tabelle und zugehörige Tabellen
 */
app.delete('/api/ifc/', async (req, res) => {

	// ids aus settings tabelle auslesen
	sql.query('Select id, details from settings', (err, response) => {
		if (err) {
			res.status(500).json(err);
		}
	
		if (response) {
			//Einzelne Tabellen und Views löschen
			ids = [];
			response.forEach(function(res) {
				details = JSON.parse(res.details);
				//Alle Tabellen mit dem id prefix löschen
				details.tables.forEach(function(table) {
					sql.query(`DROP TABLE IF EXISTS ${res.id}_${table.tableName};`);
					sql.query(`DROP TABLE IF EXISTS ${res.id}_result;`);
					sql.query(`DROP VIEW IF EXISTS ${res.id}_vresult;`);
				});

				ids.push(res.id);
			});

			// Settings Tabelle leeren
			sql.query('TRUNCATE TABLE settings', (err, response) => {
				if (err) {
					res.status(500).json(err);
				}
				if (response) {
					res.status(200).json({'ids': ids, 'message': 'gelöscht'});
				}
			});
		}
	});
});;

/**
 * Route gibt Infos zu bestimmten Artikel zurück
 */
app.get('/api/ifc/:id', async (req, res) => {
	sql.query('Select id, name , details, createdDate from settings where id=?', [req.params.id],(err, response) => {
		if (err) {
			res.status(500).json(err);
		}
	
		if (response) {
			res.status(200).json(JSON.parse(response[0].details));
		}
	});
});

/**
 * Route liest IFC Datei ein
 */
app.post('/api/ifc', async (req, res) => {
	var ifcDetails = {
		'id': '',
		'name': '',
		'fileName' : '',
		'attributes': [],
		'tables': [],
		'fixedValues': [],
		'constraints': [],
		'sqlStringsTableCreate': [],
		'sqlStringsTableInsert': [],
		'sqlStringsConstraints': []
	};

	try {
		// Prüfen, ob Variable testMode übergeben wurde
		var testMode = false;

		if(req.body && req.body.testMode && req.body.testMode == 1) {
			testMode = true;
		}

		//Prüfen, ob Datei übergeben wurde
		if(req.files && req.files.ifc) {
			ifcDetails.fileName = req.files.ifc.name;
			fileBuffer = req.files.ifc.data;
		} else {
			//Beispieldatei benutzen
			console.log('keine Datei übergeben, nutze Beispieldatei!');
			ifcDetails.fileName = 'keine Datei übergeben, nutze Beispieldatei';
			fileBuffer = fs.readFileSync('src/CatalogV4.ifc');
		}

		// Textdatei einlesen
		// Zeilenweise in Array schreiben
		ifcData = await processLineByLine(fileBuffer);

		var ifcTableData = [];
		var ifcTableRowData = [];
		var ifcTableColumnData = [];
		var ifcObjectiveData = [];
		var ifcMetricData = [];
		var ifcRelAssociatesConstraintData = [];
		var ifcReferenceData = [];
		var ifcAppliedValueData = [];
		var ifcMeasureWithUnitData = [];
		var ifcBuildingElementProxyTypeData = [];

		// Codewörter suchen
		ifcData.forEach(function(item, index) {

			// suchen nach IFCBUILDINGELEMENTPROXYTYPE
			if(item && item.substring(0, item.indexOf('('))=='IFCBUILDINGELEMENTPROXYTYPE ') {
				item = removeWhitespaceInString(item);
				//Codewort und schliessende Klammer entfernen
				item = item.substring(item.indexOf('(')+1).slice(0,-2);
				//Arrays filtern
				attributes = splitStringInArray(item);

				// Parameter globalId, ownerHistory, name, description, applicableOccurrence, hasPropertySets, representationMaps, tag, elementType, predefinedType, index
				tempIfcBuildingElementProxyType = new ifcBuildingElementProxyType(
					attributes[0],
					attributes[1],
					attributes[2],
					attributes[3],
					attributes[4],
					attributes[5],
					attributes[6],
					attributes[7],
					attributes[8],
					attributes[9],
					index
				);
				ifcBuildingElementProxyTypeData.push(tempIfcBuildingElementProxyType);
				ifcData[index] = tempIfcBuildingElementProxyType;
			}

			// suchen nach IFCTABLE
			if(item && item.substring(0, item.indexOf('('))=='IFCTABLE') {
				item = removeWhitespaceInString(item);
				//Codewort und schliessende Klammer entfernen
				item = item.substring(item.indexOf('(')+1).slice(0,-2);
				//Arrays filtern
				attributes = splitStringInArray(item);

				// Parameter name, rows, columns, index
				tempIfcTable = new ifcTable(
					attributes[0].replace(/'/g, ''),
					attributes[1],
					attributes[2],
					index
				);
				ifcTableData.push(tempIfcTable);
				ifcData[index] = tempIfcTable;
			}

			// suchen nach IFCTABLEROW
			if(item && item.substring(0, item.indexOf('('))=='IFCTABLEROW') {
				item = removeWhitespaceInString(item);
				//Codewort und schliessende Klammer entfernen
				item = item.substring(item.indexOf('(')+1).slice(0,-2);
				//Arrays filtern
				attributes = splitStringInArray(item);

				tempIfcTableRow = new ifcTableRow(
					attributes[0],
					attributes[1],		// führendes Komma entfernen
					index
				);
				ifcTableRowData.push(tempIfcTableRow);
				ifcData[index] = tempIfcTableRow;
			}

			// suchen nach IFCTABLECOLUMN
			if(item && item.substring(0, item.indexOf('('))=='IFCTABLECOLUMN') {
				item = removeWhitespaceInString(item);
				//Codewort und schliessende Klammer entfernen
				item = item.substring(item.indexOf('(')+1).slice(0,-2);
				//Arrays filtern
				attributes = splitStringInArray(item);

				tempIfcTableColumn = new ifcTableColumn(
					attributes[0].replace(/'/g, ''),	//einzelne Anführungszeichen entfernen
					attributes[1].replace(/'/g, ''),	//einzelne Anführungszeichen entfernen
					attributes[2].replace(/'/g, ''),	//einzelne Anführungszeichen entfernen
					attributes[3],
					attributes[4],
					index
				);
				ifcTableColumnData.push(tempIfcTableColumn);
				ifcData[index] = tempIfcTableColumn;
			}

			// suchen nach IFCOBJECTIVE
			if(item && (item.substring(0, item.indexOf('('))).trim()=='IFCOBJECTIVE') {
				item = removeWhitespaceInString(item);
				//Codewort und schliessende Klammer entfernen
				item = item.substring(item.indexOf('(')+1).slice(0,-2);
				//Arrays filtern
				attributes = splitStringInArray(item);
			
				tempIfcObjective = new ifcObjective(
					attributes[0].replace(/'/g, ''),
					attributes[1].replace(/'/g, ''),
					attributes[2],
					attributes[3],
					attributes[4],
					attributes[5],
					attributes[6],
					attributes[7],
					attributes[8],
					attributes[9],
					attributes[10].replace(/'/g, ''),
					index
				);
				ifcObjectiveData.push(tempIfcObjective);
				ifcData[index] = tempIfcObjective;
			}

			// suchen nach IFCMETRIC
			if(item && (item.substring(0, item.indexOf('('))).trim()=='IFCMETRIC') {
				item = removeWhitespaceInString(item);
				//Codewort und schliessende Klammer entfernen
				item = item.substring(item.indexOf('(')+1).slice(0,-2);

				//Arrays filtern
				attributes = splitStringInArray(item);

				tempIfcMetric = new ifcMetric(
					attributes[0].replace(/'/g, ''),
					attributes[1].replace(/'/g, ''),
					attributes[2],
					attributes[3],
					attributes[4],
					attributes[5],
					attributes[6],
					attributes[7],
					attributes[8].replace(/'/g, ''),
					attributes[9],
					attributes[10],
					index
				);
				ifcMetricData.push(tempIfcMetric);
				ifcData[index] = tempIfcMetric;
			}

			// suchen nach IFCRELASSOCIATESCONSTRAINT
			if(item && (item.substring(0, item.indexOf('('))).trim()=='IFCRELASSOCIATESCONSTRAINT') {
				item = removeWhitespaceInString(item);
				//Codewort und schliessende Klammer entfernen
				item = item.substring(item.indexOf('(')+1).slice(0,-2);
				attributes = splitStringInArray(item);

				//constructor(globalId, ownerHistory, name, description, relatedObjects, intent, relatingConstraint, index){
				tempIfcRelAssociatesConstraint = new ifcRelAssociatesConstraint(
					attributes[0].replace(/'/g, ''),
					attributes[1],
					attributes[2],
					attributes[3],
					attributes[4],
					attributes[5].replace(/'/g, ''),
					attributes[6],
					index
				);
				ifcRelAssociatesConstraintData.push(tempIfcRelAssociatesConstraint);
				ifcData[index] = tempIfcRelAssociatesConstraint;
			}

			// suchen nach IFCREFERENCE
			if(item && (item.substring(0, item.indexOf('('))).trim()=='IFCREFERENCE') {
				item = removeWhitespaceInString(item);
				//Codewort und schliessende Klammer entfernen
				item = item.substring(item.indexOf('(')+1).slice(0,-2);
				//Arrays filtern
				attributes = splitStringInArray(item);
				//constructor(typeIdentifier, attributeIdentifier, instanceName, listPositions, innerReference, index){
				tempIfcReference = new ifcReference(
					attributes[0].replace(/'/g, ''),
					attributes[1].replace(/'/g, ''),
					attributes[2].replace(/'/g, ''),
					attributes[3],
					attributes[4],
					index
				);
				ifcReferenceData.push(tempIfcReference);
				ifcData[index] = tempIfcReference;
			}

			// suchen nach IFCAPPLIEDVALUE
			if(item && (item.substring(0, item.indexOf('('))).trim()=='IFCAPPLIEDVALUE') {
				item = removeWhitespaceInString(item);
				//Codewort und schliessende Klammer entfernen
				item = item.substring(item.indexOf('(')+1).slice(0,-2);
				//Arrays filtern
				attributes = splitStringInArray(item);

				//constructor(name, description, appliedValue, unitBasis, applicableDate, fixedUntilDate, category, condition, arithmeticOperator, components, index){
				tempIfcAppliedValue = new ifcAppliedValue(
					attributes[0].replace(/'/g, ''),
					attributes[1],
					attributes[2],
					attributes[3],
					attributes[4],
					attributes[5],
					attributes[6],
					attributes[7],
					attributes[8],
					attributes[9],
					index
				);
				ifcAppliedValueData.push(tempIfcAppliedValue);
				ifcData[index] = tempIfcAppliedValue;
			}

			// suchen nach IFCMEASUREWITHUNIT
			if(item && (item.substring(0, item.indexOf('('))).trim()=='IFCMEASUREWITHUNIT') {
				item = removeWhitespaceInString(item);
				//Codewort und schliessende Klammer entfernen
				item = item.substring(item.indexOf('(')+1).slice(0,-2);

				//Arrays filtern
				attributes = splitStringInArray(item);

				//constructor(valueComponent, unitComponent, index){
				tempIfcMeasureWithUnit = new ifcMeasureWithUnit(
					attributes[0],
					attributes[1],
					index
				);
				ifcMeasureWithUnitData.push(tempIfcMeasureWithUnit);
				ifcData[index] = tempIfcMeasureWithUnit;
			}

			
		});

		//Allgemeine Attributte setzen
		if(ifcBuildingElementProxyTypeData.length>0) {
			ifcDetails.name = ifcBuildingElementProxyTypeData[0].name.replace(/'/g, '');
		} else 
		{
			ifcDetails.name = 'kein Name in Datei enthalten';
		}
		

		//Prüfen, ob Settingstabelle existiert
		if(sql.config)
		{
			queryString = `SELECT 1 
			FROM INFORMATION_SCHEMA.TABLES 
			WHERE TABLE_SCHEMA = '${sql.config.database}' 
			AND TABLE_NAME = 'settings'`

		} else {
			queryString = `SELECT 1 
			FROM INFORMATION_SCHEMA.TABLES 
			WHERE TABLE_SCHEMA = 'dbo'
			AND TABLE_NAME = 'settings'`
		}
		
		sql.query(queryString, function(err, response) {

			if (err) {
				console.log(err);
				return res.status(500).json(err);
			}
		
			if (response.length==0) {
				return res.status(500).json(createError('Not found'));
			}

			//ID generieren
			if(mssqlDB) {
				queryString = `Insert into settings(name, details) VALUES ('${ifcDetails.name}', '${JSON.stringify(ifcDetails)}'); SELECT SCOPE_IDENTITY() AS insertId;`;
			} else {
				queryString = `Insert into settings(name, details) VALUES ('${ifcDetails.name}', '${JSON.stringify(ifcDetails)}')`;
			}

			sql.query(queryString, async function(err, result) {
				if (err) {
					console.log(err);
					return res.status(500).json(err);
				}
				
				ifcDetails.id = result.insertId;

				// Tabellen zusammenbauen
				for (const [index, table] of ifcTableData.entries()) {
					// Tabelle erstellen
					if(mssqlDB) {
						var sqlCreateString = `CREATE TABLE [${ifcDetails.id}_${table.name.replace(/ /g, '_')}] (\n`;
					} else {
						var sqlCreateString = `CREATE TABLE ${ifcDetails.id}_${table.name.replace(/ /g, '_')} (\n`;
					}

					table.columns.forEach(function(column, index) {
						// Column in ifcTableColumnData anhand des Index suchen
						ifcTableColumnData.forEach(function(columnData, indexColumnData) {
							
							if(columnData.index == column) {
								//Leerzeichen im Namen durch Unterstriche ersetzen
								sqlCreateString += `${columnData.name} VARCHAR(100)`;		//Spaltentyp bestimmen!
								if(table.columns.length > 1 && index < table.columns.length-1) {
									sqlCreateString += `,\n`;
								} else {
									sqlCreateString += `\n`;
								}
							}
						})
					});

					sqlCreateString += `);`
				}

				// Constraint erstellen
				for (const [index, ifcRelAssociatesConstraintValue] of ifcRelAssociatesConstraintData.entries()) {

					// relatingConstraint suchen
					// (entweder in ifcObjectiveData oder ifcMetricData)
					var constraintIndex = ifcObjectiveData.findIndex(element => element.index == ifcRelAssociatesConstraintValue.relatingConstraint);
					if(constraintIndex>-1) {
						//Schleife über benchmarkValues
						for (const [index, benchmarkValue] of ifcObjectiveData[constraintIndex].benchmarkValues.entries()) {
							//wahrscheinlich in ifcMetricData
							var benchmarkValueIndex = ifcMetricData.findIndex(element => element.index == benchmarkValue);
							if(benchmarkValueIndex>-1) {
								//zugehörige IFCAPPLIED Value suchen, ggf. rekursiv wert ableiten
								//prüfen, welchen Typ benchmarkValue hat
								//möglich sind IFCAPPLIEDVALUE oder IFCMEASUREWITHUNIT
								if(ifcData[ifcMetricData[benchmarkValueIndex].dataValue].entityName=='IFCAPPLIEDVALUE') {
									var rekursion= function(index) {
										var ifcAppliedValueValue = ifcAppliedValueData.find(element => element.index == index);
			
										if(!ifcAppliedValueValue) return;
										
										if(ifcAppliedValueValue.appliedValue != '$') {
											//value ist entweder IFCMEASUREWITHUNIT oder IFCREFERENCE
											if(ifcData[ifcAppliedValueValue.appliedValue].entityName == 'IFCMEASUREWITHUNIT') {
												return ifcData[ifcAppliedValueValue.appliedValue].getValue();
											}
			
											if(ifcData[ifcAppliedValueValue.appliedValue].entityName == 'IFCREFERENCE') {
												if(ifcData[ifcAppliedValueValue.appliedValue].attributeIdentifier == 'HasPropertySets' && ifcData[ifcAppliedValueValue.appliedValue].innerReference > 0 ) {
													if(ifcData[ifcData[ifcAppliedValueValue.appliedValue].innerReference].attributeIdentifier == 'HasProperties') {
														return ifcData[ifcData[ifcAppliedValueValue.appliedValue].innerReference].instanceName;
													}
												}
											}
			
											return ifcAppliedValueValue.appliedValue;
										}
										if(ifcAppliedValueValue.components == '$') {
											console.log('fehler?');
											return ;
										}
			
										//nächsten Schritt herausfinden
										var constraintString = '(';
										for (const [index, component] of ifcAppliedValueValue.components.entries()) {
											if(mssqlDB) {
												constraintString += ' CONVERT(float,' + rekursion(component) + ') '; 
											} else {
												constraintString += ' ' + rekursion(component) + ' '; 
											}
											
											if(ifcAppliedValueValue.components.length-1>index) {
												if(ifcAppliedValueValue.arithmeticOperator=='.MULTIPLY.') {
													constraintString += '*';
												}
												if(ifcAppliedValueValue.arithmeticOperator=='.ADD.') {
													constraintString += '+';
												}
											}
										}
										constraintString += ' )';
										return constraintString;
										
									};
			
									var reference = ''
									//Vergleichswert ermitteln:
									if(ifcMetricData[benchmarkValueIndex].dataValue > 0 && ifcMetricData[benchmarkValueIndex].referencePath == '$') {
										//Metric muss sich auf Tabelle beziehen
									} else {
										if(ifcData[ifcMetricData[benchmarkValueIndex].referencePath].entityName == 'IFCREFERENCE') {
											if(ifcData[ifcMetricData[benchmarkValueIndex].referencePath].attributeIdentifier == 'HasPropertySets' && ifcData[ifcMetricData[benchmarkValueIndex].referencePath].innerReference > 0 ) {
												if(ifcData[ifcData[ifcMetricData[benchmarkValueIndex].referencePath].innerReference].attributeIdentifier == 'HasProperties') {
													reference =  ifcData[ifcData[ifcMetricData[benchmarkValueIndex].referencePath].innerReference].instanceName;
												}
											}
										}
									}
									
									// Sonderzeichen im namen durch unterstriche ersetzen
									ifcDetails.constraints.push({'name': ifcMetricData[benchmarkValueIndex].name.replace(/[^\w]/gi, '_'),
														'value': rekursion(ifcMetricData[benchmarkValueIndex].dataValue),
														'benchmark':ifcMetricData[benchmarkValueIndex].getBenchmark(),
														'reference': reference});
									ifcDetails.sqlStringsConstraints.push('ALTER TABLE ' + ifcDetails.id + '_result ADD CONSTRAINT ' + ifcDetails.id + '_result_' + ifcMetricData[benchmarkValueIndex].name.replace(/[^\w]/gi, '_')+ ' CHECK (' + rekursion(ifcMetricData[benchmarkValueIndex].dataValue) + ifcMetricData[benchmarkValueIndex].getBenchmark() +  reference + ')');
								} else if(ifcData[ifcMetricData[benchmarkValueIndex].dataValue].entityName=='IFCMEASUREWITHUNIT') {
									var tempIfcMeasureWithUnit = ifcData[ifcMetricData[benchmarkValueIndex].dataValue];

									var reference = ''
									//Vergleichswert ermitteln:
									if(ifcMetricData[benchmarkValueIndex].dataValue > 0 && ifcMetricData[benchmarkValueIndex].referencePath == '$') {
										//Metric muss sich auf Tabelle beziehen
									} else {
										if(ifcData[ifcMetricData[benchmarkValueIndex].referencePath].entityName == 'IFCREFERENCE') {
											if(ifcData[ifcMetricData[benchmarkValueIndex].referencePath].attributeIdentifier == 'HasPropertySets' && ifcData[ifcMetricData[benchmarkValueIndex].referencePath].innerReference > 0 ) {
												if(ifcData[ifcData[ifcMetricData[benchmarkValueIndex].referencePath].innerReference].attributeIdentifier == 'HasProperties') {
													reference =  ifcData[ifcData[ifcMetricData[benchmarkValueIndex].referencePath].innerReference].instanceName;
												}
											}
										}
									}

									if(reference == reference) {
										//Spalte in resulttabelle hinzufügen
										ifcDetails.sqlStringsConstraints.push(`ALTER TABLE  ${ifcDetails.id}_result ADD ${reference} INT DEFAULT ${tempIfcMeasureWithUnit.getValue()}`);
										ifcDetails.fixedValues.push({'valueName': reference, 'value':tempIfcMeasureWithUnit.getValue()});
									}
								} else if(ifcData[ifcMetricData[benchmarkValueIndex].dataValue].entityName=='IFCTABLE') {

									var tempIfcTable = ifcData[ifcMetricData[benchmarkValueIndex].dataValue];
									var tableName = tempIfcTable.name.replace(/ /g, '_');
									
									if(mssqlDB) {
										createTableStatement = 'CREATE TABLE [' +  ifcDetails.id +'_' + tableName + '] (';
									} else {
										createTableStatement = 'CREATE TABLE ' +  ifcDetails.id +'_' + tableName + ' (';
									}

									var columns = [];
									tempIfcTable.columns.forEach(function(columnIndex, index) {
										column = ifcData[columnIndex];

										columns.push(column.name.replace(/ /g, '_'));
										ifcDetails.attributes.push(column.name.replace(/ /g, '_'));
										createTableStatement += `${column.name.replace(/ /g, '_')} VARCHAR(100)`;

										if(tempIfcTable.columns.length > 1 && index < tempIfcTable.columns.length-1) {
											createTableStatement += `, `;
										} else {
											createTableStatement += ``;
										}
									});
									createTableStatement += ')';

									ifcDetails.tables.push({'tableName': tableName, 'columns': columns});

									// Insert Statements zusammenbauen
									if(mssqlDB) {
										var insertTableStatement = 'INSERT INTO [' +  ifcDetails.id + '_' + tableName + '] '
									} else {
										var insertTableStatement = 'INSERT INTO ' +  ifcDetails.id + '_' + tableName + ' VALUES '
									}

									tempIfcTable.rows.forEach(function(rowIndex, index) {										
										var row = ifcData[rowIndex];

										if(mssqlDB){
											insertTableStatement += 'SELECT '
										} else {
											insertTableStatement += '('
										}

										row.rowcells.forEach(function(cell, cellindex) {
											//wenn String, dann Anführungszeichen übernehmen
											if(typeof cell == 'string') {
												insertTableStatement += `'${cell}'`;
											} else {
												insertTableStatement += `${cell}`;
											}
											
											if(row.rowcells.length>1 && cellindex < row.rowcells.length-1) {
												insertTableStatement += `, `;
											} 

										});
										
										
										if(index == tempIfcTable.rows.length-1) {
											if(mssqlDB){
											
											} else {
												insertTableStatement += `)`
											}

										} else {
											
											if(mssqlDB){
												insertTableStatement += ' union all '
											} else {
												insertTableStatement += `),`
											}
										}
									});

									ifcDetails.sqlStringsTableCreate.push(createTableStatement);
									ifcDetails.sqlStringsTableInsert.push(insertTableStatement);
								} else {
									console.log(ifcMetricData[benchmarkValueIndex].dataValue);
								}

							}
						}
					} else {
						break;
					}
				}

				// ifcDetails in DB aktualisieren
				if(mssqlDB) {
					queryString =  SqlString.format('UPDATE settings SET name= ?, details=? WHERE id = ?', [ifcDetails.name, JSON.stringify(ifcDetails), ifcDetails.id ]);
				} else {
					queryString = sql.format('UPDATE settings SET name= ?, details=? WHERE id = ?', [ifcDetails.name, JSON.stringify(ifcDetails), ifcDetails.id ]);
				}

				sql.query(queryString);



				// Tabellen anlegen
				ifcDetails.sqlStringsTableCreate.forEach(function(sqlString) {	
					if(testMode) {
						console.log("Attribut Tabelle angelegt");
					} else {
						sql.query(sqlString);
					}
				});

				if(mssqlDB) await new Promise(resolve => setTimeout(resolve, 2000));

				// Tabellen füllen
				ifcDetails.sqlStringsTableInsert.forEach(function(sqlString) {
					if(testMode) {
						console.log("Attribut Tabelle gefüllt");
					} else {
						sql.query(sqlString);
					}
				});


				if(mssqlDB) await new Promise(resolve => setTimeout(resolve, 2000));

				// Gesamttabelle anlegen
				joinQuery = '';
				ifcDetails.tables.forEach(function(table, index) {		
					if(index==0){
						if(mssqlDB) {
							joinQuery += ` [${ifcDetails.id}_${table.tableName}]`;
						} else {
							joinQuery += ` ${ifcDetails.id}_${table.tableName}`;
						}
						
					} else {
						if(mssqlDB) {
							joinQuery += ` ,[${ifcDetails.id}_${table.tableName}]`;
						} else {
							joinQuery += ` inner join ${ifcDetails.id}_${table.tableName}`;
						}	
					}
				});

				if(testMode) {
					console.log("result Tabelle angelegt");
				} else {
					if(mssqlDB) {
						sql.query(`SELECT * INTO [${ifcDetails.id}_result] FROM ( SELECT * from ${joinQuery} WHERE 1=0) b`);
					} else {
						sql.query(`CREATE TABLE ${ifcDetails.id}_result AS ( SELECT * from ${joinQuery} WHERE 1=0)`);
					}
					
				}

				if(mssqlDB) await new Promise(resolve => setTimeout(resolve, 2000));

				// Gesamtview anlegen
				fixedValueQuery = '';
				ifcDetails.fixedValues.forEach(function(fixedValue, index) {		
					if(index<ifcDetails.fixedValues.length-1){
						fixedValueQuery += `${fixedValue.value} as ${fixedValue.valueName}, `;
					} else {
						fixedValueQuery += `${fixedValue.value} as ${fixedValue.valueName}`;
					}
				});

				constraintsQuery = '';
				ifcDetails.constraints.forEach(function(constraint, index) {		
					if(index==0){
						constraintsQuery += `${constraint.value} ${constraint.benchmark} ${constraint.reference} `;
					} else {
						constraintsQuery += `AND ${constraint.value} ${constraint.benchmark} ${constraint.reference} `;
					}
				});

				if(testMode) {
					console.log("result View angelegt");
				} else {
					if(mssqlDB) {
						queryString = `CREATE VIEW [${ifcDetails.id}_vresult] as 
						SELECT * from 
						(
							SELECT *,
							${fixedValueQuery}
							from 
							${joinQuery}
						) a
						WHERE 
						${constraintsQuery}
						;`;
					} else {
						queryString = `CREATE OR REPLACE VIEW ${ifcDetails.id}_vresult as 
						SELECT * from 
						(
							SELECT *,
							${fixedValueQuery}
							from 
							${joinQuery}
						) a
						WHERE 
						${constraintsQuery}
						;`;

					}
					sql.query(queryString);
				}

				if(mssqlDB){
					return res.status(500).json(ifcDetails);
				}
				

				// Constraints einfügen
				ifcDetails.sqlStringsConstraints.forEach(function(sqlString) {
					if(testMode) {
						console.log("constraint angelegt");
					} else {
						sql.query(sqlString);	
					}
				});

				res.status(200).json(ifcDetails);
			});
		});

	} catch (err) {
		res.status(500).json(err);
		console.log(err);
	}
})

/**
 * Diese Funktion entfernt alle Leerzeichen im String, die nicht zu einem inneren String gehören.
 * Bsp: 
 * 	input: 'dafasfsf,   fadfsafsdf,  'dfd    sfsdf',fdfdf,123'
 * 	output 'dafasfsf,fadfsafsdf,'dfd    sfsdf',fdfdf,123'
 * @param {string} inputString 
 * @returns string
 */
function removeWhitespaceInString(inputString) {
	//console.log(inputString);
	//'(.*)' erstes und letztes '
	// (?<=').*?(?=') alle zwischen '

	splittedStrings = inputString.split(new RegExp(/('.+?')/));

	outputString = '';
	splittedStrings.forEach(function(splittedString) {
		// Wenn String nicht mit Anführungszeichen beginnt alle Leerzeichen entfernen
		if(splittedString.charAt(0)!='\'') {
			outputString += splittedString.replace(/\s/g, "");
		} else {
			outputString += splittedString;
		}
	});

	return outputString;
}


/**
 * Diese Funktion zerlegt einen IFC String in ein Array. 
 * Dabei werden Strings im String und Arrays im String beachtet
 * @param {string} inputString 
 * @returns array
 */
function splitStringInArray(inputString) {
	outputArray = [];

	inputString = inputString.split(/(?=IFC.*?\(.*?\))|(?<=\))/g);		//String teilen an IFC(TEXT|REAL|...)('SB25'|1.|...))

	//Array durchgehen, und auftreten von IFC Keywords ersetzen
	for(i=0;i<inputString.length;i++) {
		if(inputString[i].includes('IFCREAL')){
			inputString[i] = inputString[i].match(/\(.*?\)/)[0].slice(1,-1);	//Wert in den Klammern suchen 
		}
		if(inputString[i].includes('IFCTEXT')){
			inputString[i] = inputString[i].match(/\(.*?\)/)[0].slice(2,-2);	//Wert in den Klammern suchen 
		}
	}
	inputString = inputString.join('');	//Array wieder zusammenfügen

	//Der Filter entfernt leere Arrays am Ende oder Anfang des Strings
	//inputArray = inputString.split(new RegExp(/(\(.+?\))/)).filter(x => x);
	inputArray = inputString.split(new RegExp(/(^\(.+?\))|((?<=,)\(.+?\))/)).filter(x => x);		//matched Klammer am Anfang oder Klammer nach Komma bis Klammer zu

	inputArray.forEach(function(substring) {
		if(substring.charAt(0)=='(') {
			//Wenn Array im String, diesen aufteilen in richtiges Array
			var array = [];

			// Wenn substring sowas wie (IFCREAL(300.) ist, dann ohne weiteren Split ans Array anhängen
			if(substring.charAt(1)=='I' && !substring.includes(',')){
				outputArray.push([substring.slice(1)]);
				return;
			}

			temp = substring.replace(/#| /g,'').slice(1,-1).split(',');	// öffnende und schliessende Klammer entfernen und splitten am #
			temp.forEach(function(row, index) {
				if(parseFloat(row)) {
					array.push(parseFloat(row));
				} else {
					array.push(row);
				}
				
			});

			outputArray.push(array);
		} else {
			substring = substring.replace(/^\)/, '');	// Klammer zu am Anfang entfernen
			substring = substring.replace(/^\,/, '');	// Komme am Anfang entfernen

			tmpArray = substring.split(new RegExp(/('.+?')/)).filter(x => x);;
			
			tmpArray.forEach(function(substring) {
				if(substring.charAt(0)==','&& substring.length==1){
					return;
				}
				substring = substring.replace(/\,$/, '');	// Komma am Anfang entfernen
				if(substring.charAt(0)=='\'') {
					outputArray.push(substring);
				} else {
					substring = substring.replace(/^\,/, '');	// Komma am Ende entfernen
					substring = substring.replace(/\,$/, '');	// Komma am Anfang entfernen
					tmp = substring.split(',');
					tmp.forEach(function(x) {
						//wenn string mit # anfängt ist es ein verweis. # entfernen und zu int parsen
						if(x.charAt(0)=='#') {
							outputArray.push(parseInt(x.replace(/#| /g,'')));
						} else {
							outputArray.push(x);
						}
					});
				}
				
			});
		}
	});

	return outputArray;
}

/**
 * Funktion liest als file übergebene Datei ein
 * @param {*} file 
 * @returns 
 */
async function processLineByLine(file) {
	const fileStream = Readable.from(file.toString());

	const rl = readline.createInterface({
	  input: fileStream,
	  crlfDelay: Infinity
	});

	//neues Array erstellen
	var ifcData = [];
  
	for await (const line of rl) {
		//prüfen, ob Zeile mit Hashtag beginnt
		if(line.charAt(0)=='#') {
			//Nummer auslesen
			if(line.indexOf('=')>0) {
				//in array einfügen
				ifcData[line.substring(1, line.indexOf('='))] = line.substring(line.indexOf('=')+1).trim();
			}
		}
	}

	return ifcData;
  }

/**
 * Route für 404 nicht vorhanden
 */
app.all('*', (req, res) => {
  return res.status(404).send(
     createError('Not found')
  )
})


// API auf Port 3002 starten
app.listen(3002, () => {
  console.log("Listening to port 3002");
});