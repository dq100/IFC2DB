const mysql = require('mysql');
const mssql = require('mssql');
const dbConfig = require('../config/db.config.js');

// Create connection to databse
if(dbConfig.DBMS=='mysql') {
    const connection = mysql.createConnection({
        host: dbConfig.HOST,
        user: dbConfig.USER,
        password: dbConfig.PASSWORD,
        database: dbConfig.DB,
    })

    connection.connect(error => {
        if(error) throw error;
        console.log('db connection ok');
    })

    module.exports = connection;
} else if(dbConfig.DBMS=='mssql') {
    var conn = new mssql.ConnectionPool({
        user: dbConfig.USER,
        password: dbConfig.PASSWORD,
        database: dbConfig.DB,
        server: dbConfig.HOST,
    });
    conn.connect()
    .then(function() {
        //var req = new mssql.Request(conn);
    })
    .catch(function(err) {
        console.log(err);
        callback(err, null);
    });

    exports.query = function(sql, callback=function(err, respone){return null;}) 
    {
        var req = new mssql.Request(conn);
            req.query(sql)
            .then(function(recordset) {
            if(recordset.recordset) {
                if(recordset.recordset.length==1)
                    result = recordset.recordset[0];
                else 
                    result = recordset.recordset;
            } else {
                result = recordset.recordset;
            }
            callback(null, result);
            })
            .catch(function(err) {
                console.log(err);
                callback(err, null);
        });
    };

} else {
    throw 'Error with DBMS settings!';
}