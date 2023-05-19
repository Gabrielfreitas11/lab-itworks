const sql = require("mssql");

const connectDB = async () => {
  const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: process.env.DB_NAME,
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    // pool: {
    //   max: 10,
    //   min: 0,
    //   idleTimeoutMillis: 30000,
    // },
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  };

  return sql.connect(sqlConfig);
};

module.exports = {
  async getCert(cnpj) {
    try {
      const connect = await connectDB();

      const result =
        await sql.query`select top 1 Senha, RawData from IGCertificadoDigital where CNPJ_Contribuinte = '${cnpj}'`;

      await connect.close();

      return result?.recordsets?.flat() || [];
    } catch (error) {
      console.log(error);
      return null;
    }
  },

  async getStatusDownload(CNPJ_Gestor, CNPJ_Contribuinte) {
    try {
      const connect = await connectDB();

      const request = new sql.Request();

      const query = `SELECT *, xd.Status as StatusDownload FROM IGGestorContribuinte gc WITH (NOLOCK)
        JOIN IGXMLDownload as xd WITH (NOLOCK) ON xd.CNPJ_Contribuinte = gc.CNPJ_Contribuinte
        WHERE gc.Status = 'A'
        AND gc.CNPJ_Gestor = ${CNPJ_Gestor} ${
        CNPJ_Contribuinte
          ? "AND xd.CNPJ_Contribuinte = " + `'${CNPJ_Contribuinte}'`
          : ""
      }`;

      const result = await request.query(query);

      await connect.close();

      return result?.recordsets?.flat() || [];
    } catch (error) {
      console.log(error);
      return null;
    }
  },

  async insert(data, CNPJ_Contribuinte) {
    try {
      const connect = await connectDB();

      const request = new sql.Request();

      const query = `MERGE INTO IGXMLDownload AS doc
        USING (
            VALUES 
                ${data}
        ) AS source (CNPJ_Contribuinte, ChaveAcessoDOC, Status, tipo)
        ON (doc.ChaveAcessoDOC = source.ChaveAcessoDOC)
        WHEN MATCHED THEN 
            UPDATE SET doc.ChaveAcessoDOC = source.ChaveAcessoDOC 
        WHEN NOT MATCHED THEN 
            INSERT (CNPJ_Contribuinte, ChaveAcessoDOC, Status, tipo)
            VALUES (source.CNPJ_Contribuinte, source.ChaveAcessoDOC, source.Status, source.tipo);
            update IGXMLDownload set Status = 6 where CNPJ_Contribuinte = '${CNPJ_Contribuinte}' AND Status = 3
            `;

      const result = await request.query(query);

      await connect.close();

      return result?.recordsets?.flat() || [];
    } catch (error) {
      throw new Error(error?.message);
    }
  },

  async update(status, nfe, CNPJ_Contribuinte) {
    try {
      const connect = await connectDB();

      if (status == 1) {
        await sql.query`update IGXMLDownload set Status = ${status}, attempts = attempts + 1 where ChaveAcessoDOC = ${nfe}`;

        await connect.close();
        return;
      }

      if (status == 4) {
        await sql.query`update IGXMLDownload set Status = ${status}, attempts = attempts + 1 where CNPJ_Contribuinte = '${CNPJ_Contribuinte}'`;

        await connect.close();
        return;
      }

      await sql.query`update IGXMLDownload set Status = ${status} where ChaveAcessoDOC = ${nfe}`;

      await connect.close();
      return;
    } catch (error) {
      console.log(error);
      return null;
    }
  },
};
